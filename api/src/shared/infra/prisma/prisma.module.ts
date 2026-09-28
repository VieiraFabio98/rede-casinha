import { Global, Module } from '@nestjs/common';

import { TRANSACAO } from '../../domain/transacao.js';
import { PrismaTransacional } from './prisma-transacional.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [
    PrismaService,
    PrismaTransacional,
    { provide: TRANSACAO, useExisting: PrismaTransacional },
  ],
  exports: [PrismaService, PrismaTransacional, TRANSACAO],
})
export class PrismaModule {}
