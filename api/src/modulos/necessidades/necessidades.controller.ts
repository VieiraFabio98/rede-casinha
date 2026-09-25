import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Nivel, PerfilAtual } from '../../comum/auth/decoradores.js';
import type { Perfil } from '../../generated/prisma/client.js';
import {
  AcaoDto,
  AtenderDto,
  ContestarDto,
  ReportarNecessidadeDto,
  ResultadoAcao,
} from './necessidades.dto.js';
import { NecessidadesService } from './necessidades.service.js';

const uuid = new ParseUUIDPipe();

// Todas idempotentes pelo id gerado no celular: a fila offline pode reenviar sem medo.
@ApiTags('necessidades')
@ApiBearerAuth()
@Nivel('colaborador')
@Controller()
export class NecessidadesController {
  constructor(private readonly necessidades: NecessidadesService) {}

  /** Reporta o que falta. Se o tipo já está aberto, vira "ainda precisa" (RN02). */
  @Post('necessidades')
  @HttpCode(200)
  reportar(
    @PerfilAtual() perfil: Perfil,
    @Body() dto: ReportarNecessidadeDto,
  ): Promise<ResultadoAcao> {
    return this.necessidades.reportar(perfil, dto);
  }

  /** "Ainda precisa": renova o prazo. 1 vez a cada 12 h por usuário. */
  @Post('necessidades/:id/reconfirmar')
  @HttpCode(200)
  reconfirmar(
    @PerfilAtual() perfil: Perfil,
    @Param('id', uuid) id: string,
    @Body() dto: AcaoDto,
  ): Promise<ResultadoAcao> {
    return this.necessidades.reconfirmar(perfil, id, dto);
  }

  /** "Abasteci" / "Atendi". Se alguém resolveu antes, devolve `ja_atendida` (RN03). */
  @Post('necessidades/:id/atender')
  @HttpCode(200)
  atender(
    @PerfilAtual() perfil: Perfil,
    @Param('id', uuid) id: string,
    @Body() dto: AtenderDto,
  ): Promise<ResultadoAcao> {
    return this.necessidades.atender(perfil, id, dto);
  }

  /** "Não foi resolvido": reabre até 24 h depois do atendimento (RN03). */
  @Post('necessidades/:id/contestar')
  @HttpCode(200)
  contestar(
    @PerfilAtual() perfil: Perfil,
    @Param('id', uuid) id: string,
    @Body() dto: ContestarDto,
  ): Promise<ResultadoAcao> {
    return this.necessidades.contestar(perfil, id, dto);
  }

  /** "Passei aqui, tudo ok". */
  @Post('casinhas/:id/check-in')
  @HttpCode(200)
  checkIn(
    @PerfilAtual() perfil: Perfil,
    @Param('id', uuid) id: string,
    @Body() dto: AcaoDto,
  ): Promise<ResultadoAcao> {
    return this.necessidades.checkIn(perfil, id, dto);
  }
}
