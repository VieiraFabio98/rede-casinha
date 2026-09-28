import type { NivelAcesso, UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { BadRequest, ForbiddenError, NotFoundError } from '../../../../shared/errors/index.js';
import { recusaModerarUsuario } from '../../domain/regras.js';
import type {
  PerfilModerado,
  UsuariosModeracaoRepository,
} from '../../domain/repositories/usuarios-moderacao.repository.js';

/** Carrega o usuário-alvo e aplica as regras de quem pode moderá-lo. */
export async function exigirUsuarioModeravel(
  usuarios: UsuariosModeracaoRepository,
  moderador: UsuarioLogado,
  usuarioId: string,
  novoNivel?: NivelAcesso,
): Promise<PerfilModerado> {
  if (usuarioId === moderador.id) throw new BadRequest('Não dá para moderar a própria conta');
  const alvo = await usuarios.perfil(usuarioId);
  if (!alvo) throw new NotFoundError('Usuário não encontrado');
  if (recusaModerarUsuario(moderador, alvo, novoNivel) === 'so_admin') {
    throw new ForbiddenError('Só um admin pode fazer isso', 'nivel_insuficiente');
  }
  return alvo;
}
