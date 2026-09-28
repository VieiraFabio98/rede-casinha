import { Inject, Injectable } from '@nestjs/common';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { ConflictError, NotFoundError } from '../../../../shared/errors/index.js';
import {
  CASINHAS_REPOSITORY,
  type CasinhasRepository,
} from '../../domain/repositories/casinhas.repository.js';
import { acessoACasinha } from '../../domain/visibilidade.js';

/**
 * Toda escrita do app numa casinha começa aqui: trava a casinha até o fim da transação (ações
 * simultâneas nela viram uma fila) e confere se o usuário pode agir nela.
 * Roda na transação de quem chama. Devolve o criador (a adoção precisa dele).
 */
@Injectable()
export class TravarCasinhaParaAcaoUseCase {
  constructor(@Inject(CASINHAS_REPOSITORY) private readonly casinhas: CasinhasRepository) {}

  async executar(
    usuario: UsuarioLogado,
    casinhaId: string,
  ): Promise<{ criadaPorId: string | null }> {
    const casinha = await this.casinhas.travarParaAcao(casinhaId);
    if (!casinha) throw new NotFoundError('Casinha não encontrada');
    // Só consulta a adoção quando faz diferença (casinha oculta).
    const souAdotante =
      casinha.moderacao !== 'visivel' &&
      (await this.casinhas.adotaAtivamente(usuario.id, casinhaId));
    const acesso = acessoACasinha(casinha, usuario, souAdotante);
    if (acesso === 'inativa') {
      throw new ConflictError('Esta casinha foi desativada.', 'casinha_inativa');
    }
    if (acesso === 'oculta') throw new NotFoundError('Casinha não encontrada');
    return { criadaPorId: casinha.criadaPorId };
  }
}
