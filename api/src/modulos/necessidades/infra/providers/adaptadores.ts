import { Injectable } from '@nestjs/common';

import type { Ponto } from '../../../../shared/domain/geo.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { TravarCasinhaParaAcaoUseCase } from '../../../casinhas/application/use-cases/travar-casinha-para-acao.use-case.js';
import { ConsumirLimiteUseCase } from '../../../limites/application/use-cases/consumir-limite.use-case.js';
import { VerificarProximidadeUseCase } from '../../../localizacao/application/use-cases/verificar-proximidade.use-case.js';
import { RecalcularStatusUseCase } from '../../../status/application/use-cases/recalcular-status.use-case.js';
import type { AcessoCasinha } from '../../domain/providers/acesso-casinha.provider.js';
import type { ControleDeLimites } from '../../domain/providers/limites.provider.js';
import type { VerificadorDeProximidade } from '../../domain/providers/proximidade.provider.js';
import type { RecalculadorDeStatus } from '../../domain/providers/status.provider.js';

// Adaptadores das portas do domínio para os use-cases dos outros módulos. Todos rodam na
// transação em curso (a `Transacao` é compartilhada via AsyncLocalStorage).

@Injectable()
export class AcessoCasinhaAdapter implements AcessoCasinha {
  constructor(private readonly travarCasinha: TravarCasinhaParaAcaoUseCase) {}

  async travarParaAcao(usuario: UsuarioLogado, casinhaId: string) {
    await this.travarCasinha.executar(usuario, casinhaId);
  }
}

@Injectable()
export class ProximidadePelaLocalizacao implements VerificadorDeProximidade {
  constructor(private readonly verificarProximidade: VerificarProximidadeUseCase) {}

  estaPerto(casinhaId: string, posicao: Ponto | null) {
    return this.verificarProximidade.executar(casinhaId, posicao);
  }
}

@Injectable()
export class StatusPeloModuloStatus implements RecalculadorDeStatus {
  constructor(private readonly recalcularStatus: RecalcularStatusUseCase) {}

  recalcular(casinhaId: string, agora: Date) {
    return this.recalcularStatus.executar(casinhaId, agora);
  }
}

@Injectable()
export class LimitesPeloModuloLimites implements ControleDeLimites {
  constructor(private readonly consumirLimite: ConsumirLimiteUseCase) {}

  consumirContribuicao(usuarioId: string, agora: Date) {
    return this.consumirLimite.executar(usuarioId, 'contribuicoes', agora);
  }
}
