import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
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
import { horaDoCelular } from '../../domain/regras.js';
import type { ReportarNecessidadeDto, ResultadoAcao } from '../dto/necessidades.dto.js';
import { ExecucaoDeAcao, posicaoDe } from './execucao-de-acao.js';

/** "O que está faltando?" (RF03.1). Se o tipo já está aberto, vira "ainda precisa" (RN02). */
@Injectable()
export class ReportarNecessidadeUseCase {
  constructor(
    private readonly execucao: ExecucaoDeAcao,
    @Inject(NECESSIDADES_REPOSITORY) private readonly necessidades: NecessidadesRepository,
    @Inject(ATIVIDADES_REPOSITORY) private readonly atividades: AtividadesRepository,
    @Inject(VERIFICADOR_DE_PROXIMIDADE) private readonly proximidade: VerificadorDeProximidade,
    @Inject(CONTROLE_DE_LIMITES) private readonly limites: ControleDeLimites,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(usuario: UsuarioLogado, dto: ReportarNecessidadeDto): Promise<ResultadoAcao> {
    const posicao = posicaoDe(dto);
    return this.execucao.executar(usuario, dto.casinhaId, dto.id, async () => {
      const agora = this.relogio.agora();
      await this.limites.consumirContribuicao(usuario.id, agora);
      const validadoLocal = await this.proximidade.estaPerto(dto.casinhaId, posicao);
      const noCelular = horaDoCelular(dto.criadaNoCelularEm, agora);
      const expiraEm = prazoExpiracao(dto.tipo, agora);

      // RN02: nunca duas abertas do mesmo tipo. Reportar de novo = reconfirmar (e subir a urgência).
      const aberta = await this.necessidades.buscarAberta(dto.casinhaId, dto.tipo);
      if (aberta) {
        await this.necessidades.atualizar(aberta.id, {
          expiraEm,
          ...(dto.urgencia === 'urgente' && { urgencia: 'urgente' }),
        });
      } else {
        await this.necessidades.criar({
          id: dto.id,
          casinhaId: dto.casinhaId,
          tipo: dto.tipo,
          urgencia: dto.urgencia,
          observacao: dto.observacao,
          criadaPorId: usuario.id,
          criadaEm: agora,
          criadaNoCelularEm: noCelular,
          expiraEm,
          validadoLocal,
        });
      }

      const necessidadeId = aberta?.id ?? dto.id;
      await this.atividades.registrar({
        id: dto.id,
        casinhaId: dto.casinhaId,
        necessidadeId,
        tipo: aberta ? 'reconfirmacao' : 'reporte',
        usuarioId: usuario.id,
        observacao: dto.observacao,
        criadaEm: agora,
        criadaNoCelularEm: noCelular,
        validadoLocal,
      });
      return this.execucao.concluir(
        dto.casinhaId,
        agora,
        aberta ? 'reconfirmada' : 'ok',
        necessidadeId,
      );
    });
  }
}
