import type { Readable } from 'node:stream';

import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { ForbiddenError, NotFoundError } from '../../../../shared/errors/index.js';
import {
  ARQUIVOS_DE_FOTOS,
  type ArquivosDeFotos,
  ASSINADOR_DE_URLS,
  type AssinadorDeUrls,
} from '../../domain/providers/portas.js';
import {
  FOTOS_REPOSITORY,
  type FotosRepository,
} from '../../domain/repositories/fotos.repository.js';
import { textoAssinado, type Variante } from '../../domain/regras.js';

export interface FotoAberta {
  arquivo: Readable;
  /** Até quando a URL vale: o cache do app pode guardar a imagem até lá. */
  segundosRestantes: number;
}

/**
 * Entrega o arquivo de uma URL assinada. Sem token: quem tem a URL (só vem no detalhe, para
 * quem está logado) vê a foto até a expiração. Foto ocultada pela moderação deixa de abrir na hora.
 */
@Injectable()
export class AbrirFotoUseCase {
  constructor(
    @Inject(FOTOS_REPOSITORY) private readonly fotos: FotosRepository,
    @Inject(ARQUIVOS_DE_FOTOS) private readonly arquivos: ArquivosDeFotos,
    @Inject(ASSINADOR_DE_URLS) private readonly assinador: AssinadorDeUrls,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  async executar(
    fotoId: string,
    variante: Variante,
    exp: number,
    assinatura: string,
  ): Promise<FotoAberta> {
    // A assinatura primeiro: URL forjada não chega ao banco.
    if (!this.assinador.confere(textoAssinado(fotoId, variante, exp), assinatura)) {
      throw new ForbiddenError('Link da foto inválido.', 'url_invalida');
    }
    const segundosRestantes = exp - Math.floor(this.relogio.agora().getTime() / 1000);
    if (segundosRestantes <= 0) throw new ForbiddenError('Link da foto expirou.', 'url_expirada');

    const foto = await this.fotos.buscar(fotoId);
    if (!foto || foto.moderacao !== 'visivel') throw new NotFoundError('Foto não encontrada');

    const arquivo = await this.arquivos.ler(
      variante === 'miniatura' ? foto.chaveMiniatura : foto.chave,
    );
    if (!arquivo) throw new NotFoundError('Foto não encontrada');
    return { arquivo, segundosRestantes };
  }
}
