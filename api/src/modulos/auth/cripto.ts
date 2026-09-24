import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** SHA-256 em hex: suficiente para tokens aleatórios de alta entropia (refresh tokens). */
export function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

/** HMAC-SHA256 em hex: para segredos de baixa entropia (códigos de 6 dígitos). */
export function hmac(segredo: string, valor: string): string {
  return createHmac('sha256', segredo).update(valor).digest('hex');
}

/** Comparação em tempo constante de dois hashes hex. */
export function hashesIguais(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}
