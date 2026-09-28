# Rede Casinha — API

API em **NestJS 12** (ESM) + **Prisma 7** + **Postgres 18**. Arquitetura em [`../docs/04-arquitetura.md`](../docs/04-arquitetura.md).

## Pré-requisitos

- **Node 24** (`nvm use`: a pasta tem `.nvmrc`). O Nest 12 é só ESM e o CLI exige Node ≥ 22.22.
- Banco local no ar: `docker compose up -d` na raiz do repositório.

## Primeira vez

```bash
nvm use
cp .env.example .env
npm install          # também roda o `prisma generate`
npm run db:deploy    # aplica as migrations no banco local
npm run db:seed      # opcional: 5 usuários e 30 casinhas de exemplo
npm run start:dev    # http://localhost:3000
```

- `GET /saude` → `{ "ok": true, "banco": "ok" }` (503 se o banco estiver fora)
- `GET /docs` → documentação OpenAPI (só fora de produção; JSON em `/docs-json`)
- Rotas de negócio ficam sob `/v1`. Toda rota exige login (`Authorization: Bearer <acesso>`), exceto as marcadas com `@Publico()`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run start:dev` | API com recarga automática |
| `npm run check` | Typecheck + oxlint + Prettier (rodar antes de todo commit) |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes e2e (Vitest + supertest) contra o banco `rede_casinha_test` |
| `npm run format` | Formata o código |
| `npm run db:migrate` | Cria e aplica uma migration em desenvolvimento e regera o client |
| `npm run db:deploy` | Aplica as migrations pendentes (sem apagar nada) |
| `npm run db:seed` | Popula o banco local com dados de exemplo (não duplica se já houver) |
| `npm run db:reset` | **Apaga** o banco local, reaplica as migrations e roda o seed |
| `npm run db:reset:test` | **Apaga** e recria o banco de testes (só se ele ficar inconsistente) |
| `npm run db:studio` | Prisma Studio (ver e editar dados no navegador) |
| `npm run build` | Compila para `dist/` |

## Estrutura

```
src/
├── main.ts               # Bootstrap + Swagger (fora de produção)
├── configurar-app.ts     # Prefixo /v1, ValidationPipe, shutdown hooks (compartilhado com os e2e)
├── app.module.ts
├── config/ambiente.ts    # Variáveis de ambiente validadas com Zod (a API não sobe se faltar algo)
├── shared/               # domain (Transacao, Relogio…), errors, helpers HTTP, infra (prisma, auth, email, armazenamento)
├── modulos/<modulo>/     # domain/ (interfaces + regras), application/ (DTOs + use-cases),
│                         # infra/ (controllers, repositórios Prisma, adaptadores), <modulo>.module.ts
├── arquitetura.spec.ts   # Barra imports proibidos entre as camadas
└── generated/prisma/     # Client gerado (não versionado)
prisma/schema.prisma      # Fonte da verdade do banco (índices parciais via preview `partialIndexes`)
prisma/migrations/        # SQL versionado (a inicial também tem CHECKs escritos à mão)
prisma/seed.ts            # Dados de exemplo determinísticos
scripts/                  # Utilitários (reset do banco de testes)
prisma7.config.ts         # Config do CLI do Prisma (lê DATABASE_URL do .env)
test/                     # Testes e2e + helpers (banco.ts, fabricas.ts, setup-global.ts)
```

## Docker

```bash
docker build -t rede-casinha-api .
docker run --network rede-casinha_default \
  -e DATABASE_URL="postgresql://rede:rede_dev@db:5432/rede_casinha?schema=public" \
  -p 3000:3000 rede-casinha-api
```

O container roda `prisma migrate deploy` antes de subir e tem healthcheck em `/saude`.

## Banco e testes

- **Seed:** centro configurável no `.env` com `SEED_LAT`, `SEED_LNG` e `SEED_RAIO_M` (padrão: Praça da Sé, SP, raio de 3 km). Usuários com e-mail `@seed.test`.
- **e2e:** rodam no banco `rede_casinha_test`. Antes de cada execução o `prisma migrate deploy` aplica migrations pendentes; cada suíte esvazia as tabelas com `limparBanco()`. Os helpers recusam qualquer banco cujo nome não tenha `_test`.
- **Localização exata:** só o módulo `src/modulos/localizacao` pode acessar `casinhaLocalizacao`. O teste `src/arquitetura.spec.ts` falha se outro arquivo de `src/` fizer isso.
- `db:reset` e `db:reset:test` são destrutivos. O Prisma bloqueia esses comandos quando executados por um agente de IA sem o seu consentimento explícito; rode-os você mesmo.

## Autenticação

- **Login:** `POST /v1/auth/google` (ID token do app), `POST /v1/auth/codigo` + `/v1/auth/codigo/verificar` (código de 6 dígitos por e-mail), `POST /v1/auth/senha` (só a conta do revisor). Todos devolvem `{ acesso, refresh, precisaCadastro }`.
- **Sessão:** JWT de acesso de 15 min + refresh rotativo (`POST /v1/auth/renovar`). Reusar um refresh já trocado revoga todas as sessões do usuário. `POST /v1/auth/sair` encerra a sessão.
- **Cadastro:** `POST /v1/me/cadastro` com `{ apelido, maiorDeIdade: true, termosVersao }`.
- **E-mail em desenvolvimento:** com `EMAIL_DRIVER=console`, o código aparece no log da API.
- **Conta do revisor da Play:** `REVISOR_EMAIL=... REVISOR_SENHA=... npm run conta:revisor`.
- **Proteger uma rota:** tudo já exige login. Use `@Publico()` para abrir e `@Nivel('verificado')` (ou outro nível) para exigir cadastro concluído, conta não bloqueada e nível mínimo. O usuário chega no controller com `@UsuarioAtual()`.

## Fotos

- **Envio:** `PUT /v1/fotos/:id` (multipart: `casinhaId`, `atividadeId` opcional, arquivos `foto` até 1 MB e `miniatura` até 200 KB, os dois `image/jpeg`). O id vem do celular: reenviar não duplica. O servidor tira EXIF, XMP e comentários de novo antes de gravar.
- **Leitura:** o detalhe da casinha devolve `fotos[]` e `atividades[].foto` com `url` e `urlMiniatura` relativas à base da API (`/fotos/:id?exp=…&assinatura=…`). A URL é assinada com HMAC, vale de 1 h a 1 h 30 e não precisa de token.
- **Onde ficam:** `ARMAZENAMENTO_DRIVER=disco` grava em `ARMAZENAMENTO_PASTA` (padrão `./armazenamento`, fora do git). Com `s3`, defina `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`. O bucket fica **privado**: o app só vê as fotos pela API. A credencial precisa de `s3:PutObject`, `s3:GetObject` e `s3:DeleteObject` no bucket.
- **Limpeza:** fotos de atividade são apagadas depois de 90 dias (job diário às 4h30 de Brasília). Excluir a conta apaga as fotos enviadas e os arquivos.
