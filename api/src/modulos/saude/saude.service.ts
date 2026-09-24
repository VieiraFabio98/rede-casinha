import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SaudeResposta } from './saude.dto.js';

@Injectable()
export class SaudeService {
  private readonly logger = new Logger(SaudeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async verificar(): Promise<SaudeResposta> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, banco: 'ok' };
    } catch (erro) {
      this.logger.error('Banco indisponível', erro instanceof Error ? erro.stack : String(erro));
      return { ok: false, banco: 'erro' };
    }
  }
}
