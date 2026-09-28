import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../shared/infra/prisma/prisma.service.js';
import type { BancoDeDados } from '../../domain/providers/banco-de-dados.provider.js';

@Injectable()
export class PrismaBancoDeDados implements BancoDeDados {
  private readonly log = new Logger('Saude');

  constructor(private readonly prisma: PrismaService) {}

  async responde() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (erro) {
      this.log.error('Banco indisponível', erro instanceof Error ? erro.stack : String(erro));
      return false;
    }
  }
}
