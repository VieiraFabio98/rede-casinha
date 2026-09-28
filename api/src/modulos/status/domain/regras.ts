import type { TipoNecessidade, Urgencia } from '../../necessidades/domain/entities/necessidade.js';
import type { StatusCasinha } from './entities/status-casinha.js';

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

/** RN02: prazo até uma necessidade aberta expirar, se ninguém reconfirmar. */
const PRAZO_DIAS: Record<TipoNecessidade, number> = {
  agua: 2,
  racao: 3,
  limpeza: 7,
  remedio_veterinario: 7,
  cobertas: 14,
  outro: 14,
  reforma: 30,
};

/** Quando uma necessidade reportada (ou reconfirmada) agora vai expirar. */
export function prazoExpiracao(tipo: TipoNecessidade, agora: Date): Date {
  return new Date(agora.getTime() + PRAZO_DIAS[tipo] * DIA);
}

/** Água ou ração aberta há mais de 48 h deixa a casinha urgente (RN01). */
const ESSENCIAIS = new Set<TipoNecessidade>(['agua', 'racao']);
const LIMITE_ESSENCIAL_MS = 48 * HORA;
/** Sem atividade há mais de 7 dias: "sem notícias". */
const LIMITE_NOTICIAS_MS = 7 * DIA;

export interface NecessidadeAberta {
  tipo: TipoNecessidade;
  urgencia: Urgencia;
  criadaEm: Date;
}

/**
 * RN01, na ordem: urgente → atenção → ok → sem notícias.
 * (Casinha `inativa` é a `situacao`, não um status: ela nem aparece no mapa.)
 */
export function calcularStatus(
  abertas: NecessidadeAberta[],
  ultimaAtividadeEm: Date,
  agora: Date,
): StatusCasinha {
  const essencialAntiga = abertas.some(
    (n) => ESSENCIAIS.has(n.tipo) && agora.getTime() - n.criadaEm.getTime() > LIMITE_ESSENCIAL_MS,
  );
  if (essencialAntiga || abertas.some((n) => n.urgencia === 'urgente')) return 'urgente';
  if (abertas.length > 0) return 'atencao';
  if (agora.getTime() - ultimaAtividadeEm.getTime() <= LIMITE_NOTICIAS_MS) return 'ok';
  return 'sem_noticias';
}
