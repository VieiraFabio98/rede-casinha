import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { type HttpResponse, ok } from '../../../../shared/helpers/index.js';
import { Nivel, PerfilAtual } from '../../../../shared/infra/auth/decoradores.js';
import { AdotarDto, ResultadoAdocao } from '../../application/dto/adocoes.dto.js';
import { AdotarCasinhaUseCase } from '../../application/use-cases/adotar-casinha.use-case.js';
import { DeixarDeAdotarUseCase } from '../../application/use-cases/deixar-de-adotar.use-case.js';

@ApiTags('adocoes')
@ApiBearerAuth()
@Nivel('colaborador')
@Controller('casinhas/:id/adocao')
export class AdocoesController {
  constructor(
    private readonly adotarCasinha: AdotarCasinhaUseCase,
    private readonly deixarDeAdotarCasinha: DeixarDeAdotarUseCase,
  ) {}

  /**
   * Adota a casinha. Quem não é o criador precisa mandar a posição e estar a até 100 m.
   * Resposta só `ok` ou `nao_permitido`, sem motivo nem distância.
   */
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: ResultadoAdocao })
  async adotar(
    @PerfilAtual() usuario: UsuarioLogado,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdotarDto,
  ): Promise<HttpResponse<ResultadoAdocao>> {
    return ok(await this.adotarCasinha.executar(usuario, id, dto));
  }

  /** Deixa de adotar. */
  @Delete()
  @HttpCode(200)
  @ApiOkResponse({ type: ResultadoAdocao })
  async deixarDeAdotar(
    @PerfilAtual() usuario: UsuarioLogado,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<HttpResponse<ResultadoAdocao>> {
    return ok(await this.deixarDeAdotarCasinha.executar(usuario, id));
  }
}
