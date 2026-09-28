import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Nivel, PerfilAtual } from '../../../../shared/infra/auth/decoradores.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { type HttpResponse, ok } from '../../../../shared/helpers/index.js';
import {
  AcaoDto,
  AtenderDto,
  ContestarDto,
  ReportarNecessidadeDto,
  ResultadoAcao,
} from '../../application/dto/necessidades.dto.js';
import { AtenderNecessidadeUseCase } from '../../application/use-cases/atender-necessidade.use-case.js';
import { ContestarAtendimentoUseCase } from '../../application/use-cases/contestar-atendimento.use-case.js';
import { FazerCheckInUseCase } from '../../application/use-cases/fazer-check-in.use-case.js';
import { ReconfirmarNecessidadeUseCase } from '../../application/use-cases/reconfirmar-necessidade.use-case.js';
import { ReportarNecessidadeUseCase } from '../../application/use-cases/reportar-necessidade.use-case.js';

const uuid = new ParseUUIDPipe();

// Todas idempotentes pelo id gerado no celular: a fila offline pode reenviar sem medo.
@ApiTags('necessidades')
@ApiBearerAuth()
@Nivel('colaborador')
@Controller()
export class NecessidadesController {
  constructor(
    private readonly reportarNecessidade: ReportarNecessidadeUseCase,
    private readonly reconfirmarNecessidade: ReconfirmarNecessidadeUseCase,
    private readonly atenderNecessidade: AtenderNecessidadeUseCase,
    private readonly contestarAtendimento: ContestarAtendimentoUseCase,
    private readonly fazerCheckIn: FazerCheckInUseCase,
  ) {}

  /** Reporta o que falta. Se o tipo já está aberto, vira "ainda precisa" (RN02). */
  @Post('necessidades')
  @HttpCode(200)
  @ApiOkResponse({ type: ResultadoAcao })
  async reportar(
    @PerfilAtual() usuario: UsuarioLogado,
    @Body() dto: ReportarNecessidadeDto,
  ): Promise<HttpResponse<ResultadoAcao>> {
    return ok(await this.reportarNecessidade.executar(usuario, dto));
  }

  /** "Ainda precisa": renova o prazo. 1 vez a cada 12 h por usuário. */
  @Post('necessidades/:id/reconfirmar')
  @HttpCode(200)
  @ApiOkResponse({ type: ResultadoAcao })
  async reconfirmar(
    @PerfilAtual() usuario: UsuarioLogado,
    @Param('id', uuid) id: string,
    @Body() dto: AcaoDto,
  ): Promise<HttpResponse<ResultadoAcao>> {
    return ok(await this.reconfirmarNecessidade.executar(usuario, id, dto));
  }

  /** "Abasteci" / "Atendi". Se alguém resolveu antes, devolve `ja_atendida` (RN03). */
  @Post('necessidades/:id/atender')
  @HttpCode(200)
  @ApiOkResponse({ type: ResultadoAcao })
  async atender(
    @PerfilAtual() usuario: UsuarioLogado,
    @Param('id', uuid) id: string,
    @Body() dto: AtenderDto,
  ): Promise<HttpResponse<ResultadoAcao>> {
    return ok(await this.atenderNecessidade.executar(usuario, id, dto));
  }

  /** "Não foi resolvido": reabre até 24 h depois do atendimento (RN03). */
  @Post('necessidades/:id/contestar')
  @HttpCode(200)
  @ApiOkResponse({ type: ResultadoAcao })
  async contestar(
    @PerfilAtual() usuario: UsuarioLogado,
    @Param('id', uuid) id: string,
    @Body() dto: ContestarDto,
  ): Promise<HttpResponse<ResultadoAcao>> {
    return ok(await this.contestarAtendimento.executar(usuario, id, dto));
  }

  /** "Passei aqui, tudo ok". */
  @Post('casinhas/:id/check-in')
  @HttpCode(200)
  @ApiOkResponse({ type: ResultadoAcao })
  async checkIn(
    @PerfilAtual() usuario: UsuarioLogado,
    @Param('id', uuid) id: string,
    @Body() dto: AcaoDto,
  ): Promise<HttpResponse<ResultadoAcao>> {
    return ok(await this.fazerCheckIn.executar(usuario, id, dto));
  }
}
