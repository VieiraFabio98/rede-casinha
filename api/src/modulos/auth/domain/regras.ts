/** Login por código (RF01): validade, tentativas e ritmo de pedidos. */
export const VALIDADE_CODIGO_MIN = 10;
export const MAX_TENTATIVAS_CODIGO = 5;
export const INTERVALO_MINIMO_CODIGO_MS = 60_000;
export const MAX_CODIGOS_POR_HORA = 5;

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const minutosDepois = (inicio: Date, minutos: number) =>
  new Date(inicio.getTime() + minutos * 60_000);
