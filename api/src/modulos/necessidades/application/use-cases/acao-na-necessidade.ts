import { Inject, Injectable } from '@nestjs/common';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { NotFoundError } from '../../../../shared/errors/index.js';
import type { Necessidade } from '../../domain/entities/necessidade.js';
import {
  NECESSIDADES_REPOSITORY,
  type NecessidadesRepository,
} from '../../domain/repositories/necessidades.repository.js';
import type { ResultadoAcao } from '../dto/necessidades.dto.js';
import { ExecucaoDeAcao } from './execucao-de-acao.js';

/**
 * Ações sobre uma necessidade (reconfirmar, atender, contestar): acha a casinha dela, segue o
 * roteiro comum e entrega a necessidade RELIDA depois da trava, que é o estado que vale.
 */
@Injectable()
export class AcaoNaNecessidade {
  constructor(
    private readonly execucao: ExecucaoDeAcao,
    @Inject(NECESSIDADES_REPOSITORY) private readonly necessidades: NecessidadesRepository,
  ) {}

  async executar(
    usuario: UsuarioLogado,
    necessidadeId: string,
    atividadeId: string,
    acao: (necessidade: Necessidade) => Promise<ResultadoAcao>,
  ): Promise<ResultadoAcao> {
    const alvo = await this.necessidades.buscarPorId(necessidadeId);
    if (!alvo) throw new NotFoundError('Pedido não encontrado');
    return this.execucao.executar(usuario, alvo.casinhaId, atividadeId, async () =>
      acao((await this.necessidades.buscarPorId(necessidadeId))!),
    );
  }
}
