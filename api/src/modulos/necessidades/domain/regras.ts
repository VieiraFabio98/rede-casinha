import type { Necessidade, StatusNecessidade } from './entities/necessidade.js';

const HORA = 60 * 60 * 1000;

/** RN02: cada usuário reconfirma a mesma necessidade no máximo 1 vez a cada 12 h. */
export const INTERVALO_RECONFIRMACAO_MS = 12 * HORA;

/** RN03: contestação só até 24 h depois do atendimento. */
export const PRAZO_CONTESTACAO_MS = 24 * HORA;

/** Hora informada pelo celular, mas nunca no futuro (relógio do aparelho errado). */
export function horaDoCelular(informada: Date | undefined, agora: Date): Date {
  return informada && informada < agora ? informada : agora;
}

/**
 * RN03: atender uma necessidade que já não está aberta (alguém resolveu antes, ou expirou)
 * não muda nada: fica só no histórico e o app agradece do mesmo jeito.
 */
export function atendimentoValeParaStatus(status: StatusNecessidade): boolean {
  return status === 'aberta';
}

/** RN03: só dá para contestar um atendimento de até 24 h atrás. */
export function podeContestar(n: Pick<Necessidade, 'status' | 'atendidaEm'>, agora: Date) {
  return (
    n.status === 'atendida' &&
    n.atendidaEm !== null &&
    agora.getTime() - n.atendidaEm.getTime() <= PRAZO_CONTESTACAO_MS
  );
}
