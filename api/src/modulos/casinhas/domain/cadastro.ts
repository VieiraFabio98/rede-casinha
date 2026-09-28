import { type NivelAcesso, ORDEM_NIVEL } from '../../../shared/domain/usuario-logado.js';

/** RF02.1: precisão do GPS exigida no cadastro, a menos que o pino tenha sido ajustado à mão. */
export const PRECISAO_MAXIMA_M = 30;

/** RN06: 5 cadastros por dia para o colaborador, 20 a partir do verificado. */
export const limiteDeCadastros = (nivel: NivelAcesso) =>
  ORDEM_NIVEL[nivel] >= ORDEM_NIVEL.verificado ? 20 : 5;

/** RF02.1: o GPS serve se tiver até 30 m de erro; senão, só com o pino ajustado e confirmado. */
export const posicaoAceita = (precisaoM: number, ajusteManual: boolean) =>
  ajusteManual || precisaoM <= PRECISAO_MAXIMA_M;
