import type { Readable } from 'node:stream';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';

/** Trava a casinha e confere o acesso (módulo `casinhas`). Devolve o criador. */
export interface AcessoCasinha {
  travarParaAcao(
    usuario: UsuarioLogado,
    casinhaId: string,
  ): Promise<{ criadaPorId: string | null }>;
}
export const ACESSO_CASINHA = Symbol('FotosAcessoCasinha');

/** Conta 1 foto enviada no dia (RN06: 20/dia) ou lança erro (módulo `limites`). */
export interface ControleDeLimites {
  consumirEnvioDeFoto(usuarioId: string, agora: Date): Promise<void>;
}
export const CONTROLE_DE_LIMITES = Symbol('FotosControleDeLimites');

/** Onde ficam os arquivos (disco ou S3). */
export interface ArquivosDeFotos {
  gravar(chave: string, dados: Buffer, tipo: string): Promise<void>;
  /** `null` se o arquivo não existe. */
  ler(chave: string): Promise<Readable | null>;
  apagar(chaves: string[]): Promise<void>;
}
export const ARQUIVOS_DE_FOTOS = Symbol('FotosArquivos');

/** HMAC das URLs das fotos. */
export interface AssinadorDeUrls {
  assinar(texto: string): string;
  confere(texto: string, assinatura: string): boolean;
}
export const ASSINADOR_DE_URLS = Symbol('FotosAssinadorDeUrls');
