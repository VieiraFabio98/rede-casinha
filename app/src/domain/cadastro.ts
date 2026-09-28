import { distanciaM, type Ponto } from './geo';

/** RF02.1: o GPS precisa chegar a 30 m de erro; senão, só ajustando o pino no mapa. */
export const PRECISAO_MAXIMA_M = 30;
/** O pino ajustado à mão não pode ir além de 50 m da leitura do GPS. */
export const AJUSTE_MAXIMO_M = 50;
/** Quanto tempo esperar o GPS chegar à precisão antes de sugerir o ajuste manual. */
export const ESPERA_GPS_MS = 60_000;
/** RF02.2: fotos no cadastro. */
export const MINIMO_FOTOS = 1;
export const MAXIMO_FOTOS = 3;

export const precisaoBoa = (precisaoM: number) => precisaoM <= PRECISAO_MAXIMA_M;

export const ajusteDentroDoLimite = (gps: Ponto, pino: Ponto) =>
  distanciaM(gps, pino) <= AJUSTE_MAXIMO_M;

/** Nome como a API aceita: de 3 a 60 caracteres, sem espaços nas pontas. */
export const nomeValido = (nome: string) => {
  const aparado = nome.trim();
  return aparado.length >= 3 && aparado.length <= 60;
};
