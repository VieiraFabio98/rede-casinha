import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Nivel, PerfilAtual } from '../../comum/auth/decoradores.js';
import type { Perfil } from '../../generated/prisma/client.js';
import { AreaDto, CasinhaDetalhe, CasinhasNaAreaResposta, MinhaCasinha } from './casinhas.dto.js';
import { CasinhasService } from './casinhas.service.js';

// Sem @Publico(): o mapa exige login e cadastro concluído (decisão D01, docs/01-visao-geral.md).
@ApiTags('casinhas')
@ApiBearerAuth()
@Nivel('colaborador')
@Controller('casinhas')
export class CasinhasController {
  constructor(private readonly casinhas: CasinhasService) {}

  /**
   * Casinhas da área visível do mapa (no máximo 1.000). A coordenada é a exata só para quem
   * pode vê-la (criador, adotante, moderador e o verificado nas que já abriu hoje).
   */
  @Get()
  listarNaArea(
    @PerfilAtual() perfil: Perfil,
    @Query() area: AreaDto,
  ): Promise<CasinhasNaAreaResposta> {
    return this.casinhas.listarNaArea(perfil, area);
  }

  /** Detalhe da casinha. Para o verificado, ver a exata gasta 1 das 50 casinhas do dia. */
  @Get(':id')
  detalhe(
    @PerfilAtual() perfil: Perfil,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CasinhaDetalhe> {
    return this.casinhas.detalhe(perfil, id);
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Nivel('colaborador')
@Controller('me/casinhas')
export class MinhasCasinhasController {
  constructor(private readonly casinhas: CasinhasService) {}

  /** Casinhas que criei ou adoto, com status e localização exata. */
  @Get()
  listar(@PerfilAtual() perfil: Perfil): Promise<MinhaCasinha[]> {
    return this.casinhas.minhas(perfil);
  }
}
