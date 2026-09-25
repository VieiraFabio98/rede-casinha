import type { StatusCasinha, TipoNecessidade } from '@/api/tipos';

/**
 * Gravidade do status, usada para a cor do cluster (a pior do grupo).
 * "Sem notícias" fica acima de "ok": falta de dado não é "ok" (docs/01-visao-geral.md).
 */
export const SEVERIDADE: Record<StatusCasinha, number> = {
  ok: 0,
  sem_noticias: 1,
  atencao: 2,
  urgente: 3,
};

/** Status em ordem de gravidade, do pior para o melhor (legenda). */
export const STATUS_POR_GRAVIDADE: StatusCasinha[] = ['urgente', 'atencao', 'sem_noticias', 'ok'];

/** Cor de cada status. O pino também traz um símbolo: nunca só a cor (RF01.6). */
export const COR_STATUS: Record<StatusCasinha, { cor: string; corTexto: string }> = {
  ok: { cor: '#2E7D32', corTexto: '#FFFFFF' },
  atencao: { cor: '#F9A825', corTexto: '#1A1A1A' },
  urgente: { cor: '#C62828', corTexto: '#FFFFFF' },
  sem_noticias: { cor: '#757575', corTexto: '#FFFFFF' },
};

/** Pino de cada status (cor + símbolo), usado no mapa e na legenda. */
export const PINO_STATUS = {
  ok: require('@/assets/images/mapa/pino-ok.png'),
  atencao: require('@/assets/images/mapa/pino-atencao.png'),
  urgente: require('@/assets/images/mapa/pino-urgente.png'),
  sem_noticias: require('@/assets/images/mapa/pino-sem_noticias.png'),
} satisfies Record<StatusCasinha, number>;

/** Selo redondo de cada status: casinha com local aproximado (sem ponta, para não sugerir um ponto exato). */
export const SELO_STATUS = {
  ok: require('@/assets/images/mapa/selo-ok.png'),
  atencao: require('@/assets/images/mapa/selo-atencao.png'),
  urgente: require('@/assets/images/mapa/selo-urgente.png'),
  sem_noticias: require('@/assets/images/mapa/selo-sem_noticias.png'),
} satisfies Record<StatusCasinha, number>;

export const TIPOS_NECESSIDADE: TipoNecessidade[] = [
  'agua',
  'racao',
  'cobertas',
  'limpeza',
  'remedio_veterinario',
  'reforma',
  'outro',
];
