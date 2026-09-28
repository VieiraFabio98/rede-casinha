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
import { horaDoCelular } from '../../domain/regras.js';
import type { AcaoDto, ResultadoAcao } from '../dto/necessidades.dto.js';
import { ExecucaoDeAcao, posicaoDe } from './execucao-de-acao.js';

/** "Passei aqui, tudo ok" (RF03.3). */
@Injectable()
export class FazerCheckInUseCase {
  constructor(
    private readonly execucao: ExecucaoDeAcao,
    @Inject(ATIVIDADES_REPOSITORY) private readonly atividades: AtividadesRepository,
    @Inject(VERIFICADOR_DE_PROXIMIDADE) private readonly proximidade: VerificadorDeProximidade,
    @Inject(CONTROLE_DE_LIMITES) private readonly limites: ControleDeLimites,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(usuario: UsuarioLogado, casinhaId: string, dto: AcaoDto): Promise<ResultadoAcao> {
    const posicao = posicaoDe(dto);
    return this.execucao.executar(usuario, casinhaId, dto.atividadeId, async () => {
      const agora = this.relogio.agora();
      await this.limites.consumirContribuicao(usuario.id, agora);
      await this.atividades.registrar({
        id: dto.atividadeId,
        casinhaId,
        tipo: 'check_in',
        usuarioId: usuario.id,
        criadaEm: agora,
        criadaNoCelularEm: horaDoCelular(dto.criadaNoCelularEm, agora),
        validadoLocal: await this.proximidade.estaPerto(casinhaId, posicao),
      });
      return this.execucao.concluir(casinhaId, agora, 'ok', null);
    });
  }
}
