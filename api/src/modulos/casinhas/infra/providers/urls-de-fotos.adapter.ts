import { Injectable } from '@nestjs/common';

import { AssinaturaDeUrls } from '../../../../shared/infra/armazenamento/assinatura-de-urls.js';
import { urlsDaFoto } from '../../../fotos/domain/regras.js';
import type { UrlsDeFotos } from '../../domain/providers/urls-de-fotos.provider.js';

/**
 * Assina direto, sem passar por um use-case de `fotos`: o módulo `fotos` depende de `casinhas`
 * (trava da casinha), e o caminho inverso criaria um ciclo entre os módulos.
 */
@Injectable()
export class UrlsDeFotosAdapter implements UrlsDeFotos {
  constructor(private readonly assinatura: AssinaturaDeUrls) {}

  gerar(fotoIds: string[], agora: Date) {
    return fotoIds.map((id) => urlsDaFoto(id, agora, (texto) => this.assinatura.assinar(texto)));
  }
}
