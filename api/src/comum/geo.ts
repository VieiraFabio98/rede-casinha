/**
 * Cálculos geográficos sem PostGIS (ver docs/04-arquitetura.md, "Geo sem PostGIS").
 * Modelo esférico da Terra: erro < 0,5% nas distâncias usadas (30 m a alguns km).
 */

export interface Ponto {
  lat: number;
  lng: number;
}

export interface Caixa {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const RAIO_TERRA_M = 6_371_000;

const paraRadianos = (graus: number) => (graus * Math.PI) / 180;
const paraGraus = (radianos: number) => (radianos * 180) / Math.PI;

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanciaM(a: Ponto, b: Ponto): number {
  const dLat = paraRadianos(b.lat - a.lat);
  const dLng = paraRadianos(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(paraRadianos(a.lat)) * Math.cos(paraRadianos(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ponto de destino a partir de uma origem, uma distância (m) e um azimute (graus, 0 = norte). */
export function destino(origem: Ponto, distancia: number, azimuteGraus: number): Ponto {
  const angular = distancia / RAIO_TERRA_M;
  const azimute = paraRadianos(azimuteGraus);
  const lat1 = paraRadianos(origem.lat);
  const lng1 = paraRadianos(origem.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(azimute),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(azimute) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  // Normaliza a longitude para [-180, 180).
  return { lat: paraGraus(lat2), lng: ((paraGraus(lng2) + 540) % 360) - 180 };
}

/**
 * Caixa (lat/lng) que contém o círculo de raio `raioM` em volta do centro.
 * Serve de pré-filtro no banco (usa o índice); a distância exata é conferida com `distanciaM`.
 */
export function caixaAoRedor(centro: Ponto, raioM: number): Caixa {
  // Folga de ~0,1 mm para não perder, por arredondamento, pontos exatamente na borda.
  const FOLGA_GRAUS = 1e-9;
  const dLat = paraGraus(raioM / RAIO_TERRA_M) + FOLGA_GRAUS;
  const cosLat = Math.max(Math.cos(paraRadianos(centro.lat)), 1e-12);
  const dLng = paraGraus(raioM / (RAIO_TERRA_M * cosLat)) + FOLGA_GRAUS;
  return {
    minLat: Math.max(-90, centro.lat - dLat),
    maxLat: Math.min(90, centro.lat + dLat),
    minLng: centro.lng - dLng,
    maxLng: centro.lng + dLng,
  };
}
