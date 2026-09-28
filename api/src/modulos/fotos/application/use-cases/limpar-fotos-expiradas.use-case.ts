import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { ARQUIVOS_DE_FOTOS, type ArquivosDeFotos } from '../../domain/providers/portas.js';
import {
  FOTOS_REPOSITORY,
  type FotosRepository,
} from '../../domain/repositories/fotos.repository.js';

const LOTE = 500;

/**
 * Apaga as fotos de atividade com mais de 90 dias (RN06), em lotes. Os arquivos saem antes dos
 * registros: se algo falhar no meio, a próxima rodada encontra os registros e tenta de novo.
 * Devolve quantas fotos apagou.
 */
@Injectable()
export class LimparFotosExpiradasUseCase {
  constructor(
    @Inject(FOTOS_REPOSITORY) private readonly fotos: FotosRepository,
    @Inject(ARQUIVOS_DE_FOTOS) private readonly arquivos: ArquivosDeFotos,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  async executar(): Promise<number> {
    let total = 0;
    for (;;) {
      const lote = await this.fotos.expiradas(this.relogio.agora(), LOTE);
      if (lote.length === 0) return total;
      await this.arquivos.apagar(lote.flatMap((f) => [f.chave, f.chaveMiniatura]));
      await this.fotos.apagar(lote.map((f) => f.id));
      total += lote.length;
      if (lote.length < LOTE) return total;
    }
  }
}
