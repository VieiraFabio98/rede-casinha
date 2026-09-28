import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { Transacao } from '../../domain/transacao.js';
import { PrismaService } from './prisma.service.js';

/**
 * Implementa a `Transacao` com AsyncLocalStorage: dentro de `executar`, `cliente()` devolve a
 * transação aberta; fora, o client normal. Os repositórios sempre usam `cliente()`, então entram
 * sozinhos na transação do use-case, sem receber `tx` por parâmetro.
 */
@Injectable()
export class PrismaTransacional implements Transacao {
  private readonly atual = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(private readonly prisma: PrismaService) {}

  cliente(): Prisma.TransactionClient {
    return this.atual.getStore() ?? this.prisma;
  }

  executar<T>(trabalho: () => Promise<T>): Promise<T> {
    if (this.atual.getStore()) return trabalho();
    return this.prisma.$transaction((tx) => this.atual.run(tx, trabalho));
  }
}
