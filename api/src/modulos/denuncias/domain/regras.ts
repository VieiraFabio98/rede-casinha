/** RF06.2: denúncias abertas que ocultam o alvo automaticamente, até a revisão. */
export const DENUNCIAS_PARA_OCULTAR = 3;

/** Só contam contas com pelo menos 7 dias: evita "brigada" de contas criadas para derrubar alguém. */
export const IDADE_MINIMA_CONTA_MS = 7 * 24 * 60 * 60 * 1000;

/** Contas criadas até este instante contam para a ocultação automática. */
export const contasQueContamAte = (agora: Date) =>
  new Date(agora.getTime() - IDADE_MINIMA_CONTA_MS);
