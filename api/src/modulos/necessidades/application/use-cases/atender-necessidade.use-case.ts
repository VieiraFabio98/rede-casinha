import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import {
  CONTROLE_DE_LIMITES,
  type ControleDeLimites,
} from '../../domain/providers/limites.provider.js';
import {
  VERIFICADOR_DE_PROXIMIDADE,
  type VerificadorDeProximidade,
} from '../../domain/providers/proximidade.provider.js';
import {
  ATIVIDADES_REPOSITORY,
  type AtividadesRepository,
} from '../../domain/repositories/atividades.repository.js';
import {
  NECESSIDADES_REPOSITORY,
  type NecessidadesRepository,
} from '../../domain/repositories/necessidades.repository.js';
import { atendimentoValeParaStatus, horaDoCelular } from '../../domain/regras.js';
import type { AtenderDto, ResultadoAcao } from '../dto/necessidades.dto.js';
import { AcaoNaNecessidade } from './acao-na-necessidade.js';
import { ExecucaoDeAcao, posicaoDe } from './execucao-de-acao.js';

/** "Abasteci" / "Atendi" (RF03.2). Se alguém resolveu antes, devolve `ja_atendida` (RN03). */
@Injectable()
export class AtenderNecessidadeUseCase {
  constructor(
    private readonly acaoNaNecessidade: AcaoNaNecessidade,
    private readonly execucao: ExecucaoDeAcao,
    @Inject(NECESSIDADES_REPOSITORY) private readonly necessidades: NecessidadesRepository,
    @Inject(ATIVIDADES_REPOSITORY) private readonly atividades: AtividadesRepository,
    @Inject(VERIFICADOR_DE_PROXIMIDADE) private readonly proximidade: VerificadorDeProximidade,
    @Inject(CONTROLE_DE_LIMITES) private readonly limites: ControleDeLimites,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(usuario: UsuarioLogado, necessidadeId: string, dto: AtenderDto): Promise<ResultadoAcao> {
    const posicao = posicaoDe(dto);
    return this.acaoNaNecessidade.executar(usuario, necessidadeId, dto.atividadeId, async (n) => {
      const agora = this.relogio.agora();
      await this.limites.consumirContribuicao(usuario.id, agora);
      const validadoLocal = await this.proximidade.estaPerto(n.casinhaId, posicao);

      const vale = atendimentoValeParaStatus(n.status);
      if (vale) {
        await this.necessidades.atualizar(necessidadeId, {
          status: 'atendida',
          atendidaPorId: usuario.id,
          atendidaEm: agora,
        });
      }
      await this.atividades.registrar({
        id: dto.atividadeId,
        casinhaId: n.casinhaId,
        necessidadeId,
        tipo: 'atendimento',
        usuarioId: usuario.id,
        observacao: dto.observacao,
        criadaEm: agora,
        criadaNoCelularEm: horaDoCelular(dto.criadaNoCelularEm, agora),
        validadoLocal,
      });
      return this.execucao.concluir(n.casinhaId, agora, vale ? 'ok' : 'ja_atendida', necessidadeId);
    });
  }
}
