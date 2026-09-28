import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { NotFoundError } from '../../../../shared/errors/index.js';
import {
  AUDITORIA_REPOSITORY,
  type AuditoriaRepository,
} from '../../domain/repositories/auditoria.repository.js';
import {
  DENUNCIAS_MODERACAO_REPOSITORY,
  type DenunciasModeracaoRepository,
} from '../../domain/repositories/denuncias.repository.js';
import type { FeitoResposta } from '../dto/moderacao.dto.js';

/** Fecha uma denúncia avulsa (procedente ou não), sem mexer no alvo. */
@Injectable()
export class ResolverDenunciaUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(DENUNCIAS_MODERACAO_REPOSITORY)
    private readonly denuncias: DenunciasModeracaoRepository,
    @Inject(AUDITORIA_REPOSITORY) private readonly auditoria: AuditoriaRepository,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(
    moderador: UsuarioLogado,
    id: string,
    procedente: boolean,
    motivo?: string,
  ): Promise<FeitoResposta> {
    return this.transacao.executar(async () => {
      if (!(await this.denuncias.existe(id))) throw new NotFoundError('Denúncia não encontrada');
      await this.denuncias.resolver(id, procedente, moderador.id, this.relogio.agora());
      await this.auditoria.registrar({
        moderadorId: moderador.id,
        acao: procedente ? 'denuncia_procedente' : 'denuncia_improcedente',
        alvoTipo: 'denuncia',
        alvoId: id,
        motivo,
      });
      return { resultado: 'ok' };
    });
  }
}
