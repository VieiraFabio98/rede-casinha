import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { BadRequest, NotFoundError } from '../../../../shared/errors/index.js';
import { MAXIMO_ADOTANTES } from '../../../casinhas/domain/permissoes.js';
import {
  RECALCULADOR_DE_STATUS,
  type RecalculadorDeStatus,
} from '../../domain/providers/portas.js';
import {
  AUDITORIA_REPOSITORY,
  type AuditoriaRepository,
} from '../../domain/repositories/auditoria.repository.js';
import {
  CASINHAS_MODERACAO_REPOSITORY,
  type CasinhasModeracaoRepository,
} from '../../domain/repositories/casinhas-moderacao.repository.js';
import type { FeitoResposta } from '../dto/moderacao.dto.js';

/**
 * Duplicata (RF02.8): leva histórico, fotos, necessidades e adotantes da origem para o destino e
 * desativa a origem. Necessidade aberta que o destino já tem do mesmo tipo é cancelada; adotante
 * que já adota o destino, ou que passaria de 3, tem a adoção da origem encerrada.
 */
@Injectable()
export class MesclarCasinhasUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(CASINHAS_MODERACAO_REPOSITORY) private readonly casinhas: CasinhasModeracaoRepository,
    @Inject(AUDITORIA_REPOSITORY) private readonly auditoria: AuditoriaRepository,
    @Inject(RECALCULADOR_DE_STATUS) private readonly status: RecalculadorDeStatus,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(
    moderador: UsuarioLogado,
    origemId: string,
    destinoId: string,
    motivo: string,
  ): Promise<FeitoResposta> {
    if (origemId === destinoId) {
      throw new BadRequest('Origem e destino são a mesma casinha');
    }
    return this.transacao.executar(async () => {
      if (!(await this.casinhas.travar(origemId, destinoId))) {
        throw new NotFoundError('Casinha não encontrada');
      }
      const [origem, destino] = await Promise.all([
        this.casinhas.situacaoEUltimaAtividade(origemId),
        this.casinhas.situacaoEUltimaAtividade(destinoId),
      ]);
      if (destino.situacao === 'inativa') throw new BadRequest('O destino está desativado');
      const agora = this.relogio.agora();

      // Uma aberta por tipo (RN02): a da origem sai se o destino já tem.
      const tiposNoDestino = new Set(
        (await this.casinhas.necessidadesAbertas(destinoId)).map((n) => n.tipo),
      );
      for (const n of await this.casinhas.necessidadesAbertas(origemId)) {
        if (tiposNoDestino.has(n.tipo)) await this.casinhas.cancelarNecessidade(n.id);
      }

      // Até 3 adotantes (RF04.2): quem já adota o destino, ou não cabe, tem a adoção encerrada.
      const doDestino = await this.casinhas.adotantesAtivos(destinoId);
      const jaAdotam = new Set(doDestino.map((a) => a.usuarioId));
      let vagas = MAXIMO_ADOTANTES - doDestino.length;
      for (const a of await this.casinhas.adotantesAtivos(origemId)) {
        if (!jaAdotam.has(a.usuarioId) && vagas > 0) {
          vagas--;
          continue;
        }
        await this.casinhas.encerrarAdocao(a.id, agora);
      }

      await this.casinhas.moverTudo(origemId, destinoId);
      await this.casinhas.marcarMesclada(origemId, destinoId);
      if (origem.ultimaAtividadeEm > destino.ultimaAtividadeEm) {
        await this.casinhas.definirUltimaAtividade(destinoId, origem.ultimaAtividadeEm);
      }
      await this.status.recalcular(destinoId, agora);
      await this.auditoria.registrar({
        moderadorId: moderador.id,
        acao: 'mesclar',
        alvoTipo: 'casinha',
        alvoId: origemId,
        motivo: `→ ${destinoId}: ${motivo}`,
      });
      return { resultado: 'ok' };
    });
  }
}
