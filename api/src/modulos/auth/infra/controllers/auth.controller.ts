import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { accepted, type HttpResponse, noContent, ok } from '../../../../shared/helpers/index.js';
import { Publico } from '../../../../shared/infra/auth/decoradores.js';
import {
  EntrarComGoogleDto,
  EntrarComSenhaDto,
  PedirCodigoDto,
  RefreshDto,
  TokensResposta,
  VerificarCodigoDto,
} from '../../application/dto/auth.dto.js';
import { EntrarComCodigoUseCase } from '../../application/use-cases/entrar-com-codigo.use-case.js';
import { EntrarComGoogleUseCase } from '../../application/use-cases/entrar-com-google.use-case.js';
import { EntrarComSenhaUseCase } from '../../application/use-cases/entrar-com-senha.use-case.js';
import { PedirCodigoUseCase } from '../../application/use-cases/pedir-codigo.use-case.js';
import { RenovarSessaoUseCase } from '../../application/use-cases/renovar-sessao.use-case.js';
import { SairUseCase } from '../../application/use-cases/sair.use-case.js';

/** Rotas de login: abertas, com limite de requisições mais rígido que o resto da API. */
@ApiTags('auth')
@Publico()
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly entrarGoogle: EntrarComGoogleUseCase,
    private readonly pedirCodigoPorEmail: PedirCodigoUseCase,
    private readonly entrarCodigo: EntrarComCodigoUseCase,
    private readonly entrarSenha: EntrarComSenhaUseCase,
    private readonly renovarSessao: RenovarSessaoUseCase,
    private readonly encerrarSessao: SairUseCase,
  ) {}

  /** Entra com o ID token do Google Sign-In (cria a conta no primeiro acesso). */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokensResposta })
  async entrarComGoogle(@Body() dto: EntrarComGoogleDto): Promise<HttpResponse<TokensResposta>> {
    return ok(await this.entrarGoogle.executar(dto.idToken));
  }

  /** Envia um código de 6 dígitos para o e-mail. A resposta é a mesma exista ou não a conta. */
  @Post('codigo')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse()
  async pedirCodigo(@Body() dto: PedirCodigoDto): Promise<HttpResponse<undefined>> {
    await this.pedirCodigoPorEmail.executar(dto.email);
    return accepted();
  }

  /** Entra com o código recebido por e-mail (cria a conta no primeiro acesso). */
  @Post('codigo/verificar')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokensResposta })
  async entrarComCodigo(@Body() dto: VerificarCodigoDto): Promise<HttpResponse<TokensResposta>> {
    return ok(await this.entrarCodigo.executar(dto.email, dto.codigo));
  }

  /** E-mail e senha: só para a conta de demonstração do revisor da loja. */
  @Post('senha')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokensResposta })
  async entrarComSenha(@Body() dto: EntrarComSenhaDto): Promise<HttpResponse<TokensResposta>> {
    return ok(await this.entrarSenha.executar(dto.email, dto.senha));
  }

  /** Troca o refresh token por um novo par de tokens (o refresh antigo deixa de valer). */
  @Post('renovar')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokensResposta })
  async renovar(@Body() dto: RefreshDto): Promise<HttpResponse<TokensResposta>> {
    return ok(await this.renovarSessao.executar(dto.refresh));
  }

  /** Encerra a sessão deste refresh token. */
  @Post('sair')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async sair(@Body() dto: RefreshDto): Promise<HttpResponse<null>> {
    await this.encerrarSessao.executar(dto.refresh);
    return noContent();
  }
}
