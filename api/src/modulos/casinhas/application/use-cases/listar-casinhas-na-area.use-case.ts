import { Inject, Injectable } from '@nestjs/common';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { BadRequest } from '../../../../shared/errors/index.js';
import {
  LOCALIZACAO_EXATA,
  type LocalizacaoExata,
} from '../../domain/providers/localizacao-exata.provider.js';
import {
  CASINHAS_REPOSITORY,
  type CasinhasRepository,
} from '../../domain/repositories/casinhas.repository.js';
import { LIMITE_POR_AREA } from '../../domain/visibilidade.js';
import type { AreaDto, CasinhasNaAreaResposta } from '../dto/casinhas.dto.js';
import { paraMapa } from './coordenadas.js';

/**
 * Casinhas da área visível do mapa (no máximo 1.000). A coordenada é a exata só para quem pode
 * vê-la (criador, adotante, moderador e o verificado nas que já abriu hoje).
 */
@Injectable()
export class ListarCasinhasNaAreaUseCase {
  constructor(
    @Inject(CASINHAS_REPOSITORY) private readonly casinhas: CasinhasRepository,
    @Inject(LOCALIZACAO_EXATA) private readonly localizacao: LocalizacaoExata,
  ) {}

  async executar(usuario: UsuarioLogado, area: AreaDto): Promise<CasinhasNaAreaResposta> {
    if (area.minLat > area.maxLat || area.minLng > area.maxLng) {
      throw new BadRequest('Área inválida: o mínimo passa do máximo', 'area_invalida');
    }
    const linhas = await this.casinhas.naArea(area, LIMITE_POR_AREA + 1);
    const casinhas = linhas.slice(0, LIMITE_POR_AREA);
    const exatas = await this.localizacao.paraLista(usuario, casinhas);
    return {
      casinhas: casinhas.map((c) => paraMapa(c, exatas.get(c.id))),
      truncado: linhas.length > LIMITE_POR_AREA,
    };
  }
}
