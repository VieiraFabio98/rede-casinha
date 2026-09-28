import type { NivelAcesso } from '../../../../shared/domain/usuario-logado.js';

export interface PerfilModerado {
  id: string;
  apelido: string;
  nivel: NivelAcesso;
  verificadoPorId: string | null;
  bloqueadoAte: Date | null;
}

export interface UsuariosModeracaoRepository {
  perfil(id: string): Promise<PerfilModerado | null>;
  alterarNivel(id: string, nivel: NivelAcesso, verificadoPorId: string | null): Promise<void>;
  bloquear(id: string, ate: Date | null): Promise<void>;
}

export const USUARIOS_MODERACAO_REPOSITORY = Symbol('UsuariosModeracaoRepository');
