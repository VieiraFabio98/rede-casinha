import type { NivelAcesso } from '../../../../shared/domain/usuario-logado.js';

export interface Perfil {
  apelido: string;
  nivel: NivelAcesso;
  bloqueadoAte: Date | null;
}

export interface Conta {
  id: string;
  email: string;
  /** `null` enquanto o cadastro não for concluído. */
  perfil: Perfil | null;
}

export interface NovoPerfil {
  usuarioId: string;
  apelido: string;
  apelidoNormalizado: string;
  termosVersao: string;
  em: Date;
}

/** O banco garante apelido único e um perfil por conta; a corrida entre dois pedidos cai aqui. */
export type ResultadoCriarPerfil = Perfil | 'apelido_em_uso' | 'cadastro_existente';

export interface Contagens {
  contribuicoes: number;
  atendimentos: number;
  casinhasAdotadas: number;
}

export interface ContasRepository {
  buscar(usuarioId: string): Promise<Conta | null>;
  perfilExiste(usuarioId: string): Promise<boolean>;
  criarPerfil(novo: NovoPerfil): Promise<ResultadoCriarPerfil>;
  contagens(usuarioId: string): Promise<Contagens>;
  /**
   * Apaga fotos enviadas, códigos de login pendentes e o usuário; o banco apaga em cascata
   * perfil, sessões, adoções, auditoria de acessos e limites. Devolve as chaves dos arquivos das
   * fotos apagadas, ou `null` se a conta não existe.
   */
  excluir(usuarioId: string): Promise<string[] | null>;
}

export const CONTAS_REPOSITORY = Symbol('ContasRepository');
