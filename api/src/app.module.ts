import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { esquemaAmbiente, type Ambiente } from './config/ambiente.js';
import { EmailModule } from './infra/email/email.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { AuthModule } from './modulos/auth/auth.module.js';
import { MeModule } from './modulos/me/me.module.js';
import { SaudeModule } from './modulos/saude/saude.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: esquemaAmbiente }),
    // Limite geral por IP; as rotas de login têm um limite próprio, mais rígido.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Ambiente, true>) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        skipIf: () => config.get('NODE_ENV', { infer: true }) === 'test',
      }),
    }),
    PrismaModule,
    EmailModule,
    AuthModule,
    MeModule,
    SaudeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
