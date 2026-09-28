import { Injectable } from '@nestjs/common';

import { ApagarArquivosDeFotosUseCase } from '../../../fotos/application/use-cases/apagar-arquivos-de-fotos.use-case.js';
import type { ArquivosDeFotos } from '../../domain/providers/arquivos-de-fotos.provider.js';

@Injectable()
export class ArquivosDeFotosAdapter implements ArquivosDeFotos {
  constructor(private readonly apagarArquivos: ApagarArquivosDeFotosUseCase) {}

  apagar(chaves: string[]) {
    return this.apagarArquivos.executar(chaves);
  }
}
