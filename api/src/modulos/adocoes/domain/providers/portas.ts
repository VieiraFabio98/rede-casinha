import type { Ponto } from '../../../../shared/domain/geo.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';

/** Trava a casinha e confere o acesso (módulo `casinhas`). Devolve o criador. */
export interface AcessoCasinha {
  travarParaAcao(
    usuario: UsuarioLogado,
    casinhaId: string,
  ): Promise<{ criadaPorId: string | null }>;
}
export const ACESSO_CASINHA = Symbol('AdocoesAcessoCasinha');

/** A até 100 m da exata? Só o booleano, nunca a distância (módulo `localizacao`). */
export interface VerificadorDeProximidade {
  estaPerto(casinhaId: string, posicao: Ponto | null): Promise<boolean | null>;
}
export const VERIFICADOR_DE_PROXIMIDADE = Symbol('AdocoesVerificadorDeProximidade');

/** Conta 1 tentativa de adoção do dia (RN06: 3/dia) ou lança erro (módulo `limites`). */
export interface ControleDeLimites {
  consumirTentativaDeAdocao(usuarioId: string, agora: Date): Promise<void>;
}
export const CONTROLE_DE_LIMITES = Symbol('AdocoesControleDeLimites');
