import type { LngLat } from '@maplibre/maplibre-react-native';

/**
 * Estilo vetorial do OpenFreeMap (sem chave nem cadastro). Plano B, se ele cair:
 * PMTiles próprio no R2 — basta trocar esta URL (docs/03-ferramentas.md).
 */
export const ESTILO_MAPA_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Região mostrada quando não há câmera salva nem permissão de localização (Praça da Sé/SP). */
export const CAMERA_PADRAO: CameraSalva = { centro: [-46.6339, -23.5505], zoom: 11 };

/** Zoom ao centralizar no usuário: dá para ver as casinhas do quarteirão. */
export const ZOOM_LOCALIZACAO = 15;

export const ZOOM_MINIMO = 3;
export const ZOOM_MAXIMO = 19;

export interface CameraSalva {
  centro: LngLat;
  zoom: number;
}
