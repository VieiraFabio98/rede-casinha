export interface Ponto {
  lat: number;
  lng: number;
}

const RAIO_TERRA_M = 6_371_000;
const rad = (graus: number) => (graus * Math.PI) / 180;

/** Distância em metros entre dois pontos (haversine), a mesma conta da API. */
export function distanciaM(a: Ponto, b: Ponto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.sqrt(h));
}
