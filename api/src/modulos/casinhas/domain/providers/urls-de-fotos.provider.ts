import type { UrlsDaFoto } from '../../../fotos/domain/regras.js';

/** URLs assinadas das fotos (regras do módulo `fotos`). */
export interface UrlsDeFotos {
  gerar(fotoIds: string[], agora: Date): UrlsDaFoto[];
}

export const URLS_DE_FOTOS = Symbol('CasinhasUrlsDeFotos');
