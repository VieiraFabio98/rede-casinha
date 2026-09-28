import { randomInt } from 'node:crypto';

import { destino, type Ponto } from '../../../shared/domain/geo.js';

/** Deslocamento da localização pública em relação à exata (RN05). */
export const DESLOCAMENTO_MIN_M = 150;
export const DESLOCAMENTO_MAX_M = 400;

const RESOLUCAO = 1_000_000;

/** Número em [0, 1) de um gerador criptográfico: o sorteio não pode ser previsível. */
const sorteioSeguro = () => randomInt(RESOLUCAO) / RESOLUCAO;

/**
 * Localização pública: a exata deslocada de 150 a 400 m numa direção aleatória.
 * Chamada UMA vez, no cadastro (e de novo só se a exata mudar mais de 30 m): sortear a cada
 * consulta permitiria achar a exata tirando a média de várias respostas.
 */
export function gerarLocalizacaoPublica(
  exata: Ponto,
  sortear: () => number = sorteioSeguro,
): Ponto {
  const distancia = DESLOCAMENTO_MIN_M + sortear() * (DESLOCAMENTO_MAX_M - DESLOCAMENTO_MIN_M);
  return destino(exata, distancia, sortear() * 360);
}
