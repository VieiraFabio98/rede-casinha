import { Injectable } from '@nestjs/common';

import { ListarParesProximosUseCase } from '../../../localizacao/application/use-cases/listar-pares-proximos.use-case.js';
import { RecalcularStatusUseCase } from '../../../status/application/use-cases/recalcular-status.use-case.js';
import type { BuscaDeDuplicatas, RecalculadorDeStatus } from '../../domain/providers/portas.js';

@Injectable()
export class StatusAdapter implements RecalculadorDeStatus {
  constructor(private readonly recalcularStatus: RecalcularStatusUseCase) {}

  recalcular(casinhaId: string, agora: Date) {
    return this.recalcularStatus.executar(casinhaId, agora);
  }
}

@Injectable()
export class DuplicatasAdapter implements BuscaDeDuplicatas {
  constructor(private readonly listarPares: ListarParesProximosUseCase) {}

  paresProximos() {
    return this.listarPares.executar();
  }
}
