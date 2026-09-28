import type { AcaoDeModeracao } from '../entities/denuncia.js';

export interface AuditoriaRepository {
  registrar(acao: AcaoDeModeracao): Promise<void>;
  /** Última vez que cada casinha foi "ativada" (decide pedidos de desativação antigos). */
  ultimasAtivacoes(casinhaIds: string[]): Promise<Map<string, Date>>;
}

export const AUDITORIA_REPOSITORY = Symbol('AuditoriaRepository');
