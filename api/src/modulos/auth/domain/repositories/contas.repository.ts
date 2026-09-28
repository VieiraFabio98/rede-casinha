import type { Conta } from '../entities/conta.js';

export interface ContasRepository {
  buscarPorGoogle(googleSub: string): Promise<Conta | null>;
  buscarPorEmail(email: string): Promise<Conta | null>;
  criar(dados: { email: string; googleSub: string; emailVerificadoEm: Date }): Promise<Conta>;
  /** Cria a conta no primeiro acesso por código (upsert: seguro com pedidos simultâneos). */
  buscarOuCriarPorEmail(email: string, verificadoEm: Date): Promise<Conta>;
  vincularGoogle(id: string, googleSub: string, emailVerificadoEm: Date): Promise<Conta>;
  marcarEmailVerificado(id: string, em: Date): Promise<void>;
  temPerfil(id: string): Promise<boolean>;
}

export const CONTAS_REPOSITORY = Symbol('AuthContasRepository');
