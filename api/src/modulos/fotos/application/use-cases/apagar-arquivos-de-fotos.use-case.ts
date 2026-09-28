import { Inject, Injectable, Logger } from '@nestjs/common';

import { ARQUIVOS_DE_FOTOS, type ArquivosDeFotos } from '../../domain/providers/portas.js';

/**
 * Apaga os arquivos de fotos cujos registros já saíram do banco (ex.: conta excluída).
 * Não lança: roda depois da transação, e a falha não pode desfazer o que já foi confirmado.
 * Fica no log para apagar à mão.
 */
@Injectable()
export class ApagarArquivosDeFotosUseCase {
  private readonly log = new Logger('Fotos');

  constructor(@Inject(ARQUIVOS_DE_FOTOS) private readonly arquivos: ArquivosDeFotos) {}

  async executar(chaves: string[]): Promise<void> {
    if (chaves.length === 0) return;
    try {
      await this.arquivos.apagar(chaves);
    } catch (erro) {
      this.log.error(
        `Não foi possível apagar ${chaves.length} arquivo(s): ${chaves.join(', ')}`,
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }
}
