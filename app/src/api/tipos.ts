// Tipos das respostas da API, gerados do OpenAPI em schema.d.ts.
// Depois de mudar um DTO na API (com ela rodando): npm run gen:api
import type { components, operations } from './schema';

type Esquemas = components['schemas'];

export type Tokens = Esquemas['TokensResposta'];
export type Perfil = Esquemas['PerfilResposta'];
export type NivelAcesso = Perfil['nivel'];
export type Me = Esquemas['MeResposta'];
export type Contagens = Esquemas['ContagensResposta'];

/** Área visível do mapa (a API busca pela coordenada pública). */
export type Area = operations['CasinhasController_listarNaArea']['parameters']['query'];
export type CasinhaNoMapa = Esquemas['CasinhaNoMapa'];
export type CasinhasNaArea = Esquemas['CasinhasNaAreaResposta'];
export type MinhaCasinha = Esquemas['MinhaCasinha'];
export type CasinhaDetalhe = Esquemas['CasinhaDetalhe'];
/** URLs assinadas de uma foto (relativas à API; ver `urlDaFoto`). */
export type FotoUrls = Esquemas['FotoUrls'];
export type StatusCasinha = CasinhaNoMapa['status'];
export type TipoNecessidade = CasinhaNoMapa['necessidadesAbertas'][number];

export type ResultadoCadastro = Esquemas['ResultadoCadastro'];
export type CandidataDuplicata = Esquemas['CandidataDuplicata'];
export type AnimaisAtendidos = CasinhaDetalhe['animais'];
