export interface IdentidadeGoogle {
  sub: string;
  email: string;
}

/** Valida o ID token do Google Sign-In. Lança `UnauthorizedError` se não for válido. */
export interface VerificadorGoogle {
  verificar(idToken: string): Promise<IdentidadeGoogle>;
}

export const VERIFICADOR_GOOGLE = Symbol('VerificadorGoogle');
