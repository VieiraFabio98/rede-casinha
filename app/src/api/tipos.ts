// Tipos das respostas da API. Na T1.1 passam a ser gerados do OpenAPI (npm run gen:api).

export type NivelAcesso = 'colaborador' | 'verificado' | 'moderador' | 'admin';

export interface Tokens {
  acesso: string;
  acessoExpiraEm: string;
  refresh: string;
  refreshExpiraEm: string;
  precisaCadastro: boolean;
}

export interface Perfil {
  apelido: string;
  nivel: NivelAcesso;
  bloqueadoAte: string | null;
}

export interface Me {
  id: string;
  email: string;
  perfil: Perfil | null;
}
