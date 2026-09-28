/** Versão vigente dos termos (igual à da API: api/src/config/termos.ts). */
export const VERSAO_TERMOS = '2026-10-01';

/** Site com política de privacidade e termos (T0.8). Enquanto não existir, o link não aparece. */
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;
export const URL_TERMOS = SITE_URL ? `${SITE_URL}/termos` : null;
export const URL_PRIVACIDADE = SITE_URL ? `${SITE_URL}/privacidade` : null;

/**
 * E-mail do projeto (público, na loja e na política): pedidos de dados (LGPD) e contato.
 * Criado na T0.1. Enquanto não estiver no `.env`, o botão "Pedir meus dados" não aparece.
 */
export const EMAIL_CONTATO = process.env.EXPO_PUBLIC_EMAIL_CONTATO || null;
