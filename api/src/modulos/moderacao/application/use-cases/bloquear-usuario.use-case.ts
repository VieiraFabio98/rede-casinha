import { Inject, Injectable } from '@nestjs/common';

import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import {
  AUDITORIA_REPOSITORY,
  type AuditoriaRepository,
} from '../../domain/repositories/auditoria.repository.js';
import {
  USUARIOS_MODERACAO_REPOSITORY,
  type UsuariosModeracaoRepository,
} from '../../domain/repositories/usuarios-moderacao.repository.js';
import type { FeitoResposta } from '../dto/moderacao.dto.js';
import { exigirUsuarioModeravel } from './usuario-alvo.js';

/** `ate = null` desbloqueia. Bloqueado não faz nenhuma ação nem vê o mapa (D01). */
@Injectable()
export class BloquearUsuarioUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(USUARIOS_MODERACAO_REPOSITORY) private readonly usuarios: UsuariosModeracaoRepository,
    @Inject(AUDITORIA_REPOSITORY) private readonly auditoria: AuditoriaRepository,
  ) {}

  executar(
    moderador: UsuarioLogado,
    usuarioId: string,
    ate: Date | null,
    motivo: string,
  ): Promise<FeitoResposta> {
    return this.transacao.executar(async () => {
      await exigirUsuarioModeravel(this.usuarios, moderador, usuarioId);
      await this.usuarios.bloquear(usuarioId, ate);
      await this.auditoria.registrar({
        moderadorId: moderador.id,
        acao: ate ? 'bloquear' : 'desbloquear',
        alvoTipo: 'perfil',
        alvoId: usuarioId,
        motivo: ate ? `até ${ate.toISOString()}: ${motivo}` : motivo,
      });
      return { resultado: 'ok' };
    });
  }
}
