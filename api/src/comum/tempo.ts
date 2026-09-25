/** Fuso usado para "o dia" dos limites diários: o do público do app, não o do servidor (UTC). */
const FUSO_DOS_LIMITES = 'America/Sao_Paulo';

const formatoData = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_DOS_LIMITES,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Data de hoje em São Paulo, como meia-noite UTC (o formato que o Prisma usa em colunas `@db.Date`).
 * Os limites diários (RN06) viram à meia-noite de Brasília, não às 21 h.
 */
export function diaAtual(agora: Date = new Date()): Date {
  const [ano, mes, dia] = formatoData.format(agora).split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}
