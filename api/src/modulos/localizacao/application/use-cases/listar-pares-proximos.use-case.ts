import { Inject, Injectable } from '@nestjs/common';

import { distanciaM } from '../../../../shared/domain/geo.js';
import { type ParProximo, RAIO_DUPLICATA_M } from '../../domain/localizacao.js';
import {
  LOCALIZACAO_REPOSITORY,
  type LocalizacaoRepository,
} from '../../domain/repositories/localizacao.repository.js';

/**
 * Pares de casinhas não inativas a até 30 m uma da outra (possíveis duplicatas), para a fila de
 * moderação. Só moderadores chegam aqui: para eles, a distância é informação de trabalho.
 */
@Injectable()
export class ListarParesProximosUseCase {
  constructor(
    @Inject(LOCALIZACAO_REPOSITORY) private readonly repositorio: LocalizacaoRepository,
  ) {}

  async executar(raioM = RAIO_DUPLICATA_M, limite = 100): Promise<ParProximo[]> {
    // Pré-filtro por caixa em graus; 1° ≈ 111 km de latitude, daí raio/100 000 com folga.
    const candidatos = await this.repositorio.candidatosProximos(raioM / 100_000, limite * 5);
    return candidatos
      .map((p) => ({ a: p.a, b: p.b, distanciaM: Math.round(distanciaM(p.pontoA, p.pontoB)) }))
      .filter((p) => p.distanciaM <= raioM)
      .slice(0, limite);
  }
}
