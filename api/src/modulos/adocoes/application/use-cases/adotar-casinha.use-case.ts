import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { MAXIMO_ADOTANTES } from '../../../casinhas/domain/permissoes.js';
import {
  ACESSO_CASINHA,
  type AcessoCasinha,
  CONTROLE_DE_LIMITES,
  type ControleDeLimites,
  VERIFICADOR_DE_PROXIMIDADE,
  type VerificadorDeProximidade,
} from '../../domain/providers/portas.js';
import {
  ADOCOES_REPOSITORY,
  type AdocoesRepository,
} from '../../domain/repositories/adocoes.repository.js';
import type { AdotarDto, ResultadoAdocao } from '../dto/adocoes.dto.js';

/**
 * RF04.1: o criador adota de qualquer lugar; os demais precisam estar a até 100 m da exata.
 * RF04.2: no máximo 3 adotantes ativos. RN06: 3 tentativas por dia, contando as recusadas.
 * A resposta não diz o motivo da recusa: não pode servir para achar a casinha por tentativa.
 */
@Injectable()
export class AdotarCasinhaUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(ADOCOES_REPOSITORY) private readonly adocoes: AdocoesRepository,
    @Inject(ACESSO_CASINHA) private readonly acesso: AcessoCasinha,
    @Inject(VERIFICADOR_DE_PROXIMIDADE) private readonly proximidade: VerificadorDeProximidade,
    @Inject(CONTROLE_DE_LIMITES) private readonly limites: ControleDeLimites,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(usuario: UsuarioLogado, casinhaId: string, dto: AdotarDto): Promise<ResultadoAdocao> {
    return this.transacao.executar(async () => {
      const { criadaPorId } = await this.acesso.travarParaAcao(usuario, casinhaId);

      // Já adota: repetir o pedido não é erro nem gasta tentativa.
      if (await this.adocoes.adotaAtivamente(usuario.id, casinhaId)) return { resultado: 'ok' };

      const agora = this.relogio.agora();
      await this.limites.consumirTentativaDeAdocao(usuario.id, agora);

      const posicao =
        dto.lat !== undefined && dto.lng !== undefined ? { lat: dto.lat, lng: dto.lng } : null;
      const podeAdotar =
        criadaPorId === usuario.id ||
        (await this.proximidade.estaPerto(casinhaId, posicao)) === true;
      const lotada = (await this.adocoes.contarAtivas(casinhaId)) >= MAXIMO_ADOTANTES;
      if (!podeAdotar || lotada) return { resultado: 'nao_permitido' };

      await this.adocoes.adotar(casinhaId, usuario.id, agora);
      return { resultado: 'ok' };
    });
  }
}
