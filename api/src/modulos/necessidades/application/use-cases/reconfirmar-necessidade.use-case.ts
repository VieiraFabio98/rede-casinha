import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { ConflictError } from '../../../../shared/errors/index.js';
import { prazoExpiracao } from '../../../status/domain/regras.js';
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
import { horaDoCelular, INTERVALO_RECONFIRMACAO_MS } from '../../domain/regras.js';
import type { AcaoDto, ResultadoAcao } from '../dto/necessidades.dto.js';
import { AcaoNaNecessidade } from './acao-na-necessidade.js';
import { ExecucaoDeAcao, posicaoDe } from './execucao-de-acao.js';

/** "Ainda precisa" (RF03.4): renova o prazo. 1 vez a cada 12 h por usuário (RN02). */
@Injectable()
export class ReconfirmarNecessidadeUseCase {
  constructor(
    private readonly acaoNaNecessidade: AcaoNaNecessidade,
    private readonly execucao: ExecucaoDeAcao,
    @Inject(NECESSIDADES_REPOSITORY) private readonly necessidades: NecessidadesRepository,
    @Inject(ATIVIDADES_REPOSITORY) private readonly atividades: AtividadesRepository,
    @Inject(VERIFICADOR_DE_PROXIMIDADE) private readonly proximidade: VerificadorDeProximidade,
    @Inject(CONTROLE_DE_LIMITES) private readonly limites: ControleDeLimites,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(usuario: UsuarioLogado, necessidadeId: string, dto: AcaoDto): Promise<ResultadoAcao> {
    const posicao = posicaoDe(dto);
    return this.acaoNaNecessidade.executar(usuario, necessidadeId, dto.atividadeId, async (n) => {
      if (n.status !== 'aberta') {
        throw new ConflictError('Este pedido já foi resolvido ou expirou.', 'necessidade_fechada');
      }
      const agora = this.relogio.agora();
      const recente = await this.atividades.existeDoUsuarioDesde({
        necessidadeId,
        usuarioId: usuario.id,
        tipos: ['reporte', 'reconfirmacao'],
        desde: new Date(agora.getTime() - INTERVALO_RECONFIRMACAO_MS),
      });
      // Já confirmou há pouco: não renova de novo nem conta no limite (não é um erro).
      if (recente) return this.execucao.responder(n.casinhaId, 'ja_reconfirmada', necessidadeId);

      await this.limites.consumirContribuicao(usuario.id, agora);
      const validadoLocal = await this.proximidade.estaPerto(n.casinhaId, posicao);
      await this.necessidades.atualizar(necessidadeId, { expiraEm: prazoExpiracao(n.tipo, agora) });
      await this.atividades.registrar({
        id: dto.atividadeId,
        casinhaId: n.casinhaId,
        necessidadeId,
        tipo: 'reconfirmacao',
        usuarioId: usuario.id,
        criadaEm: agora,
        criadaNoCelularEm: horaDoCelular(dto.criadaNoCelularEm, agora),
        validadoLocal,
      });
      return this.execucao.concluir(n.casinhaId, agora, 'ok', necessidadeId);
    });
  }
}
