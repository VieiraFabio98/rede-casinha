import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Os testes e2e rodam contra o banco rede_casinha_test (TEST_DATABASE_URL do .env).
// A troca é feita aqui, no carregamento da config, para valer também no globalSetup
// (que roda no processo principal e não recebe `test.env`).
config({ quiet: true });
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Defina TEST_DATABASE_URL no .env para rodar os testes e2e.');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
// E-mails ficam em memória para os testes lerem o código de login.
process.env.EMAIL_DRIVER = 'memoria';
// Arquivos das fotos também (o teste confere o que foi gravado).
process.env.ARMAZENAMENTO_DRIVER = 'memoria';
// Um site liberado no CORS, para o teste de segurança conferir a lista.
process.env.CORS_ORIGENS = 'https://site.teste';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup-global.ts'],
    fileParallelism: false,
  },
});
