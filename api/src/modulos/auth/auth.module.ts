import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { AcessoGuard } from '../../comum/auth/acesso.guard.js';
import type { Ambiente } from '../../config/ambiente.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CodigoEmailService } from './codigo-email.service.js';
import { GoogleService } from './google.service.js';
import { SessoesService } from './sessoes.service.js';

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
    AuthService,
    SessoesService,
    CodigoEmailService,
    GoogleService,
    // Guard global: toda rota da API exige login, exceto as marcadas com @Publico().
    { provide: APP_GUARD, useClass: AcessoGuard },
  ],
})
export class AuthModule {}
