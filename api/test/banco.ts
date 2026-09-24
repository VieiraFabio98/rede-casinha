import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

/** Client ligado ao banco de testes (DATABASE_URL é trocada pelo vitest.config.e2e.ts). */
export function criarPrismaDeTeste(): PrismaClient {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('_test')) {
    throw new Error(`Testes e2e só rodam num banco *_test. DATABASE_URL atual: ${url}`);
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Esvazia todas as tabelas (menos o controle de migrations). Chamar no início de cada suíte. */
export async function limparBanco(prisma: PrismaClient): Promise<void> {
  const tabelas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tabelas.length === 0) return;
  const lista = tabelas.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
}
