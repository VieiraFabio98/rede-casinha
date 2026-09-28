/**
 * Confere a senha. Com `hash` nulo (conta sem senha ou inexistente) ainda gasta o mesmo tempo
 * e devolve `false`: a resposta não revela se o e-mail existe.
 */
export interface Senhas {
  confere(hash: string | null, senha: string): Promise<boolean>;
}

export const SENHAS = Symbol('Senhas');
