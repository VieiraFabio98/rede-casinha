import {
  type NivelAcesso,
  ORDEM_NIVEL,
  type UsuarioLogado,
} from '../../../shared/domain/usuario-logado.js';
import type { MotivoDenuncia } from './entities/denuncia.js';

/** "Coloca os animais em perigo" e "expõe uma pessoa": responder em até 24 h (o resto, 48 h). */
const PRIORITARIOS = new Set<MotivoDenuncia>(['perigo_animais', 'expoe_pessoa']);

export const ehPrioritaria = (motivos: MotivoDenuncia[]) =>
  motivos.some((m) => PRIORITARIOS.has(m));

/** Ordem da fila: prioritárias primeiro, depois a mais antiga. */
export function ordemDaFila(
  a: { prioridade: boolean; maisAntigaEm: Date },
  b: { prioridade: boolean; maisAntigaEm: Date },
): number {
  return (
    Number(b.prioridade) - Number(a.prioridade) ||
    a.maisAntigaEm.getTime() - b.maisAntigaEm.getTime()
  );
}

/**
 * Moderar um usuário: ninguém mexe na própria conta; criar ou mexer em moderador/admin é só
 * para admin. Devolve o motivo da recusa, ou `null` se pode.
 */
export function recusaModerarUsuario(
  moderador: UsuarioLogado,
  alvo: { id: string; nivel: NivelAcesso },
  novoNivel?: NivelAcesso,
): 'propria_conta' | 'so_admin' | null {
  if (alvo.id === moderador.id) return 'propria_conta';
  const envolveModeracao =
    ORDEM_NIVEL[alvo.nivel] >= ORDEM_NIVEL.moderador ||
    (novoNivel !== undefined && ORDEM_NIVEL[novoNivel] >= ORDEM_NIVEL.moderador);
  return envolveModeracao && moderador.nivel !== 'admin' ? 'so_admin' : null;
}

/** Rótulo de cada tipo de necessidade na fila de moderação. */
export const ROTULO_NECESSIDADE: Record<string, string> = {
  agua: 'água',
  racao: 'ração',
  reforma: 'reforma',
  cobertas: 'cobertas',
  limpeza: 'limpeza',
  remedio_veterinario: 'remédio/veterinário',
  outro: 'outro',
};
