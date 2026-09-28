import { Inject, Injectable } from '@nestjs/common';

import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import { NotFoundError } from '../../../../shared/errors/index.js';
import {
  ARQUIVOS_DE_FOTOS,
  type ArquivosDeFotos,
} from '../../domain/providers/arquivos-de-fotos.provider.js';
import {
  CONTAS_REPOSITORY,
  type ContasRepository,
} from '../../domain/repositories/contas.repository.js';

/**
 * Exclui a conta (RN07, exigência da Google Play). Perfil, sessões (desloga todos os aparelhos),
 * adoções e fotos vão embora; reportes, atendimentos e o resto do histórico ficam, sem autor
 * ("Usuário removido"): o histórico da casinha é de interesse coletivo.
 *
 * Os arquivos das fotos saem depois da transação: se a exclusão for desfeita, as fotos continuam.
 */
@Injectable()
export class ExcluirContaUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(CONTAS_REPOSITORY) private readonly contas: ContasRepository,
    @Inject(ARQUIVOS_DE_FOTOS) private readonly arquivos: ArquivosDeFotos,
  ) {}

  async executar(usuarioId: string): Promise<void> {
    const chaves = await this.transacao.executar(() => this.contas.excluir(usuarioId));
    if (!chaves) throw new NotFoundError('Conta não encontrada');
    await this.arquivos.apagar(chaves);
  }
}
