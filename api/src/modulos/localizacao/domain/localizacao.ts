/** Distância máxima para uma ação contar como feita no local (adoção, reporte, atendimento). */
export const RAIO_PROXIMIDADE_M = 100;

/** RN04: casinhas a até 30 m provavelmente são a mesma. */
export const RAIO_DUPLICATA_M = 30;

/** O mínimo da casinha para decidir o acesso à exata. */
export interface CasinhaRef {
  id: string;
  criadaPorId: string | null;
}

/** Duas casinhas perto demais uma da outra (possível duplicata), com a distância em metros. */
export interface ParProximo {
  a: string;
  b: string;
  distanciaM: number;
}
