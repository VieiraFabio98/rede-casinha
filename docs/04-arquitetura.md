# 04 — Arquitetura

## Visão geral

Arquitetura **app + API própria + Postgres**. O app Expo nunca fala com o banco: tudo passa pela **API NestJS**, que concentra as regras de negócio, a autorização e a proteção da localização.

- **Leituras** sensíveis (mapa, detalhe) passam por endpoints que decidem, por usuário, se devolvem a localização exata ou a pública.
- **Toda escrita** passa por endpoints que validam o DTO, a permissão, os limites diários e as regras de negócio numa **transação** do Prisma. Escritas vindas do celular são **idempotentes** pelo UUID gerado no aparelho.
- **Tarefas por tempo** (expiração, status "sem notícias", limpeza de fotos) rodam no processo da API com `@nestjs/schedule`.
- **Fotos** ficam atrás de uma interface de armazenamento (disco do servidor ou bucket S3 privado, por `ARMAZENAMENTO_DRIVER`) e só são servidas pela API, por URL assinada.
- **Integrações** externas: Google (validação do ID token), Resend (e-mail), Expo Push (F2).

```mermaid
flowchart LR
  subgraph APP["App Android (Expo / React Native)"]
    UI["Telas<br/>(Expo Router)"]
    MAP["MapLibre<br/>(tiles vetoriais)"]
    RQ["TanStack Query<br/>cache persistido"]
    OB[("Outbox<br/>expo-sqlite")]
    SW["Sync worker"]
    IMG["Compressão de foto<br/>(remove EXIF)"]
  end

  subgraph VPS["VPS (Oracle Cloud, São Paulo) — Docker Compose"]
    CADDY["Caddy<br/>HTTPS"]
    API["API NestJS<br/>guards · DTOs · serviços"]
    CRON["@nestjs/schedule<br/>expiração / status"]
    FS[("Disco<br/>fotos")]
    DB[("Postgres 18<br/>via Prisma")]
  end

  OFM["OpenFreeMap<br/>tiles"]
  GOO["Google<br/>(ID token)"]
  MAIL["Resend<br/>e-mail"]
  EXPO["Expo Push<br/>→ FCM (F2)"]
  SEN["Sentry"]
  PH["PostHog"]
  GH["GitHub Pages<br/>política / exclusão de conta"]

  UI --> RQ --> CADDY
  UI --> OB --> SW --> CADDY
  IMG --> OB
  MAP --> OFM
  CADDY --> API
  API --> DB
  API --> FS
  CRON --> DB
  API --> GOO
  API --> MAIL
  API --> EXPO
  APP -.-> SEN
  APP -.-> PH
```

## Estrutura do repositório

Monorepo simples, sem ferramenta de monorepo:

```
rede-casinha/
├── app/                          # Projeto Expo (SDK 57)
│   ├── src/
│   │   ├── app/                  # Rotas (Expo Router): só telas e layouts
│   │   │   ├── _layout.tsx       # Stack raiz
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx     # Mapa
│   │   │   │   ├── minhas.tsx    # Minhas casinhas
│   │   │   │   └── perfil.tsx
│   │   │   ├── casinha/[id].tsx  # Detalhe
│   │   │   ├── casinha/nova.tsx  # Cadastro
│   │   │   ├── necessidade/nova.tsx
│   │   │   └── login.tsx
│   │   ├── api/                  # Cliente HTTP, tipos gerados do OpenAPI, hooks React Query
│   │   ├── offline/              # outbox.ts, sync-worker.ts, schema.sql
│   │   ├── map/                  # Camadas, estilos, clustering
│   │   ├── fotos/                # Compressão, upload
│   │   ├── domain/               # Tipos, regras puras (ex.: rótulos de status)
│   │   ├── components/           # Componentes de UI
│   │   ├── constants/            # Tema, espaçamentos
│   │   ├── hooks/
│   │   └── i18n/pt-BR.ts
│   ├── app.config.ts
│   └── eas.json
├── api/                          # API NestJS 12 (ESM, Node 24)
│   ├── prisma/
│   │   ├── schema.prisma         # Fonte da verdade do banco
│   │   ├── migrations/           # SQL versionado (inclui índices parciais manuais)
│   │   └── seed.ts
│   ├── src/
│   │   ├── main.ts               # Bootstrap + Swagger (fora de produção)
│   │   ├── configurar-app.ts     # Prefixo /v1, ValidationPipe, shutdown hooks (também usado nos e2e)
│   │   ├── config/ambiente.ts    # Variáveis de ambiente validadas com Zod
│   │   ├── app.module.ts
│   │   ├── shared/               # O que todos os módulos usam:
│   │   │   ├── domain/           #   Transacao, RELOGIO, UsuarioLogado, geo, tempo, texto (puro)
│   │   │   ├── errors/           #   NotFoundError, ConflictError… (viram HTTP no filtro)
│   │   │   ├── helpers/          #   ok(), created(), noContent()…
│   │   │   ├── filters/ interceptors/
│   │   │   └── infra/            #   prisma/, auth/ (guard, @Publico, @Nivel), email/, relogio
│   │   └── modulos/              # auth, me, casinhas, localizacao, necessidades, adocoes,
│   │                             # denuncias, moderacao, status, limites, saude
│   │                             # (cada um com domain/ application/ infra/, ver abaixo)
│   ├── prisma7.config.ts         # Config do CLI do Prisma
│   ├── test/                     # e2e (Vitest + supertest) contra rede_casinha_test
│   ├── bruno/                    # Coleção de requisições (inclui rotas /admin)
│   └── Dockerfile
├── docker/postgres/init/         # Scripts de inicialização do banco local
├── docker-compose.yml            # Postgres local
├── site/                         # GitHub Pages: privacidade, termos, excluir conta
└── docs/
```

