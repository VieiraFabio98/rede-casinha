/**
 * Recria do zero o banco de TESTES (rede_casinha_test): apaga tudo e reaplica as migrations.
 * Uso: npm run db:reset:test — só quando o banco de testes ficar inconsistente.
 */
import 'dotenv/config';

import { execSync } from 'node:child_process';

const url = process.env.TEST_DATABASE_URL ?? '';
if (!url.includes('_test')) {
  throw new Error(`TEST_DATABASE_URL precisa apontar para um banco *_test. Atual: ${url}`);
}
execSync('npx prisma migrate reset --force', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});
