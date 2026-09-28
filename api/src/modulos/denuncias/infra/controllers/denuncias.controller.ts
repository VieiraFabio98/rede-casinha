import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { type HttpResponse, ok } from '../../../../shared/helpers/index.js';
import { Nivel, PerfilAtual } from '../../../../shared/infra/auth/decoradores.js';
import {
  DenunciarDto,
  PedirDesativacaoDto,
  RecebidoResposta,
} from '../../application/dto/denuncias.dto.js';
import { DenunciarUseCase } from '../../application/use-cases/denunciar.use-case.js';
import { PedirDesativacaoUseCase } from '../../application/use-cases/pedir-desativacao.use-case.js';

@ApiTags('denuncias')
@ApiBearerAuth()
@Nivel('colaborador')
@Controller()
export class DenunciasController {
  constructor(
    private readonly denunciarAlvo: DenunciarUseCase,
    private readonly pedirDesativacaoCasinha: PedirDesativacaoUseCase,
  ) {}

  /** Denuncia casinha, foto, necessidade ou usuário (RF06.1). Resposta sempre `ok`. */
  @Post('denuncias')
  @HttpCode(200)
  @ApiOkResponse({ type: RecebidoResposta })
  async denunciar(
    @PerfilAtual() usuario: UsuarioLogado,
    @Body() dto: DenunciarDto,
  ): Promise<HttpResponse<RecebidoResposta>> {
    return ok(await this.denunciarAlvo.executar(usuario, dto));
  }

  /** "A casinha não existe mais" (RF02.7): pedido para a moderação. */
  @Post('casinhas/:id/desativacao')
  @HttpCode(200)
  @ApiOkResponse({ type: RecebidoResposta })
  async pedirDesativacao(
    @PerfilAtual() usuario: UsuarioLogado,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PedirDesativacaoDto,
  ): Promise<HttpResponse<RecebidoResposta>> {
    return ok(await this.pedirDesativacaoCasinha.executar(usuario, id, dto));
  }
}
