# Rede Casinha

Mapa colaborativo das casinhas comunitárias para cães e gatos de rua. Documentação em [`docs/`](docs/).

| Pasta | Conteúdo |
|---|---|
| [`app/`](app/) | App Android (React Native + Expo) |
| [`api/`](api/) | API (NestJS + Prisma) |
| [`docker/`](docker/) | Scripts de inicialização do banco local |
| [`docs/`](docs/) | Visão, requisitos, arquitetura, tasks e riscos |

## Banco local (Postgres 18)

```bash
cp .env.example .env      # primeira vez
docker compose up -d      # sobe em localhost:5433
docker compose ps         # espere o status "healthy"
```

| Banco | Uso |
|---|---|
| `rede_casinha` | Desenvolvimento (`DATABASE_URL` em `api/.env`) |
| `rede_casinha_test` | Testes e2e da API (`TEST_DATABASE_URL` em `api/.env`) |

Comandos úteis:

```bash
docker compose exec db psql -U rede -d rede_casinha   # console SQL
docker compose down                                    # para (mantém os dados)
docker compose down -v                                 # apaga os dados e roda o init de novo
```

A porta 5433 foi escolhida para não conflitar com outro Postgres na 5432. Para mudar, altere `POSTGRES_PORT` e `DATABASE_URL` no `.env`.

## API

```bash
cd api && nvm use && cp .env.example .env && npm install && npm run start:dev
```

Detalhes em [`api/README.md`](api/README.md).
