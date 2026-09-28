import { Injectable } from '@nestjs/common';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { TravarCasinhaParaAcaoUseCase } from '../../../casinhas/application/use-cases/travar-casinha-para-acao.use-case.js';
import { ConsumirLimiteUseCase } from '../../../limites/application/use-cases/consumir-limite.use-case.js';
import { OcultarAutomaticamenteUseCase } from '../../../moderacao/application/use-cases/ocultar-automaticamente.use-case.js';
import type { Alvo } from '../../../moderacao/domain/entities/denuncia.js';
import type {
  AcessoCasinha,
  ControleDeLimites,
  OcultacaoAutomatica,
} from '../../domain/providers/portas.js';

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

  consumirDenuncia(usuarioId: string, agora: Date) {
    return this.consumirLimite.executar(usuarioId, 'denuncias', agora);
  }
}

@Injectable()
export class OcultacaoAdapter implements OcultacaoAutomatica {
  constructor(private readonly ocultarAutomaticamente: OcultarAutomaticamenteUseCase) {}

  ocultar(alvo: Alvo, casinhaId: string | null, agora: Date) {
    return this.ocultarAutomaticamente.executar(alvo, casinhaId, agora);
  }
}
