import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import type { Area } from '@/api/tipos';

/** Abaixo deste zoom (visão de região/estado) o mapa não busca casinhas: pede para aproximar. */
export const ZOOM_MINIMO_CASINHAS = 9;

/**
 * Grade de ~2 km (0,02° de latitude). A área pedida à API é a vista arredondada para fora
 * até a grade: pequenos arrastos reaproveitam a mesma consulta (e o mesmo cache offline).
 */
const GRADE_GRAUS = 0.02;

const paraBaixo = (grau: number) => Math.floor(grau / GRADE_GRAUS) * GRADE_GRAUS;
const paraCima = (grau: number) => Math.ceil(grau / GRADE_GRAUS) * GRADE_GRAUS;
/** Evita chaves diferentes por ruído de ponto flutuante (0.060000000000000005). */
const limpar = (grau: number) => Number(grau.toFixed(4));

/** Área a buscar para a vista do mapa, ou `null` se o zoom está baixo demais. */
export function areaDaVista(limites: LngLatBounds, zoom: number): Area | null {
  if (zoom < ZOOM_MINIMO_CASINHAS) return null;
  const [oeste, sul, leste, norte] = limites;
  return {
    minLat: limpar(Math.max(-90, paraBaixo(sul))),
    maxLat: limpar(Math.min(90, paraCima(norte))),
    minLng: limpar(Math.max(-180, paraBaixo(oeste))),
    maxLng: limpar(Math.min(180, paraCima(leste))),
  };
}
