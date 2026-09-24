import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Publico } from '../../comum/auth/decoradores.js';
import {
  EntrarComGoogleDto,
  EntrarComSenhaDto,
  PedirCodigoDto,
  RefreshDto,
  TokensResposta,
  VerificarCodigoDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';

/** Rotas de login: abertas, com limite de requisições mais rígido que o resto da API. */
@ApiTags('auth')
@Publico()
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Entra com o ID token do Google Sign-In (cria a conta no primeiro acesso). */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  entrarComGoogle(@Body() dto: EntrarComGoogleDto): Promise<TokensResposta> {
    return this.auth.entrarComGoogle(dto.idToken);
  }

  /** Envia um código de 6 dígitos para o e-mail. A resposta é a mesma exista ou não a conta. */
  @Post('codigo')
  @HttpCode(HttpStatus.ACCEPTED)
  async pedirCodigo(@Body() dto: PedirCodigoDto): Promise<void> {
    await this.auth.pedirCodigo(dto.email);
  }

  /** Entra com o código recebido por e-mail (cria a conta no primeiro acesso). */
  @Post('codigo/verificar')
  @HttpCode(HttpStatus.OK)
  entrarComCodigo(@Body() dto: VerificarCodigoDto): Promise<TokensResposta> {
    return this.auth.entrarComCodigo(dto.email, dto.codigo);
  }

  /** E-mail e senha: só para a conta de demonstração do revisor da loja. */
  @Post('senha')
  @HttpCode(HttpStatus.OK)
  entrarComSenha(@Body() dto: EntrarComSenhaDto): Promise<TokensResposta> {
    return this.auth.entrarComSenha(dto.email, dto.senha);
  }

  /** Troca o refresh token por um novo par de tokens (o refresh antigo deixa de valer). */
  @Post('renovar')
  @HttpCode(HttpStatus.OK)
  renovar(@Body() dto: RefreshDto): Promise<TokensResposta> {
    return this.auth.renovar(dto.refresh);
  }

  /** Encerra a sessão deste refresh token. */
  @Post('sair')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sair(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.sair(dto.refresh);
  }
}
