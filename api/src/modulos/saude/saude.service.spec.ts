import { Logger } from '@nestjs/common';

import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SaudeService } from './saude.service.js';

describe('SaudeService', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('responde ok quando o banco responde', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const servico = new SaudeService(prisma as unknown as PrismaService);

    await expect(servico.verificar()).resolves.toEqual({ ok: true, banco: 'ok' });
  });

  it('responde erro quando o banco falha', async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error('conexão recusada')) };
    const servico = new SaudeService(prisma as unknown as PrismaService);

    await expect(servico.verificar()).resolves.toEqual({ ok: false, banco: 'erro' });
  });
});
