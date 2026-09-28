import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { type HttpResponse, ok } from '../../../../shared/helpers/index.js';
import { Nivel, PerfilAtual } from '../../../../shared/infra/auth/decoradores.js';
import {
  AreaDto,
  CadastrarCasinhaDto,
  CasinhaDetalhe,
  CasinhasNaAreaResposta,
  MinhaCasinha,
  ResultadoCadastro,
} from '../../application/dto/casinhas.dto.js';
import { CadastrarCasinhaUseCase } from '../../application/use-cases/cadastrar-casinha.use-case.js';
import { DetalharCasinhaUseCase } from '../../application/use-cases/detalhar-casinha.use-case.js';
import { ListarCasinhasNaAreaUseCase } from '../../application/use-cases/listar-casinhas-na-area.use-case.js';
import { ListarMinhasCasinhasUseCase } from '../../application/use-cases/listar-minhas-casinhas.use-case.js';

// Sem @Publico(): o mapa exige login e cadastro concluído (decisão D01, docs/01-visao-geral.md).
@ApiTags('casinhas')
@ApiBearerAuth()
@Nivel('colaborador')
@Controller('casinhas')
export class CasinhasController {
  constructor(
    private readonly listarCasinhasNaArea: ListarCasinhasNaAreaUseCase,
    private readonly detalharCasinha: DetalharCasinhaUseCase,
    private readonly cadastrarCasinha: CadastrarCasinhaUseCase,
  ) {}

  /**
   * Cadastra uma casinha (idempotente pelo id do celular). Com outra casinha a até 30 m, devolve
   * `possivel_duplicata` e as candidatas sem criar nada; reenvie com `forcar: true` se for nova.
   * Precisão do GPS acima de 30 m sem `ajusteManual`: 422 `precisao_insuficiente`.
   */
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: ResultadoCadastro })
  async cadastrar(
    @PerfilAtual() usuario: UsuarioLogado,
    @Body() dto: CadastrarCasinhaDto,
  ): Promise<HttpResponse<ResultadoCadastro>> {
    return ok(await this.cadastrarCasinha.executar(usuario, dto));
  }

  /**
   * Casinhas da área visível do mapa (no máximo 1.000). A coordenada é a exata só para quem
   * pode vê-la (criador, adotante, moderador e o verificado nas que já abriu hoje).
   */
  @Get()
  @ApiOkResponse({ type: CasinhasNaAreaResposta })
  async listarNaArea(
    @PerfilAtual() usuario: UsuarioLogado,
    @Query() area: AreaDto,
  ): Promise<HttpResponse<CasinhasNaAreaResposta>> {
    return ok(await this.listarCasinhasNaArea.executar(usuario, area));
  }

  /** Detalhe da casinha. Para o verificado, ver a exata gasta 1 das 50 casinhas do dia. */
  @Get(':id')
  @ApiOkResponse({ type: CasinhaDetalhe })
  async detalhe(
    @PerfilAtual() usuario: UsuarioLogado,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<HttpResponse<CasinhaDetalhe>> {
    return ok(await this.detalharCasinha.executar(usuario, id));
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Nivel('colaborador')
@Controller('me/casinhas')
export class MinhasCasinhasController {
  constructor(private readonly listarMinhas: ListarMinhasCasinhasUseCase) {}

  /** Casinhas que criei ou adoto, com status e localização exata. */
  @Get()
  @ApiOkResponse({ type: MinhaCasinha, isArray: true })
  async listar(@PerfilAtual() usuario: UsuarioLogado): Promise<HttpResponse<MinhaCasinha[]>> {
    return ok(await this.listarMinhas.executar(usuario));
  }
}
