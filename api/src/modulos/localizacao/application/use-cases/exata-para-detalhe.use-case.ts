import { Inject, Injectable } from '@nestjs/common';

import type { Ponto } from '../../../../shared/domain/geo.js';
import { diaAtual } from '../../../../shared/domain/tempo.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { acessoAExata, LIMITE_EXATAS_POR_DIA } from '../../domain/acesso-exata.js';
import type { CasinhaRef } from '../../domain/localizacao.js';
import {
  LOCALIZACAO_REPOSITORY,
  type LocalizacaoRepository,
} from '../../domain/repositories/localizacao.repository.js';

/**
 * Exata para o detalhe de uma casinha, ou `null` se o usuário só pode ver a pública.
 * Para o verificado, gasta 1 da cota diária (casinhas distintas) e registra o acesso.
 */
@Injectable()
export class ExataParaDetalheUseCase {
  constructor(
    @Inject(LOCALIZACAO_REPOSITORY) private readonly repositorio: LocalizacaoRepository,
    @Inject(TRANSACAO) private readonly transacao: Transacao,
  ) {}

  async executar(usuario: UsuarioLogado, casinha: CasinhaRef): Promise<Ponto | null> {
    const adotadas = await this.repositorio.adotadasPor(usuario.id, [casinha.id]);
    const acesso = acessoAExata({
      nivel: usuario.nivel,
      souCriador: casinha.criadaPorId === usuario.id,
      souAdotante: adotadas.has(casinha.id),
    });
    if (acesso === 'negado') return null;
    if (acesso === 'cota_diaria' && !(await this.consumirCota(usuario.id, casinha.id))) return null;
    return (await this.repositorio.exatas([casinha.id])).get(casinha.id) ?? null;
  }

  /** `true` se cabe na cota do dia (rever uma casinha já vista hoje não gasta cota). */
  private consumirCota(usuarioId: string, casinhaId: string): Promise<boolean> {
    const dia = diaAtual();
    return this.transacao.executar(async () => {
      await this.repositorio.travarUsuario(usuarioId);
      if ((await this.repositorio.vistasNoDia(usuarioId, dia, [casinhaId])).size > 0) return true;
      if ((await this.repositorio.contarVistasNoDia(usuarioId, dia)) >= LIMITE_EXATAS_POR_DIA) {
        return false;
      }
      await this.repositorio.registrarVista(usuarioId, casinhaId, dia);
      return true;
    });
  }
}
