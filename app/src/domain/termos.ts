/** Versão vigente dos termos (igual à da API: api/src/config/termos.ts). */
export const VERSAO_TERMOS = '2026-10-01';

/** Site com política de privacidade e termos (T0.8). Enquanto não existir, o link não aparece. */
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;
export const URL_TERMOS = SITE_URL ? `${SITE_URL}/termos` : null;
export const URL_PRIVACIDADE = SITE_URL ? `${SITE_URL}/privacidade` : null;
