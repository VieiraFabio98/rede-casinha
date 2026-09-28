/** Foto grande e miniatura (RNF04): ~120 KB e ~25 KB com JPEG 0,7. */
export const LADO_FOTO = 1024;
export const LADO_MINIATURA = 320;
export const QUALIDADE_JPEG = 0.7;

/**
 * Redimensionamento que limita o lado maior a `ladoMaximo`, sem ampliar foto pequena.
 * Só um lado é informado: o manipulador calcula o outro mantendo a proporção.
 */
export function redimensionamento(
  largura: number,
  altura: number,
  ladoMaximo: number,
): { width: number } | { height: number } {
  return largura >= altura
    ? { width: Math.min(largura, ladoMaximo) }
    : { height: Math.min(altura, ladoMaximo) };
}

/** Fotos de perfil por casinha (a API recusa a sexta). */
export const MAXIMO_FOTOS_DA_CASINHA = 5;
