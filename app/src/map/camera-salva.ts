import { armazenamentoRapido } from '@/offline/armazenamento-rapido';

import type { CameraSalva } from './estilo';

const CHAVE = 'mapa.camera';

export function lerCamera(): CameraSalva | null {
  const salva = armazenamentoRapido.getString(CHAVE);
  if (!salva) return null;
  try {
    const camera = JSON.parse(salva) as CameraSalva;
    const [lng, lat] = camera.centro;
    return Number.isFinite(lng) && Number.isFinite(lat) && Number.isFinite(camera.zoom)
      ? camera
      : null;
  } catch {
    return null;
  }
}

export function salvarCamera(camera: CameraSalva) {
  armazenamentoRapido.set(CHAVE, JSON.stringify(camera));
}
