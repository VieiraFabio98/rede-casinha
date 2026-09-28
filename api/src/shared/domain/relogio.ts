/** Hora atual, injetável: os testes simulam o tempo passando. */
export interface Relogio {
  agora(): Date;
}

export const RELOGIO = Symbol('Relogio');
