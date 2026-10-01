/** Limites diários por usuário (RN06). O "dia" vira à meia-noite de Brasília (`diaAtual`). */
export const LIMITES = {
  /** Reportes, reconfirmações, atendimentos, contestações e check-ins, somados. */
  contribuicoes: 60,
  /** Tentativas de adoção (inclusive as recusadas): impede "caçar" a casinha tentando de vários lugares. */
  adocao: 3,
  /** Denúncias e pedidos de desativação, somados. */
  denuncias: 20,
  /** Fotos enviadas (de perfil e de atividade). */
  fotos: 20,
  /** Casinhas cadastradas, para o colaborador. O verificado tem mais (`limiteDeCadastros`). */
  cadastros: 5,
  /** Cadastros que bateram na checagem de duplicata: cada um revela que há casinha a até 30 m. */
  duplicatas: 10,
} as const;

export type AcaoLimitada = keyof typeof LIMITES;

export const passouDoLimite = (
  acao: AcaoLimitada,
  usosNoDia: number,
  limite: number = LIMITES[acao],
) => usosNoDia > limite;
