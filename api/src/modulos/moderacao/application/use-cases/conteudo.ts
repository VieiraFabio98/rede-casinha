import { BadRequest, NotFoundError } from '../../../../shared/errors/index.js';
import type { Alvo } from '../../domain/entities/denuncia.js';
import type { ConteudoRepository } from '../../domain/repositories/conteudo.repository.js';
import type { CasinhasModeracaoRepository } from '../../domain/repositories/casinhas-moderacao.repository.js';

/** O alvo existe? Trava a casinha dele e a devolve (para recalcular o status). */
export async function exigirAlvo(
  alvo: Alvo,
  conteudo: ConteudoRepository,
  casinhas: CasinhasModeracaoRepository,
): Promise<string> {
  if (alvo.alvoTipo === 'perfil') {
    throw new BadRequest('Perfil não se oculta: use o bloqueio do usuário');
  }
  const casinhaId = await conteudo.casinhaDoAlvo(alvo);
  if (!casinhaId || !(await casinhas.travar(casinhaId))) {
    throw new NotFoundError('Alvo não encontrado');
  }
  return casinhaId;
}
