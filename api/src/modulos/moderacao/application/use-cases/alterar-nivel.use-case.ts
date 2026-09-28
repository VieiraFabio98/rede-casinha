import { Inject, Injectable } from '@nestjs/common';

import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import {
  type NivelAcesso,
  ORDEM_NIVEL,
  type UsuarioLogado,
} from '../../../../shared/domain/usuario-logado.js';
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

/** Promover a verificado exige moderador; criar ou mexer em moderador e admin, só admin. */
@Injectable()
export class AlterarNivelUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(USUARIOS_MODERACAO_REPOSITORY) private readonly usuarios: UsuariosModeracaoRepository,
    @Inject(AUDITORIA_REPOSITORY) private readonly auditoria: AuditoriaRepository,
  ) {}

  executar(
    moderador: UsuarioLogado,
    usuarioId: string,
    nivel: NivelAcesso,
    motivo: string,
  ): Promise<FeitoResposta> {
    return this.transacao.executar(async () => {
      const alvo = await exigirUsuarioModeravel(this.usuarios, moderador, usuarioId, nivel);
      const verificado = ORDEM_NIVEL[nivel] >= ORDEM_NIVEL.verificado;
      await this.usuarios.alterarNivel(
        usuarioId,
        nivel,
        verificado ? (alvo.verificadoPorId ?? moderador.id) : null,
      );
      await this.auditoria.registrar({
        moderadorId: moderador.id,
        acao: `nivel:${nivel}`,
        alvoTipo: 'perfil',
        alvoId: usuarioId,
        motivo,
      });
      return { resultado: 'ok' };
    });
  }
}
