import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import type { Ambiente } from '../../config/ambiente.js';
import { AcessoGuard } from '../../shared/infra/auth/acesso.guard.js';
import { AberturaDeSessao } from './application/use-cases/abertura-de-sessao.js';
import { EntrarComCodigoUseCase } from './application/use-cases/entrar-com-codigo.use-case.js';
import { EntrarComGoogleUseCase } from './application/use-cases/entrar-com-google.use-case.js';
import { EntrarComSenhaUseCase } from './application/use-cases/entrar-com-senha.use-case.js';
import { PedirCodigoUseCase } from './application/use-cases/pedir-codigo.use-case.js';
import { RenovarSessaoUseCase } from './application/use-cases/renovar-sessao.use-case.js';
import { SairUseCase } from './application/use-cases/sair.use-case.js';
import { CODIGOS_DE_LOGIN, ENVIO_DE_CODIGO } from './domain/providers/codigos-de-login.provider.js';
import { EMISSOR_DE_TOKENS } from './domain/providers/emissor-de-tokens.provider.js';
import { SENHAS } from './domain/providers/senhas.provider.js';
import { VERIFICADOR_GOOGLE } from './domain/providers/verificador-google.provider.js';
import { CODIGOS_REPOSITORY } from './domain/repositories/codigos.repository.js';
import { CONTAS_REPOSITORY } from './domain/repositories/contas.repository.js';
import { SESSOES_REPOSITORY } from './domain/repositories/sessoes.repository.js';
import { AuthController } from './infra/controllers/auth.controller.js';
import { Argon2Senhas } from './infra/providers/argon2-senhas.js';
import {
  EnvioDeCodigoPorEmail,
  HmacCodigosDeLogin,
} from './infra/providers/codigos-de-login.adapter.js';
import { JwtEmissorDeTokens } from './infra/providers/jwt-emissor-de-tokens.js';
import { VerificadorGoogleAdapter } from './infra/providers/verificador-google.adapter.js';
import { PrismaCodigosRepository } from './infra/repositories/prisma-codigos.repository.js';
import { PrismaContasRepository } from './infra/repositories/prisma-contas.repository.js';
import { PrismaSessoesRepository } from './infra/repositories/prisma-sessoes.repository.js';

/**
 * Login (Google, código por e-mail, senha do revisor) e sessões com refresh rotativo.
 * Registra o JWT e o guard global: toda rota exige login, exceto as marcadas com @Publico().
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Ambiente, true>) => ({
        secret: config.get('JWT_SEGREDO', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AberturaDeSessao,
    EntrarComGoogleUseCase,
    PedirCodigoUseCase,
    EntrarComCodigoUseCase,
    EntrarComSenhaUseCase,
    RenovarSessaoUseCase,
    SairUseCase,
    { provide: CONTAS_REPOSITORY, useClass: PrismaContasRepository },
    { provide: CODIGOS_REPOSITORY, useClass: PrismaCodigosRepository },
    { provide: SESSOES_REPOSITORY, useClass: PrismaSessoesRepository },
    { provide: VERIFICADOR_GOOGLE, useClass: VerificadorGoogleAdapter },
    { provide: EMISSOR_DE_TOKENS, useClass: JwtEmissorDeTokens },
    { provide: CODIGOS_DE_LOGIN, useClass: HmacCodigosDeLogin },
    { provide: ENVIO_DE_CODIGO, useClass: EnvioDeCodigoPorEmail },
    { provide: SENHAS, useClass: Argon2Senhas },
    { provide: APP_GUARD, useClass: AcessoGuard },
  ],
})
export class AuthModule {}
