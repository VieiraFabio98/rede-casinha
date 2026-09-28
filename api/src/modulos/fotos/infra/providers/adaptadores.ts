import { Injectable } from '@nestjs/common';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { TravarCasinhaParaAcaoUseCase } from '../../../casinhas/application/use-cases/travar-casinha-para-acao.use-case.js';
import { ConsumirLimiteUseCase } from '../../../limites/application/use-cases/consumir-limite.use-case.js';
import type { AcessoCasinha, ControleDeLimites } from '../../domain/providers/portas.js';

@Injectable()
export class AcessoCasinhaAdapter implements AcessoCasinha {
  constructor(private readonly travarCasinha: TravarCasinhaParaAcaoUseCase) {}

  travarParaAcao(usuario: UsuarioLogado, casinhaId: string) {
    return this.travarCasinha.executar(usuario, casinhaId);
  }
}

@Injectable()
export class LimitesAdapter implements ControleDeLimites {
  constructor(private readonly consumirLimite: ConsumirLimiteUseCase) {}

  consumirEnvioDeFoto(usuarioId: string, agora: Date) {
    return this.consumirLimite.executar(usuarioId, 'fotos', agora);
  }
}
