import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { type HttpResponse, ok } from '../../../../shared/helpers/index.js';
import { Nivel, PerfilAtual } from '../../../../shared/infra/auth/decoradores.js';
import {
  AlvoDto,
  BloqueioDto,
  FeitoResposta,
  FilaModeracao,
  MesclarDto,
  MotivoDto,
  NivelDto,
  ResolverDenunciaDto,
} from '../../application/dto/moderacao.dto.js';
import { AlterarNivelUseCase } from '../../application/use-cases/alterar-nivel.use-case.js';
import { BloquearUsuarioUseCase } from '../../application/use-cases/bloquear-usuario.use-case.js';
import { MesclarCasinhasUseCase } from '../../application/use-cases/mesclar-casinhas.use-case.js';
import {
  AtivarCasinhaUseCase,
  DesativarCasinhaUseCase,
} from '../../application/use-cases/mudar-situacao-casinha.use-case.js';
import { OcultarConteudoUseCase } from '../../application/use-cases/ocultar-conteudo.use-case.js';
import { ResolverDenunciaUseCase } from '../../application/use-cases/resolver-denuncia.use-case.js';
import { RestaurarConteudoUseCase } from '../../application/use-cases/restaurar-conteudo.use-case.js';
import { VerFilaUseCase } from '../../application/use-cases/ver-fila.use-case.js';

const uuid = new ParseUUIDPipe();

/**
 * Moderação (RF06.3). No MVP é usada pelo Bruno (api/bruno/), sem tela no app.
 * Processo e critérios: docs/moderacao.md.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Nivel('moderador')
@Controller('admin')
export class ModeracaoController {
  constructor(
    private readonly verFila: VerFilaUseCase,
    private readonly ocultarConteudo: OcultarConteudoUseCase,
    private readonly restaurarConteudo: RestaurarConteudoUseCase,
    private readonly desativarCasinha: DesativarCasinhaUseCase,
    private readonly ativarCasinha: AtivarCasinhaUseCase,
    private readonly mesclarCasinhas: MesclarCasinhasUseCase,
    private readonly alterarNivel: AlterarNivelUseCase,
    private readonly bloquearUsuario: BloquearUsuarioUseCase,
    private readonly resolverDenuncia: ResolverDenunciaUseCase,
  ) {}

  /** Denúncias abertas (prioritárias primeiro), casinhas em revisão, pedidos de desativação e possíveis duplicatas. */
  @Get('fila')
  @ApiOkResponse({ type: FilaModeracao })
  async fila(): Promise<HttpResponse<FilaModeracao>> {
    return ok(await this.verFila.executar());
  }

  /** Oculta casinha ou foto; cancela necessidade. As denúncias abertas do alvo viram procedentes. */
  @Post('ocultar')
  @HttpCode(200)
  @ApiOkResponse({ type: FeitoResposta })
  async ocultar(
    @PerfilAtual() eu: UsuarioLogado,
    @Body() dto: AlvoDto,
  ): Promise<HttpResponse<FeitoResposta>> {
    return ok(await this.ocultarConteudo.executar(eu, dto));
  }

  /** Desfaz a ocultação. As denúncias abertas do alvo viram improcedentes. */
  @Post('restaurar')
  @HttpCode(200)
  @ApiOkResponse({ type: FeitoResposta })
  async restaurar(
    @PerfilAtual() eu: UsuarioLogado,
    @Body() dto: AlvoDto,
  ): Promise<HttpResponse<FeitoResposta>> {
    return ok(await this.restaurarConteudo.executar(eu, dto));
  }

  @Post('casinhas/:id/desativar')
  @HttpCode(200)
  @ApiOkResponse({ type: FeitoResposta })
  async desativar(
    @PerfilAtual() eu: UsuarioLogado,
    @Param('id', uuid) id: string,
    @Body() dto: MotivoDto,
  ): Promise<HttpResponse<FeitoResposta>> {
    return ok(await this.desativarCasinha.executar(eu, id, dto.motivo));
  }

  /** Aprova casinha em revisão, reativa, ou mantém depois de um pedido de desativação. */
  @Post('casinhas/:id/ativar')
  @HttpCode(200)
  @ApiOkResponse({ type: FeitoResposta })
  async ativar(
    @PerfilAtual() eu: UsuarioLogado,
    @Param('id', uuid) id: string,
    @Body() dto: MotivoDto,
  ): Promise<HttpResponse<FeitoResposta>> {
    return ok(await this.ativarCasinha.executar(eu, id, dto.motivo));
  }

  /** Mescla a casinha da rota (duplicata) na `destinoId`. */
  @Post('casinhas/:id/mesclar')
  @HttpCode(200)
  @ApiOkResponse({ type: FeitoResposta })
  async mesclar(
    @PerfilAtual() eu: UsuarioLogado,
    @Param('id', uuid) id: string,
    @Body() dto: MesclarDto,
  ): Promise<HttpResponse<FeitoResposta>> {
    return ok(await this.mesclarCasinhas.executar(eu, id, dto.destinoId, dto.motivo));
  }

  @Post('usuarios/:id/nivel')
  @HttpCode(200)
  @ApiOkResponse({ type: FeitoResposta })
  async nivel(
    @PerfilAtual() eu: UsuarioLogado,
    @Param('id', uuid) id: string,
    @Body() dto: NivelDto,
  ): Promise<HttpResponse<FeitoResposta>> {
    return ok(await this.alterarNivel.executar(eu, id, dto.nivel, dto.motivo));
  }

  /** Bloqueia até a data (ou desbloqueia com `ate: null`). */
  @Post('usuarios/:id/bloqueio')
  @HttpCode(200)
  @ApiOkResponse({ type: FeitoResposta })
  async bloqueio(
    @PerfilAtual() eu: UsuarioLogado,
    @Param('id', uuid) id: string,
    @Body() dto: BloqueioDto,
  ): Promise<HttpResponse<FeitoResposta>> {
    return ok(await this.bloquearUsuario.executar(eu, id, dto.ate, dto.motivo));
  }

  @Post('denuncias/:id/resolver')
  @HttpCode(200)
  @ApiOkResponse({ type: FeitoResposta })
  async resolver(
    @PerfilAtual() eu: UsuarioLogado,
    @Param('id', uuid) id: string,
    @Body() dto: ResolverDenunciaDto,
  ): Promise<HttpResponse<FeitoResposta>> {
    return ok(await this.resolverDenuncia.executar(eu, id, dto.procedente, dto.motivo));
  }
}
