export const NIVEIS_ACESSO = ['colaborador', 'verificado', 'moderador', 'admin'] as const;
export type NivelAcesso = (typeof NIVEIS_ACESSO)[number];

/** Quem está agindo: o mínimo que as regras precisam (id e nível). */
export interface UsuarioLogado {
  id: string;
  nivel: NivelAcesso;
}

/** Ordem dos níveis: cada um inclui os anteriores. */
export const ORDEM_NIVEL: Record<NivelAcesso, number> = {
  colaborador: 0,
  verificado: 1,
  moderador: 2,
  admin: 3,
};

export const ehModerador = (u: UsuarioLogado) => ORDEM_NIVEL[u.nivel] >= ORDEM_NIVEL.moderador;
