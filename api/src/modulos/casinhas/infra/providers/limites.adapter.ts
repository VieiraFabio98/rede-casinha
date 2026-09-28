import { Injectable } from '@nestjs/common';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { ConsumirLimiteUseCase } from '../../../limites/application/use-cases/consumir-limite.use-case.js';
import { limiteDeCadastros } from '../../domain/cadastro.js';
import type { ControleDeLimites } from '../../domain/providers/limites.provider.js';

@Injectable()
export class LimitesAdapter implements ControleDeLimites {
  constructor(private readonly consumirLimite: ConsumirLimiteUseCase) {}

  consumirCadastro(usuario: UsuarioLogado, agora: Date) {
    return this.consumirLimite.executar(
      usuario.id,
      'cadastros',
      agora,
      limiteDeCadastros(usuario.nivel),
    );
  }

  consumirDuplicata(usuarioId: string, agora: Date) {
    return this.consumirLimite.executar(usuarioId, 'duplicatas', agora);
  }
}
