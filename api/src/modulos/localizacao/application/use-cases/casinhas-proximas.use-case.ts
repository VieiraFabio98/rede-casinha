import { Inject, Injectable } from '@nestjs/common';

import { distanciaM, type Ponto } from '../../../../shared/domain/geo.js';
import { RAIO_DUPLICATA_M } from '../../domain/localizacao.js';
import {
  LOCALIZACAO_REPOSITORY,
  type LocalizacaoRepository,
} from '../../domain/repositories/localizacao.repository.js';

/** Pré-filtro por caixa: ±0,0005° ≈ 55 m de latitude e ≥ 46 m de longitude no Brasil todo. */
const CAIXA_GRAUS = 0.0005;

/**
 * Casinhas visíveis e não inativas a até 30 m do ponto (RN04), para o cadastro detectar
 * duplicata. Devolve só os ids, nunca a distância nem a exata.
 */
@Injectable()
export class CasinhasProximasUseCase {
  constructor(
    @Inject(LOCALIZACAO_REPOSITORY) private readonly repositorio: LocalizacaoRepository,
  ) {}

  async executar(ponto: Ponto): Promise<string[]> {
    const naCaixa = await this.repositorio.exatasNaCaixa(ponto, CAIXA_GRAUS);
    return naCaixa
      .map((c) => ({ id: c.casinhaId, distancia: distanciaM(ponto, c.ponto) }))
      .filter((c) => c.distancia <= RAIO_DUPLICATA_M)
      .sort((a, b) => a.distancia - b.distancia)
      .map((c) => c.id);
  }
}
