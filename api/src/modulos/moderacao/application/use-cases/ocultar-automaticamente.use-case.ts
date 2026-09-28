import { Inject, Injectable } from '@nestjs/common';

import type { Alvo } from '../../domain/entities/denuncia.js';
import {
  RECALCULADOR_DE_STATUS,
  type RecalculadorDeStatus,
} from '../../domain/providers/portas.js';
import {
  AUDITORIA_REPOSITORY,
  type AuditoriaRepository,
} from '../../domain/repositories/auditoria.repository.js';
import {
  CONTEUDO_REPOSITORY,
  type ConteudoRepository,
} from '../../domain/repositories/conteudo.repository.js';

/**
 * Ocultação automática por denúncias (RF06.2), chamada pelo módulo `denuncias` na transação dele.
 * Só age se o alvo ainda estava visível; perfil nunca é ocultado sozinho.
 */
@Injectable()
export class OcultarAutomaticamenteUseCase {
  constructor(
    @Inject(CONTEUDO_REPOSITORY) private readonly conteudo: ConteudoRepository,
    @Inject(AUDITORIA_REPOSITORY) private readonly auditoria: AuditoriaRepository,
    @Inject(RECALCULADOR_DE_STATUS) private readonly status: RecalculadorDeStatus,
  ) {}

  async executar(alvo: Alvo, casinhaId: string | null, agora: Date): Promise<void> {
    if (alvo.alvoTipo === 'perfil') return;
    if (!(await this.conteudo.ocultar(alvo, true))) return;
    await this.auditoria.registrar({ moderadorId: null, acao: 'ocultar_auto', ...alvo });
    if (alvo.alvoTipo === 'necessidade' && casinhaId) {
      await this.status.recalcular(casinhaId, agora);
    }
  }
}
