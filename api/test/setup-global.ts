import { execSync } from 'node:child_process';

/**
 * Aplica as migrations pendentes no banco de testes antes dos e2e (não apaga nada).
 * Cada suíte começa com `limparBanco()`. Se o banco de testes ficar inconsistente
 * (ex.: uma migration foi editada), recrie-o com `npm run db:reset:test`.
 */
export default function setup() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('_test')) {
    throw new Error(`Os e2e só rodam num banco *_test. DATABASE_URL atual: ${url}`);
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
