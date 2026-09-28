import { Inject, Injectable } from '@nestjs/common';

import type { Ponto } from '../../../../shared/domain/geo.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { BadRequest, ConflictError } from '../../../../shared/errors/index.js';
import {
  ACESSO_CASINHA,
  type AcessoCasinha,
} from '../../domain/providers/acesso-casinha.provider.js';
import {
  RECALCULADOR_DE_STATUS,
  type RecalculadorDeStatus,
} from '../../domain/providers/status.provider.js';
import {
  ATIVIDADES_REPOSITORY,
  type AtividadesRepository,
} from '../../domain/repositories/atividades.repository.js';
import {
  CASINHAS_REPOSITORY,
  type CasinhasRepository,
} from '../../domain/repositories/casinhas.repository.js';
import type { Resultado, ResultadoAcao } from '../dto/necessidades.dto.js';

/** Posição opcional de quem age: as duas coordenadas ou nenhuma. */
export function posicaoDe(dto: { lat?: number; lng?: number }): Ponto | null {
  if (dto.lat === undefined && dto.lng === undefined) return null;
  if (dto.lat === undefined || dto.lng === undefined) {
    throw new BadRequest('Mande lat e lng juntos (ou nenhum dos dois)');
  }
  return { lat: dto.lat, lng: dto.lng };
}

/**
 * O roteiro comum das ações numa casinha:
 * - tudo numa transação;
 * - trava a casinha (ações simultâneas nela viram uma fila) e confere se o usuário pode agir;
 * - reenvio da fila offline (mesmo id de atividade) devolve sucesso sem repetir o efeito.
 */
@Injectable()
export class ExecucaoDeAcao {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(ACESSO_CASINHA) private readonly acesso: AcessoCasinha,
    @Inject(ATIVIDADES_REPOSITORY) private readonly atividades: AtividadesRepository,
    @Inject(CASINHAS_REPOSITORY) private readonly casinhas: CasinhasRepository,
    @Inject(RECALCULADOR_DE_STATUS) private readonly status: RecalculadorDeStatus,
  ) {}

  executar(
    usuario: UsuarioLogado,
    casinhaId: string,
    atividadeId: string,
    acao: () => Promise<ResultadoAcao>,
  ): Promise<ResultadoAcao> {
    return this.transacao.executar(async () => {
      await this.acesso.travarParaAcao(usuario, casinhaId);
      const repetida = await this.atividades.buscarPorId(atividadeId);
      if (repetida) {
        if (repetida.usuarioId !== usuario.id) throw new ConflictError('Id já usado', 'id_em_uso');
        return this.responder(casinhaId, 'ok', repetida.necessidadeId);
      }
      return acao();
    });
  }

  /** Fecha uma ação que conta como "alguém passou pela casinha" (RN01: última atividade). */
  async concluir(
    casinhaId: string,
    agora: Date,
    resultado: Resultado,
    necessidadeId: string | null,
  ): Promise<ResultadoAcao> {
    await this.casinhas.registrarVisita(casinhaId, agora);
    const status = await this.status.recalcular(casinhaId, agora);
    return { resultado, necessidadeId, status };
  }

  /** Resposta sem mudar nada (reenvio, "já reconfirmada"). */
  async responder(
    casinhaId: string,
    resultado: Resultado,
    necessidadeId: string | null,
  ): Promise<ResultadoAcao> {
    return { resultado, necessidadeId, status: await this.casinhas.statusAtual(casinhaId) };
  }
}
