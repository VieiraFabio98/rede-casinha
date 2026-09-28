import { Inject, Injectable } from '@nestjs/common';

import { distanciaM, type Ponto } from '../../../../shared/domain/geo.js';
import { RAIO_PROXIMIDADE_M } from '../../domain/localizacao.js';
import {
  LOCALIZACAO_REPOSITORY,
  type LocalizacaoRepository,
} from '../../domain/repositories/localizacao.repository.js';

/**
 * A pessoa está a até 100 m do local exato? (`validado_local`, adoção — RN05). A posição do
 * usuário não é guardada, e só o booleano sai daqui (nunca a distância). `null` sem posição.
 */
@Injectable()
export class VerificarProximidadeUseCase {
  constructor(
    @Inject(LOCALIZACAO_REPOSITORY) private readonly repositorio: LocalizacaoRepository,
  ) {}

  async executar(
    casinhaId: string,
    posicao: Ponto | null,
    raioM = RAIO_PROXIMIDADE_M,
  ): Promise<boolean | null> {
    if (!posicao) return null;
    const exata = (await this.repositorio.exatas([casinhaId])).get(casinhaId);
    return exata ? distanciaM(exata, posicao) <= raioM : null;
  }
}