## Camadas de um módulo

Decisão D02 ([01-visao-geral.md](01-visao-geral.md#d02--camadas-dentro-de-cada-módulo-da-api-2026-09-28)). Todos os módulos seguem este formato; exemplo: `modulos/necessidades/`.

```
modulos/necessidades/
├── domain/                  só TypeScript: sem Nest, sem Prisma
│   ├── entities/            interfaces das entidades (Necessidade, Atividade…)
│   ├── repositories/        interfaces + token de injeção (NECESSIDADES_REPOSITORY)
│   ├── providers/           portas para o que vem de fora (proximidade, status, limites, acesso à casinha)
│   └── regras.ts            regras puras (prazos, pode contestar?), com teste unitário
├── application/
│   ├── dto/                 entrada e saída (class-validator; viram o OpenAPI → tipos do app)
│   └── use-cases/           um por ação; recebem as portas por @Inject(TOKEN)
├── infra/
│   ├── controllers/         HTTP: rota, guard, DTO → use-case → ok(...)
│   ├── repositories/        Prisma; convertem a linha do banco na entidade
│   └── providers/           adaptadores das portas para os outros módulos
└── necessidades.module.ts   liga cada token à implementação da infra
```

- **Transação:** use-cases chamam `transacao.executar(...)` (porta `Transacao` em `shared/domain`). A implementação (`infra/prisma/prisma-transacional.ts`) guarda a transação num `AsyncLocalStorage`, e todo repositório usa `db.cliente()`: entra sozinho na transação em curso, sem receber `tx`.
- **Relógio e usuário:** `RELOGIO` (porta) e `UsuarioLogado` (`{ id, nivel }`) em `shared/domain`, para os use-cases não dependerem do `Perfil` do Prisma.
- **Erros:** use-cases lançam os erros de `shared/errors` (`NotFoundError`, `ConflictError(mensagem, codigo)`…); o `AppErrorFilter` responde `{ name, message, codigo? }`. O `codigo` é o que o app usa para decidir (ex.: `limite_diario` não é repetido pela fila).
- **Respostas:** controllers devolvem `ok(...)` / `noContent()` de `shared/helpers`; o `HttpResponseInterceptor` aplica o status. O tipo da resposta vai no `@ApiOkResponse({ type })`, senão o OpenAPI perde o tipo.
- **Entre módulos:** um módulo nunca usa o repositório de outro. Ele declara a porta de que precisa no próprio `domain/providers` e um adaptador na `infra/providers` chama o use-case que o outro módulo exporta (ex.: `necessidades` → `TravarCasinhaParaAcaoUseCase` de `casinhas`, `ConsumirLimiteUseCase` de `limites`, `RecalcularStatusUseCase` de `status`). Tipos puros do `domain` de outro módulo (`StatusCasinha`, `TipoNecessidade`, `Alvo`) podem ser importados direto.
- **Enums:** DTOs validam com `@IsIn(LISTA)` usando as listas `as const` do `domain` (ex.: `TIPOS_NECESSIDADE`), não os enums do Prisma.
- **Testes:** regras puras e use-cases com dublês em memória (sem banco) em `*.spec.ts`; os e2e continuam cobrindo o que só o Postgres garante. `src/arquitetura.spec.ts` barra imports proibidos entre as camadas e arquivos soltos fora de `domain/`, `application/` e `infra/`. Nos e2e, dublês entram por token (`overrideProvider(VERIFICADOR_GOOGLE)`) ou pela classe `Relogio`.

## Módulos da API (NestJS)

| Módulo | Responsabilidade |
|---|---|
| `auth` | Login Google, código por e-mail, senha (revisor), emissão e rotação de tokens, logout |
| `me` | Perfil do usuário logado, conclusão de cadastro, exclusão de conta, "minhas casinhas" |
| `casinhas` | Cadastro, edição, busca por área, detalhe, check-in, pedido de desativação |
| `localizacao` | **Único** módulo que lê `casinhas_localizacao`: `podeVerExata`, geração da localização pública, validação de proximidade, auditoria de acessos |
| `necessidades` | Reportar, reconfirmar, atender, contestar |
| `adocoes` | Adotar e deixar de adotar |
| `fotos` | Upload idempotente, URL assinada, entrega do arquivo |
| `denuncias` | Denunciar, ocultação automática |
| `admin` | Rotas de moderação (`@Nivel('moderador')`) |
| `status` | `recalcularStatus` (RN01), prazos (RN02), jobs `@Cron` |
| `limites` | `consumirLimite` (RN06) |
| `saude` | `GET /saude` |
| `infra/prisma` | `PrismaService` global |
| `infra/armazenamento` | Interface `Armazenamento` com drivers `disco`, `s3` (AWS S3 ou R2) e `memoria` (testes); `AssinaturaDeUrls` (HMAC das URLs de fotos) |
| `infra/email` | Envio via Resend, templates em pt-BR |

**Peças transversais:**
- **Guard global de autenticação** (`@nestjs/jwt`): toda rota exige token, exceto as marcadas com `@Publico()`.
- **`NivelGuard`** + `@Nivel('verificado' | 'moderador' | 'admin')` para rotas restritas.
- **`ThrottlerGuard`** (`@nestjs/throttler`): limite por IP, mais rígido nas rotas `/auth`.
- **`ValidationPipe` global** (`whitelist`, `forbidNonWhitelisted`, `transform`): DTOs com `class-validator`.
- **Filtro de exceções** que traduz erros do Prisma (ex.: `P2002` → 409) e nunca devolve detalhes internos.
- **`@UsuarioAtual()`**: decorator que injeta `{ id, nivel }` do token no controller.

## Modelo de dados

Convenção do Prisma: modelos em PascalCase no singular (`Casinha`), mapeados para tabelas em snake_case no plural (`@@map("casinhas")`). Campos em camelCase no código e snake_case no banco (`@map`). A tabela abaixo usa os nomes do banco.

Índices únicos parciais são declarados no schema com a preview feature `partialIndexes` do Prisma 7. As restrições `CHECK` (faixa de coordenadas, contadores não negativos, adoção encerrada com data) estão escritas à mão na migration inicial; o Prisma não as modela nem as remove.

### Tipos enumerados

| Enum | Valores |
|---|---|
| `nivel_acesso` | `colaborador`, `verificado`, `moderador`, `admin` |
| `animais_atendidos` | `caes`, `gatos`, `ambos` |
| `status_casinha` | `ok`, `atencao`, `urgente`, `sem_noticias` |
| `situacao_casinha` | `ativa`, `em_revisao`, `inativa` |
| `tipo_necessidade` | `racao`, `agua`, `reforma`, `cobertas`, `limpeza`, `remedio_veterinario`, `outro` |
| `urgencia` | `normal`, `urgente` |
| `status_necessidade` | `aberta`, `atendida`, `expirada`, `cancelada` |
| `tipo_atividade` | `cadastro`, `reporte`, `reconfirmacao`, `atendimento`, `contestacao`, `check_in`, `edicao`, `adocao`, `fim_adocao`, `expiracao`, `desativacao_pedida`, `moderacao` |
| `status_moderacao` | `visivel`, `oculto_auto`, `oculto_moderador` |

### Entidades de conta

#### `usuarios`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `email` | text unique | minúsculo |
| `google_sub` | text unique null | `sub` do ID token do Google |
| `senha_hash` | text null | `argon2`; só a conta de demonstração do revisor |
| `email_verificado_em` | timestamptz null | |
| `criado_em` | timestamptz | |

#### `sessoes`: refresh tokens
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `usuario_id` | uuid FK | `on delete cascade` |
| `refresh_hash` | text unique | SHA-256 do token opaco |
| `expira_em` | timestamptz | 60 dias |
| `revogada_em` | timestamptz null | |
| `substituida_por` | uuid null | rotação: reuso de um token já substituído revoga todas as sessões do usuário |
| `criada_em` | timestamptz | |

#### `codigos_email`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `email` | text | índice |
| `codigo_hash` | text | |
| `expira_em` | timestamptz | +10 min |
| `tentativas` | int | máx. 5 |
| `usado_em` | timestamptz null | |

#### `perfis`: 1:1 com `usuarios`, criado ao concluir o cadastro
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `usuarios.id`, `on delete cascade` |
| `apelido` | varchar(30) | 3 a 30 caracteres, como digitado |
| `apelido_normalizado` | varchar(30) unique | minúsculas e sem acentos: "Márcia" e "marcia" colidem |
| `nivel` | nivel_acesso | padrão `colaborador` |
| `maior_de_idade_em` | timestamptz | quando declarou ter 18 anos ou mais |
| `termos_versao` | text | ex.: `2026-10-01` |
| `termos_aceitos_em` | timestamptz | |
| `bloqueado_ate` | timestamptz null | |
| `verificado_por` | uuid null FK perfis | quem promoveu |
| `criado_em` | timestamptz | |

### Entidades do domínio

#### `casinhas`: dados **públicos**
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | **gerado no celular** (idempotência offline) |
| `nome` | text | 3 a 60 caracteres |
| `descricao` | text null | até 500 caracteres |
| `animais` | animais_atendidos | |
| `lat_publica`, `lng_publica` | double precision | ponto deslocado 150–400 m; índice composto `(lat_publica, lng_publica)` |
| `uf` | char(2) null | preenchido em F2 (geocodificação reversa) |
| `municipio_ibge` | int null | F2/F3 |
| `status` | status_casinha | calculado (RN01) |
| `situacao` | situacao_casinha | padrão `ativa` |
| `ultima_atividade_em` | timestamptz | |
| `criada_por` | uuid FK perfis null | null se a conta foi excluída |
| `criada_em`, `atualizada_em` | timestamptz | |
| `moderacao` | status_moderacao | |
| `mesclada_em` | uuid null FK casinhas | destino da mescla |

#### `casinhas_localizacao`: dados **sensíveis**, 1:1 com casinhas
| Campo | Tipo | Notas |
|---|---|---|
| `casinha_id` | uuid PK FK casinhas | |
| `lat`, `lng` | double precision | exata; índice composto `(lat, lng)` |
| `precisao_m` | real | precisão do GPS no cadastro |
| `atualizada_em` | timestamptz | |

**Só o módulo `localizacao` da API acessa esta tabela.** A regra é aplicada por lint (`no-restricted-imports`/`no-restricted-syntax` para `prisma.casinhaLocalizacao` fora do módulo) e coberta por testes e2e.

#### `adocoes`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `casinha_id` | uuid FK | |
| `usuario_id` | uuid FK perfis | |
| `ativa` | boolean | índice único parcial `(casinha_id, usuario_id) where ativa`; `CHECK (ativa OR encerrada_em IS NOT NULL)` |
| `iniciada_em`, `encerrada_em` | timestamptz | |

Regra: no máximo 3 `ativa = true` por casinha (verificado no serviço, dentro da transação).

#### `necessidades`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | gerado no celular |
| `casinha_id` | uuid FK | |
| `tipo` | tipo_necessidade | |
| `urgencia` | urgencia | |
| `observacao` | text null | até 280 caracteres |
| `status` | status_necessidade | |
| `criada_por` | uuid FK null | |
| `criada_em` | timestamptz | horário do servidor |
| `criada_no_celular_em` | timestamptz | horário do celular (útil no offline) |
| `expira_em` | timestamptz | `criada_em + prazo(tipo)` (RN02) |
| `atendida_por` | uuid FK null | |
| `atendida_em` | timestamptz null | |
| `validado_local` | boolean null | **nunca exposto ao app** |

Índice único parcial `(casinha_id, tipo) where status = 'aberta'`, que garante a RN02.

#### `atividades`: histórico *append-only*
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | gerado no celular |
| `casinha_id` | uuid FK | |
| `necessidade_id` | uuid FK null | |
| `tipo` | tipo_atividade | |
| `usuario_id` | uuid FK null | |
| `observacao` | text null | |
| `criada_em` | timestamptz | servidor |
| `criada_no_celular_em` | timestamptz | celular |
| `validado_local` | boolean null | não exposto |

#### `fotos`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | gerado no celular |
| `casinha_id` | uuid FK | |
| `atividade_id` | uuid FK null | null = foto de perfil da casinha |
| `chave` | text | `fotos/{casinha_id}/{id}.jpg` na interface de armazenamento |
| `chave_miniatura` | text | `fotos/{casinha_id}/{id}_t.jpg` |
| `enviada_por` | uuid FK null | |
| `criada_em` | timestamptz | |
| `expira_em` | timestamptz null | fotos de atendimento: +90 dias |
| `moderacao` | status_moderacao | |

#### `denuncias`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `alvo_tipo` | enum `alvo_denuncia` | `casinha`, `foto`, `necessidade`, `perfil` |
| `alvo_id` | uuid | |
| `motivo` | enum `motivo_denuncia` | `falsa`, `duplicada`, `ofensiva`, `expoe_pessoa`, `perigo_animais`, `outro` |
| `descricao` | text null | |
| `denunciante_id` | uuid FK | único por `(alvo_id, denunciante_id)` |
| `status` | enum `status_denuncia` | `aberta`, `procedente`, `improcedente` |
| `resolvida_por`, `resolvida_em` | | |

#### `acoes_moderacao`: auditoria de moderação
`id`, `moderador_id`, `acao`, `alvo_tipo`, `alvo_id`, `motivo`, `criada_em`.

#### `acessos_localizacao`: auditoria
| Campo | Tipo | Notas |
|---|---|---|
| `usuario_id` | uuid | |
| `casinha_id` | uuid | |
| `dia` | date | PK composta `(usuario_id, casinha_id, dia)` |

É usada para aplicar o limite de 50 casinhas por dia por verificado e para investigar abusos. Retenção de 180 dias.

#### `limites_uso`: rate limit por regra de negócio
| Campo | Tipo |
|---|---|
| `usuario_id`, `acao`, `dia` | PK composta |
| `quantidade` | int |

#### `dispositivos` (F2)
`id`, `usuario_id`, `expo_push_token` (unique), `plataforma`, `criado_em`, `ultimo_uso_em`.

### Diagrama ER

```mermaid
erDiagram
  USUARIOS ||--o| PERFIS : "tem"
  USUARIOS ||--o{ SESSOES : "abre"
  PERFIS ||--o{ CASINHAS : "cria"
  PERFIS ||--o{ ADOCOES : "adota"
  PERFIS ||--o{ NECESSIDADES : "reporta/atende"
  PERFIS ||--o{ ATIVIDADES : "registra"
  PERFIS ||--o{ FOTOS : "envia"
  PERFIS ||--o{ DENUNCIAS : "denuncia"
  PERFIS ||--o{ DISPOSITIVOS : "possui"
  PERFIS ||--o{ ACESSOS_LOCALIZACAO : "consulta"
  CASINHAS ||--|| CASINHAS_LOCALIZACAO : "tem exata"
  CASINHAS ||--o{ ADOCOES : "tem"
  CASINHAS ||--o{ NECESSIDADES : "tem"
  CASINHAS ||--o{ ATIVIDADES : "histórico"
  CASINHAS ||--o{ FOTOS : "tem"
  NECESSIDADES ||--o{ ATIVIDADES : "gera"
  ATIVIDADES ||--o| FOTOS : "anexa"

  USUARIOS {
    uuid id PK
    text email
    text google_sub
  }
  SESSOES {
    uuid id PK
    uuid usuario_id FK
    text refresh_hash
    timestamptz expira_em
  }
  PERFIS {
    uuid id PK
    text apelido
    nivel_acesso nivel
    timestamptz bloqueado_ate
  }
  CASINHAS {
    uuid id PK
    text nome
    animais_atendidos animais
    double lat_publica
    double lng_publica
    status_casinha status
    situacao_casinha situacao
    timestamptz ultima_atividade_em
  }
  CASINHAS_LOCALIZACAO {
    uuid casinha_id PK
    double lat
    double lng
    real precisao_m
  }
  ADOCOES {
    uuid id PK
    uuid casinha_id FK
    uuid usuario_id FK
    boolean ativa
  }
  NECESSIDADES {
    uuid id PK
    uuid casinha_id FK
    tipo_necessidade tipo
    urgencia urgencia
    status_necessidade status
    timestamptz expira_em
  }
  ATIVIDADES {
    uuid id PK
    uuid casinha_id FK
    uuid necessidade_id FK
    tipo_atividade tipo
    timestamptz criada_em
  }
  FOTOS {
    uuid id PK
    uuid casinha_id FK
    uuid atividade_id FK
    text chave
  }
  DENUNCIAS {
    uuid id PK
    text alvo_tipo
    uuid alvo_id
    text motivo
  }
  DISPOSITIVOS {
    uuid id PK
    text expo_push_token
  }
  ACESSOS_LOCALIZACAO {
    uuid usuario_id PK
    uuid casinha_id PK
    date dia PK
  }
```

## Geo sem PostGIS (`api/src/shared/domain/geo.ts`)

Funções puras, com testes unitários:

```ts
const RAIO_TERRA_M = 6_371_000;

/** Distância em metros entre dois pontos (haversine). */
export function distanciaM(a: Ponto, b: Ponto): number { /* ... */ }

/** Ponto de destino a partir de uma origem, distância (m) e azimute (graus). */
export function destino(origem: Ponto, distanciaM: number, azimuteGraus: number): Ponto { /* ... */ }

/** Caixa (lat/lng) que contém um círculo de raio `raioM`: pré-filtro para usar o índice. */
export function caixaAoRedor(centro: Ponto, raioM: number): Caixa { /* ... */ }
```

- **Busca por área do mapa:** `WHERE lat_publica BETWEEN :minLat AND :maxLat AND lng_publica BETWEEN :minLng AND :maxLng` (índice composto).
- **"Tem casinha a até 30 m?" e "está a até 100 m?":** `caixaAoRedor` filtra no banco (índice) e `distanciaM` confirma em TypeScript.

### Localização pública: como é gerada

Executado **uma vez**, dentro da transação de criação da casinha (e de novo só se a exata mudar mais de 30 m):

```ts
// distância entre 150 e 400 m, direção aleatória (crypto.randomInt)
const publica = destino(exata, 150 + aleatorio() * 250, aleatorio() * 360);
```

O app desenha um círculo de **500 m** em volta da localização pública. Como o deslocamento máximo é de 400 m, a casinha real sempre fica dentro do círculo.

## Endpoints

Todos sob `https://<dominio>/v1`, exceto `GET /saude` (na raiz, para o monitoramento). OpenAPI em `/docs` (só fora de produção) (gerado pelo `@nestjs/swagger`), de onde o app gera seus tipos (`npm run gen:api`). Escritas vindas do celular são **idempotentes**: o corpo traz o `id` (ou `atividadeId`) gerado no aparelho, e repetir a chamada devolve o mesmo resultado sem duplicar.

### Autenticação (`@Publico()`, com throttling rígido)
| Método e rota | Corpo | Efeito |
|---|---|---|
| `POST /auth/google` | `{ idToken }` | Valida o ID token (audience = cliente Web), cria ou encontra o usuário, devolve `{ acesso, refresh, precisaCadastro }` |
| `POST /auth/codigo` | `{ email }` | Gera e envia o código de 6 dígitos (resposta sempre igual, exista ou não a conta) |
| `POST /auth/codigo/verificar` | `{ email, codigo }` | Valida (10 min, 5 tentativas) e devolve os tokens |
| `POST /auth/senha` | `{ email, senha }` | Só para a conta de demonstração do revisor |
| `POST /auth/renovar` | `{ refresh }` | Rotaciona o refresh; reuso de um token antigo revoga todas as sessões |
| `POST /auth/sair` | `{ refresh }` | Revoga a sessão |

### Leitura
| Método e rota | Acesso | Retorno | Regras |
|---|---|---|---|
| `GET /casinhas?minLat&minLng&maxLat&maxLng` | logado | `{ casinhas: [{ id, nome, status, animais, lat, lng, exata, necessidadesAbertas[] }], truncado }` | Filtra pela coordenada **pública**. Máx. 1.000 itens (`truncado = true` se havia mais). Exata para criador, adotante e moderador; o verificado vê na lista **só** as que já abriu hoje no detalhe (a lista não gasta cota). Não traz inativas nem ocultadas. Coordenadas com 6 casas. ~200 bytes por casinha sem compressão. |
| `GET /casinhas/:id` | logado | casinha + necessidades abertas + adotantes (apelidos) + 30 últimas atividades (`apelido: null` = usuário removido) + `minhasPermissoes`. Fotos entram na T1.5. | Para o verificado, devolver a exata gasta 1 das 50 casinhas distintas do dia e registra em `acessos_localizacao`. Ocultada: só moderador, criador e adotantes; inativa: só moderador; senão 404. |
| `GET /me` | logado | conta + perfil (`null` com cadastro pendente) | |
| `GET /me/contagens` | logado | `{ contribuicoes, atendimentos, casinhasAdotadas }` | Para a tela de perfil. |
| `GET /me/casinhas` | logado | casinhas que criei ou adotei: mesmos campos do mapa + `souCriador`, `souAdotante` | Sempre com a exata. Inclui as ocultadas por denúncia; não inclui as inativas. |
| `GET /fotos/:id?exp&assinatura` e `GET /fotos/:id/miniatura?exp&assinatura` | URL assinada | arquivo JPEG | HMAC de `id:variante:exp`; vale de 1 h a 1 h 30 (blocos de 30 min, para o cache do app). `Cache-Control: private, immutable`. Foto oculta pela moderação: 404. |
| `GET /saude` | público | `{ ok, banco }` | Fora do prefixo `/v1`. 503 se o banco estiver fora. |

### Escrita (exigem login, perfil não bloqueado e os limites da RN06)

Reportar, reconfirmar, atender, contestar e check-in (módulo `necessidades`) respondem `{ resultado, necessidadeId, status }` e travam a linha da casinha durante a transação. Reenviar o mesmo id devolve 200 sem repetir o efeito. Erros de regra são 4xx (`limite_diario` é 403, não 429), para a fila do celular não insistir.
| Método e rota | Corpo | Efeito |
|---|---|---|
| `POST /me/cadastro` | `{ apelido, maiorDeIdade, termosVersao }` | Cria o `perfis`. |
| `DELETE /me` | — | RN07, numa transação: apaga fotos, códigos de login e o usuário (em cascata: perfil, sessões, adoções, acessos, limites); o histórico fica sem autor ("Usuário removido"). Depois da transação, apaga os arquivos das fotos. 204. Vale com cadastro pendente e conta bloqueada. |
| `POST /casinhas` | `{ id, nome, descricao?, animais, lat, lng, precisaoM, ajusteManual?, forcar?, criadaNoCelularEm? }` | Recusa com 422 `precisao_insuficiente` se `precisaoM > 30` sem `ajusteManual`. Procura casinhas visíveis e não inativas a até 30 m: se houver e `forcar` não vier, devolve `{ resultado: 'possivel_duplicata', candidatas: [{ id, nome, miniatura }] }` sem coordenadas e sem criar (conta no limite de 10/dia). Senão cria `casinhas` (status `ok`; `em_revisao` se havia vizinha e veio `forcar`) + `casinhas_localizacao` + atividade `cadastro` + adoção do criador, e responde `{ resultado: 'ok', id, emRevisao }`. 5 cadastros/dia (20 do verificado). Reenviar o mesmo id devolve `ok` sem repetir. |
| `PATCH /casinhas/:id` | `{ nome?, descricao?, animais?, lat?, lng? }` | Só criador, adotante ou moderador. Mudança de localização limitada a 30 m (exceto moderador). |
| `POST /casinhas/:id/check-in` | `{ atividadeId, lat?, lng?, criadaNoCelularEm? }` | Atualiza `ultima_atividade_em` e recalcula o status. |
| `POST /casinhas/:id/desativacao` | `{ atividadeId, motivo }` | Atividade `desativacao_pedida` + entrada na fila de moderação. Idempotente pelo `atividadeId`; conta no limite de denúncias (20/dia). |
| `POST /casinhas/:id/adocao` | `{ lat, lng }` | Permitido ao criador, ou a quem está ≤ 100 m da exata. Resposta só `ok` ou `nao_permitido`, **sem distância nem motivo**. Máx. 3 adotantes. 3 tentativas por dia, contando as recusadas (403 `limite_diario` na 4ª). Quem já adota recebe `ok` sem gastar tentativa. |
| `DELETE /casinhas/:id/adocao` | — | Encerra a adoção. |
| `POST /necessidades` | `{ id, casinhaId, tipo, urgencia, observacao?, lat?, lng?, criadaNoCelularEm }` | Se já existe aberta do mesmo tipo: reconfirma (e sobe a urgência se for o caso). Calcula `validado_local` (≤ 100 m) e descarta as coordenadas do usuário. Recalcula o status. |
| `POST /necessidades/:id/reconfirmar` | `{ atividadeId, lat?, lng? }` | Renova `expira_em`. 1 vez a cada 12 h por usuário (antes disso devolve `ja_reconfirmada`, sem erro). Necessidade fechada: 409. |
| `POST /necessidades/:id/atender` | `{ atividadeId, observacao?, lat?, lng? }` | `status = atendida`. Se já estava atendida, só registra a atividade e devolve `{ resultado: 'ja_atendida' }`. |
| `POST /necessidades/:id/contestar` | `{ atividadeId, observacao }` | Só até 24 h depois do atendimento (senão 409 `fora_do_prazo`). Reabre a necessidade, a menos que já exista outra aberta do mesmo tipo. |
| `PUT /fotos/:id` | multipart: `foto`, `miniatura`, `casinhaId`, `atividadeId?` | Idempotente pelo `id`. Foto até 1 MB, miniatura até 200 KB, só JPEG (confere os bytes e tira EXIF/XMP de novo). Sem `atividadeId`: foto de perfil, só criador, adotante ou moderador, até 5 por casinha. Com `atividadeId`: só atividade do próprio usuário, uma foto, expira em 90 dias. 20 fotos/dia. Responde `{ id, url, urlMiniatura }`. |
| `POST /denuncias` | `{ alvoTipo, alvoId, motivo, descricao? }` | Uma por pessoa e alvo; 20/dia. Com 3 denúncias abertas de contas com ≥ 7 dias: casinha e foto → `oculto_auto`; necessidade → cancelada; perfil só vai para a fila. Resposta sempre `{ resultado: 'ok' }`. |

### Moderação (`@Nivel('moderador')`; usadas pelo Bruno no MVP, ver [moderacao.md](moderacao.md))
Todas exigem `motivo` no corpo.

| Método e rota | Efeito |
|---|---|
| `GET /admin/fila` | Denúncias abertas agrupadas por alvo (prioritárias primeiro) + casinhas `em_revisao` + pedidos de desativação ainda não decididos + pares de casinhas a menos de 30 m |
| `POST /admin/ocultar` · `POST /admin/restaurar` | `{ alvoTipo, alvoId, motivo }`. Necessidade: cancela / reabre. As denúncias abertas do alvo viram procedentes / improcedentes. |
| `POST /admin/casinhas/:id/desativar` | Desativa |
| `POST /admin/casinhas/:id/ativar` | Aprova casinha em revisão, reativa, ou mantém depois de um pedido de desativação (o pedido sai da fila) |
| `POST /admin/casinhas/:id/mesclar` | `{ destinoId }`: move atividades, fotos, necessidades e adotantes (respeitando uma aberta por tipo e até 3 adotantes); desativa a origem |
| `POST /admin/usuarios/:id/nivel` | `{ nivel }` (promover a verificado exige moderador; criar ou mexer em moderador e admin, só admin; nunca a própria conta) |
| `POST /admin/usuarios/:id/bloqueio` | `{ ate, motivo }` (`ate: null` desbloqueia) |
| `POST /admin/denuncias/:id/resolver` | `{ procedente }` |

Toda ação grava em `acoes_moderacao` (a ocultação automática também, com `moderador_id = null`).

## Fotos (armazenamento)

- **Interface** `Armazenamento` (`shared/infra/armazenamento`): `gravar(chave, dados, tipo)`, `ler(chave)` (stream ou `null`), `apagar(chaves)`. Driver por `ARMAZENAMENTO_DRIVER`.
- **Driver `disco`:** grava em `ARMAZENAMENTO_PASTA` (em produção, um volume Docker incluído no backup).
- **Driver `s3`:** AWS S3 (bucket privado `rede-casinha-bucket`, `sa-east-1`) ou compatível (R2, via `S3_ENDPOINT`). Sem CORS e sem acesso público: só a API lê e grava.
- Nos dois drivers, a API entrega o arquivo em `GET /fotos/:id` só com URL assinada (HMAC-SHA256 de `id:variante:exp`, `AssinaturaDeUrls`). O detalhe da casinha já devolve as URLs.
- O upload valida tamanho, MIME e os *magic bytes* do JPEG e remove de novo os metadados (EXIF, XMP, comentários) antes de gravar.

## Jobs (`@nestjs/schedule`)

Todos idempotentes: rodar duas vezes não causa efeito extra. Ficam em `modulos/status/infra/jobs/tarefas-status.job.ts` (os dois primeiros, que chamam os use-cases `ExpirarNecessidades` e `RecalcularStatusDeTodas`); cada casinha é travada (`FOR UPDATE`) e relida antes de gravar, como nas escritas do app. Pressupõem **uma instância** da API: com mais de uma, trocar por um advisory lock no Postgres.

| Job | Frequência | Faz |
|---|---|---|
| `expirar-necessidades` | a cada 15 min | `aberta` com `expira_em < agora` → `expirada` + atividade `expiracao` + recálculo do status. |
| `recalcular-status` | a cada hora (no minuto 5) | Recalcula o status das casinhas afetadas por tempo (48 h de água/ração, 7 dias sem notícias). Grava só o que mudou. |
| `limpar-fotos` | diário, 4h30 (Brasília) | Apaga do armazenamento e do banco as fotos com `expira_em` vencido (`modulos/fotos/infra/jobs`). |
| `limpar-auditoria` | semanal | Apaga `acessos_localizacao` com mais de 180 dias, `limites_uso` com mais de 7 dias, `codigos_email` usados ou vencidos e sessões expiradas. |

Na Fase 2 entra o **pg-boss** para trabalhos com retentativa (push). O relógio é injetável (`Relogio.agora()`) para testar as transições por tempo.

## Offline: fila de saída (outbox)

### Tabela local (expo-sqlite)
```sql
create table outbox (
  id text primary key,          -- = id / atividadeId enviado à API
  usuario_id text not null,     -- dono: só é enviada com a sessão dele
  operacao text not null,       -- 'criar_casinha' | 'reportar_necessidade' | ...
  metodo text not null,         -- 'POST' | 'PUT' | ...
  caminho text not null,        -- ex.: /casinhas/<id>/check-in
  payload text not null,        -- JSON com o corpo da requisição
  fotos text,                   -- JSON: [{id, uri_local, uri_miniatura}]
  status text not null,         -- 'pendente' | 'enviando' | 'erro_permanente'
  tentativas integer default 0,
  proxima_tentativa_em integer, -- epoch ms (backoff exponencial, máx. 30 min)
  ultimo_erro text,
  codigo_erro text,             -- codigo do erro da API (ex.: 'possivel_duplicata')
  detalhe_erro text,            -- JSON com os dados do erro (ex.: as candidatas)
  criado_em integer not null
);
```

### Regras do sync worker
1. Dispara quando: uma operação entra na fila, a rede volta (NetInfo), o app volta ao primeiro plano, e a cada 2 min enquanto o app está aberto e há pendências.
2. Processa **em ordem de criação**, uma por vez. Uma casinha criada offline precisa existir antes dos reportes nela. Um erro temporário para a fila inteira (não pula o item da frente); um erro permanente tira o item da frente e a fila segue.
3. Para cada item: (a) chama o endpoint da operação; (b) sobe as fotos com `PUT /fotos/:id` (idempotente); (c) remove da fila.
4. Erro de rede ou 5xx: backoff. Erro de regra (4xx: limite, sem permissão, casinha inativa): `erro_permanente`, avisa o usuário e envia ao Sentry. 401: renova o token e tenta de novo.
5. As fotos pendentes ficam copiadas em `FileSystem.documentDirectory` (não em cache, que o sistema pode apagar).
6. **UI otimista:** a ação aparece na hora na tela, com o selo "aguardando envio", via `queryClient.setQueryData`. Depois do sync, as queries são invalidadas.
7. Um contador "N ações aguardando envio" fica visível no topo do mapa.
8. A rede voltar e o app voltar ao primeiro plano ignoram a espera do backoff (as condições mudaram); o intervalo de 2 min a respeita.

```mermaid
sequenceDiagram
  actor U as Usuário (sem sinal)
  participant A as App
  participant O as Outbox (SQLite)
  participant API as API (NestJS)
  participant DB as Postgres

  U->>A: "Sem água" + foto
  A->>A: comprime foto, gera UUIDs
  A->>O: insere operação (pendente)
  A-->>U: casinha amarela + "aguardando envio"
  Note over A: ...rede volta (NetInfo)
  A->>O: pega próxima pendente
  A->>API: POST /necessidades {id, ...}
  API->>DB: transação: upsert pelo id,<br/>valida limites, recalcula status
  API-->>A: {resultado:'ok'}
  A->>API: PUT /fotos/:id (arquivo + miniatura)
  API-->>A: ok (ou "já existe")
  A->>O: remove operação
  A->>A: invalida queries → mapa atualizado
```

### Leitura offline
- O TanStack Query persiste no MMKV as respostas de `GET /casinhas` (área arredondada a uma grade de ~2 km para reaproveitar cache), `GET /casinhas/:id` e `GET /me/casinhas`, com `gcTime` de 7 dias. Ao sair da conta, o cache em memória e o persistido são apagados (podem conter exatas que só o usuário anterior via).
- Os tiles do mapa ficam no cache automático do MapLibre (*ambient cache*). O download explícito do bairro fica para a F2.

## Segurança: resumo

- O app só conhece a URL da API. **Nenhum segredo no app.**
- **Guard global:** toda rota exige token, exceto as marcadas com `@Publico()` (só auth, `/saude` e as fotos por URL assinada; nenhuma leitura de casinha, ver [D01](01-visao-geral.md#d01--mapa-só-com-login-2026-09-25)). O e2e `test/seguranca.e2e-spec.ts` lê os metadados de todas as rotas e falha se aparecer uma rota pública nova, uma rota sem `@Nivel()` fora das da própria conta (`/me`) ou uma rota `/admin` sem moderador.
- **DTOs validados** em toda entrada (`whitelist` + `forbidNonWhitelisted`): campos extras são rejeitados.
- **Localização exata** só sai pelo módulo `localizacao`. Nenhum endpoint devolve a distância entre o usuário e a casinha. Testes e2e para cada nível de acesso.
- **Tokens:** acesso de 15 min; refresh opaco, rotativo e com hash no banco; códigos por e-mail com hash, validade e limite de tentativas.
- **HTTP:** `helmet` (CSP só em produção, por causa do Swagger em dev), CORS fechado (só os sites de `CORS_ORIGENS`, ex.: a página de exclusão de conta da T0.8), HTTPS pelo Caddy, throttling por IP.
- **Limites (RN06):** contador atômico (`INSERT … ON CONFLICT … RETURNING`) na transação da escrita: pedido recusado não conta, e pedidos simultâneos não furam o limite (testado com 12 cadastros ao mesmo tempo).
- **Servidor:** Postgres sem porta pública; segredos só no `.env` do servidor (permissão 600); SSH só com chave; firewall liberando 22, 80 e 443.
- **Logs** sem e-mail, token ou coordenadas.

### Checklist de segurança (revisado em 01/10/2026, T1.13)

| Item | Situação |
|---|---|
| DTO validado em toda entrada (`whitelist` + `forbidNonWhitelisted`) | ✅ campo extra dá 400 (e2e) |
| Nenhuma rota devolve distância ou a exata indevida | ✅ e2e por nível de acesso; adoção responde só `ok`/`nao_permitido`; duplicata devolve nome e foto, sem coordenadas |
| Fotos só com URL assinada; sem EXIF | ✅ HMAC com expiração; EXIF removido no app e de novo na API; bucket S3 privado, sem CORS |
| `helmet` e CORS fechado | ✅ e2e |
| Rotas públicas revisadas | ✅ e2e trava a lista |
| Limites da RN06 em toda escrita | ✅ contestação incluída em 01/10; e2e de cada limite e de concorrência |
| Logs sem e-mail, token ou coordenadas | ✅ revisado: só ids, contagens e stacks. Exceção: o driver de e-mail `console` mostra o código no log, mas a API não sobe em produção sem `EMAIL_DRIVER=resend` |
| Segredos só no `.env` do servidor; Postgres sem porta pública | ⏳ produção é a T0.11. Local: `.env` fora do git, Postgres só em `127.0.0.1` |
| `npm audit` | ⚠️ aceito: API (4 high) só no CLI do Prisma (`deepmerge-ts` da config, `mysql2` não usado); app (16 moderate) em ferramentas de build do Expo, fora o `decode-uri-component` do `expo-router` (link malicioso pode travar o próprio app; a versão corrigida é só ESM). Rever a cada SDK do Expo e versão do Prisma |

## Ambientes

| Ambiente | Onde | Uso |
|---|---|---|
| Local | `docker compose up -d` (Postgres na 5433) + `npm run start:dev` em `api/` (porta 3000) + dev build no celular | Desenvolvimento diário. No celular via adb: `adb reverse tcp:3000 tcp:3000` e `adb reverse tcp:8081 tcp:8081`. |
| Testes | Banco `rede_casinha_test` (local e no CI via *service container*) | e2e |
| Produção | VPS Oracle Cloud (São Paulo): `docker-compose.prod.yml` com API + Postgres + Caddy | Testadores e usuários |

O app lê a URL da API de `EXPO_PUBLIC_API_URL` (`http://localhost:3000/v1` em desenvolvimento). Em produção, as migrations rodam com `prisma migrate deploy` antes de a nova versão da API subir.
