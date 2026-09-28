/** Apaga os arquivos das fotos (módulo `fotos`). Não lança: a falha só vai para o log. */
export interface ArquivosDeFotos {
  apagar(chaves: string[]): Promise<void>;
}

export const ARQUIVOS_DE_FOTOS = Symbol('MeArquivosDeFotos');
