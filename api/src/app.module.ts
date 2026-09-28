import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { RelogioModule } from './shared/infra/relogio.js';
import { esquemaAmbiente, type Ambiente } from './config/ambiente.js';
import { ArmazenamentoModule } from './shared/infra/armazenamento/armazenamento.module.js';
import { EmailModule } from './shared/infra/email/email.module.js';
import { PrismaModule } from './shared/infra/prisma/prisma.module.js';
import { AdocoesModule } from './modulos/adocoes/adocoes.module.js';
import { AuthModule } from './modulos/auth/auth.module.js';
import { CasinhasModule } from './modulos/casinhas/casinhas.module.js';
import { FotosModule } from './modulos/fotos/fotos.module.js';
import { DenunciasModule } from './modulos/denuncias/denuncias.module.js';
import { ModeracaoModule } from './modulos/moderacao/moderacao.module.js';
import { NecessidadesModule } from './modulos/necessidades/necessidades.module.js';
import { MeModule } from './modulos/me/me.module.js';
import { SaudeModule } from './modulos/saude/saude.module.js';
import { StatusModule } from './modulos/status/status.module.js';

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
    RelogioModule,
    // Jobs por tempo (expiração e status). Desligados nos testes, que chamam as tarefas direto.
    ...(process.env.NODE_ENV === 'test' ? [] : [ScheduleModule.forRoot()]),
    PrismaModule,
    EmailModule,
    ArmazenamentoModule,
    AuthModule,
    MeModule,
    CasinhasModule,
    NecessidadesModule,
    AdocoesModule,
    FotosModule,
    DenunciasModule,
    ModeracaoModule,
    StatusModule,
    SaudeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
