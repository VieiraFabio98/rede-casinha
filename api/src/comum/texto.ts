/** Forma usada para garantir apelidos únicos: sem espaços nas pontas, minúsculas e sem acentos. */
export function normalizarApelido(apelido: string): string {
  return apelido
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
