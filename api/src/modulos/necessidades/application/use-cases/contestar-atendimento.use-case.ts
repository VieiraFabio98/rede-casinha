import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { ConflictError } from '../../../../shared/errors/index.js';
import { prazoExpiracao } from '../../../status/domain/regras.js';
import {
  RECALCULADOR_DE_STATUS,
  type RecalculadorDeStatus,
} from '../../domain/providers/status.provider.js';
import {
  ATIVIDADES_REPOSITORY,
  type AtividadesRepository,
} from '../../domain/repositories/atividades.repository.js';
import {
  NECESSIDADES_REPOSITORY,
  type NecessidadesRepository,
} from '../../domain/repositories/necessidades.repository.js';
import { podeContestar } from '../../domain/regras.js';
import type { ContestarDto, ResultadoAcao } from '../dto/necessidades.dto.js';
import { AcaoNaNecessidade } from './acao-na-necessidade.js';

/** "Não foi resolvido" (RF03.5): reabre até 24 h depois do atendimento (RN03). */
@Injectable()
export class ContestarAtendimentoUseCase {
  constructor(
    private readonly acaoNaNecessidade: AcaoNaNecessidade,
    @Inject(NECESSIDADES_REPOSITORY) private readonly necessidades: NecessidadesRepository,
    @Inject(ATIVIDADES_REPOSITORY) private readonly atividades: AtividadesRepository,
    @Inject(RECALCULADOR_DE_STATUS) private readonly status: RecalculadorDeStatus,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(
    usuario: UsuarioLogado,
    necessidadeId: string,
    dto: ContestarDto,
  ): Promise<ResultadoAcao> {
    return this.acaoNaNecessidade.executar(usuario, necessidadeId, dto.atividadeId, async (n) => {
      const agora = this.relogio.agora();
      if (!podeContestar(n, agora)) {
        throw new ConflictError(
          'Só dá para contestar até 24 h depois do atendimento.',
          'fora_do_prazo',
        );
      }
      // Se alguém já reportou de novo o mesmo tipo, aquela fica valendo: só registra a contestação.
      if (!(await this.necessidades.buscarAberta(n.casinhaId, n.tipo))) {
        await this.necessidades.atualizar(necessidadeId, {
          status: 'aberta',
          atendidaPorId: null,
          atendidaEm: null,
          expiraEm: prazoExpiracao(n.tipo, agora),
        });
      }
      await this.atividades.registrar({
        id: dto.atividadeId,
        casinhaId: n.casinhaId,
        necessidadeId,
        tipo: 'contestacao',
        usuarioId: usuario.id,
        observacao: dto.observacao,
        criadaEm: agora,
      });
      // Contestar não é "passar pela casinha": não mexe na última atividade.
      const status = await this.status.recalcular(n.casinhaId, agora);
      return { resultado: 'ok', necessidadeId, status };
    });
  }
}
