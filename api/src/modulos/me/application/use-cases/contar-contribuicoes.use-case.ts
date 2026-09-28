import { Inject, Injectable } from '@nestjs/common';

import {
  CONTAS_REPOSITORY,
  type ContasRepository,
} from '../../domain/repositories/contas.repository.js';
import type { ContagensResposta } from '../dto/me.dto.js';

/** Contagens da tela de perfil. */
@Injectable()
export class ContarContribuicoesUseCase {
  constructor(@Inject(CONTAS_REPOSITORY) private readonly contas: ContasRepository) {}

  executar(usuarioId: string): Promise<ContagensResposta> {
    return this.contas.contagens(usuarioId);
  }
}
