# 03 — Ferramentas

> **Atenção:** os limites dos planos gratuitos mudam com frequência. Os valores abaixo foram levantados em set/2026 e servem para comparar opções. **Confira na página de preços oficial antes de criar cada conta.** Tudo vem em US$, salvo indicação.

Critérios usados, nesta ordem: (1) custo zero no início, (2) produtividade de 1 desenvolvedor TypeScript, (3) funcionar bem offline e em Android simples, (4) ter um caminho de crescimento sem reescrever tudo.

## Resumo da stack recomendada

| Camada | Escolha |
|---|---|
| Framework mobile | **React Native + Expo** (TypeScript, Expo Router, dev build) |
| Mapa | **MapLibre React Native + tiles OpenFreeMap** |
| Backend | **NestJS 12 + Prisma** (API própria, pasta `api/`) |
| Banco | **Postgres 18** puro (lat/lng + haversine) |
| Autenticação | **Própria no NestJS** (Google + código por e-mail + JWT/refresh) + **Resend** para e-mail |
| Fotos | **Disco da VPS** servido pela API com URL assinada → **Cloudflare R2** quando precisar |
| Tarefas agendadas | **@nestjs/schedule** (MVP) + **pg-boss** (fila de push, Fase 2) |
| Hospedagem | **VPS** com Docker Compose (API + Postgres + Caddy) — Oracle Cloud Always Free |
| Offline | **Outbox próprio em expo-sqlite** + **TanStack Query** com cache persistido |
| Push | **Expo Push Service** (usa FCM por baixo) — Fase 2 |
| QR code | **expo-camera** (leitura) + **react-native-qrcode-svg** (geração) — Fase 2 |
| Build e publicação | **EAS Build + EAS Submit + EAS Update**; build local como plano B |
| Analytics | **SQL no próprio Postgres** para métricas de negócio + **PostHog** para funis |
| Erros | **Sentry** (@sentry/react-native) |
| Site estático (política, exclusão de conta) | **GitHub Pages** |

**Custo total para lançar: US$ 25** (taxa única da Google Play), com a VPS no plano Always Free da Oracle. Um domínio `.com.br` (~R$ 40/ano) é recomendado, mas opcional no início.

---

## 1. Framework mobile multiplataforma

| Opção | Prós | Contras | Custo | Limites |
|---|---|---|---|---|
| **React Native + Expo** | TypeScript, que você já domina. Módulos prontos para câmera, localização, SQLite, notificações e imagem. Config plugins dispensam mexer em código nativo. EAS faz build na nuvem (dá para gerar iOS sem Mac no futuro). Atualização OTA. Ecossistema enorme. | Bibliotecas nativas fora do Expo (MapLibre) exigem *dev build*, não rodam no Expo Go. Mais dependências JS para manter. Upgrades de SDK a cada ~4 meses. | Grátis (open source) | — |
| **Flutter** | Performance e UI consistentes. Um único toolkit. Bom suporte a mapas (flutter_map, maplibre_gl). | Dart seria uma linguagem nova para você: semanas de curva. Menos reaproveitamento de conhecimento web. Não tem OTA oficial (Shorebird é pago acima do plano gratuito). | Grátis | — |
| **Ionic + Capacitor** | Reaproveita HTML/CSS/Angular/React. Curva mínima para dev web. | Mapa e listas grandes em WebView ficam pesados em Android fraco. Offline e SQLite mais trabalhosos. Sensação menos nativa. | Grátis | — |

**Recomendação: React Native + Expo.** Você já sabe TypeScript, e em projeto de 1 pessoa a velocidade vem de não aprender linguagem nova. O Expo cobre câmera, GPS, SQLite e notificações sem tocar em Java/Kotlin, e o EAS resolve build e OTA. Use **dev build** (`expo-dev-client`) desde o primeiro dia, porque o MapLibre exige.

---

## 2. Mapa para mobile

| Opção | Prós | Contras | Custo no plano gratuito | Limites |
|---|---|---|---|---|
| **MapLibre React Native + OpenFreeMap** | Open source, **sem chave de API e sem cartão**. Renderização vetorial leve. Clustering nativo (`ShapeSource cluster`). **Pacotes offline** de região. Sem dependência de fornecedor: dá para trocar a fonte dos tiles. | Exige dev build. Documentação menor que a do Google. O OpenFreeMap é mantido por doações e **não tem SLA**. Estilo visual mais "cru" (dá para ajustar). | Grátis | OpenFreeMap: sem limite declarado; uso justo. |
| **react-native-maps (Google Maps)** | O mais simples no Expo. Mapa familiar aos usuários. SDK nativo de mapas no Android sem cobrança por carregamento. | Exige projeto no Google Cloud **com conta de faturamento (cartão)**. Sem offline controlável. Clustering só com biblioteca JS extra. Geocodificação e Places são pagos à parte. | SDK de mapa dinâmico mobile sem cobrança | Chave precisa de restrição por pacote. APIs extras são cobradas. |
| **Mapbox (@rnmapbox/maps)** | Excelente qualidade, offline robusto, ótimos estilos. | Precisa de token secreto para baixar o SDK. Cobrança por usuário ativo acima do gratuito. Licença proprietária. | Plano gratuito por MAU (≈25 mil MAU mobile) | Acima disso, pago por MAU. |

**Recomendação: MapLibre + OpenFreeMap.** Zero chave, zero cartão, clustering nativo e offline. Exatamente o que um app de rua sem verba precisa. **Plano B** se o OpenFreeMap cair: gerar um arquivo PMTiles do Brasil (Protomaps) e hospedar no Cloudflare R2. Trocar é mudar uma URL de estilo. Não use a geocodificação do Google. Para busca de endereço (F2) use o **Nominatim** (grátis, até 1 requisição/s, com cache) ou o Photon.

---

## 3. Backend

| Opção | Prós | Contras | Custo | Limites |
|---|---|---|---|---|
| **NestJS + Prisma (API própria)** | Estrutura opinativa (módulos, controllers, services, injeção de dependência), parecida com Angular: organiza bem um projeto que vai crescer. Guards, pipes e interceptors prontos para autenticação, validação e rate limit. OpenAPI gerado a partir dos DTOs (`@nestjs/swagger`). Prisma dá schema tipado, migrations e client TS. Tudo portável (roda em qualquer VPS com Docker). | Mais código e mais boilerplate que um BaaS: autenticação, arquivos e jobs são por sua conta. Você opera o servidor (atualizações, backup, segurança). Arranque um pouco mais pesado que frameworks minimalistas. | Grátis (open source) + hospedagem | Limitado pela hospedagem (seção 13). |
| **Fastify + Prisma** | Mais leve e rápido. Menos cerimônia. | Sem estrutura imposta: com o tempo, a organização depende de disciplina. Menos "baterias incluídas" (guards, DI, módulos). | Grátis + hospedagem | Idem. |
| **Supabase (BaaS)** | Auth, Storage, API REST automática e cron prontos. Menos código no MVP. | Regras de negócio espalhadas em SQL e RLS. Plano gratuito pausa por inatividade e não tem backup. Lock-in nas APIs do provedor. | Grátis | 500 MB de banco, 1 GB de arquivos, 5 GB de egress/mês. |

**Recomendação: NestJS 12 (ESM) + Prisma 7**, na plataforma Express (a padrão do Nest). Mantém as regras de negócio em TypeScript, testáveis e num lugar só, e não prende o projeto a um provedor. Peças do Nest usadas:

| Necessidade | Pacote |
|---|---|
| Validação de entrada | `class-validator` + `class-transformer` com `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`) |
| OpenAPI (`/docs`) | `@nestjs/swagger` com o plugin do CLI (gera o schema a partir dos DTOs) |
| Configuração | `@nestjs/config` com validação das variáveis na inicialização (esquema Zod, via Standard Schema) |
| Autenticação | `@nestjs/jwt` + guard global (`@Publico()` libera rotas abertas) + `@Nivel('moderador')` |
| Rate limit | `@nestjs/throttler` |
| Tarefas agendadas | `@nestjs/schedule` (`@Cron`) no MVP; **pg-boss** (fila no próprio Postgres, com retentativas) para push na Fase 2 |
| Segurança HTTP | `helmet` + CORS fechado |
| Testes | **Vitest** + `@nestjs/testing` + `supertest` (e2e contra o banco `rede_casinha_test`) — padrão do Nest 12 para projetos ESM |
| Lint | **oxlint** + Prettier (padrão do Nest 12) |
| Runtime | **Node 24** (o Nest 12 é só ESM e o CLI exige Node ≥ 22.22) |

---

## 4. Banco de dados e busca por localização

| Opção | Prós | Contras | Custo | Limites |
|---|---|---|---|---|
| **Postgres 18 puro (lat/lng + haversine)** | Imagem oficial, sem extensões. Busca por área = `lat BETWEEN ... AND lng BETWEEN ...` com índice composto. Distância (30 m, 100 m) por haversine, pré-filtrada por caixa. Tudo modelável no Prisma sem tipos `Unsupported`. | Sem índice espacial de verdade: com centenas de milhares de pontos numa mesma cidade, a busca por área fica menos eficiente. Cálculos geográficos escritos à mão (e testados). | Grátis | Folgado para dezenas de milhares de casinhas. |
| **Postgres + PostGIS** | Índice GiST, `ST_DWithin`, `ST_Project`, polígonos de municípios dentro do banco. | Tipos `geography` são `Unsupported` no Prisma: consultas em SQL cru. Imagem maior. | Grátis | — |
| **Firestore + geohash** | Offline nativo. | Consulta por raio = várias consultas por prefixo + filtro no cliente. NoSQL complica relatórios. Cota de leituras diária. | Grátis | 50 mil leituras/dia. |

**Recomendação: Postgres 18 puro** (`postgres:18-alpine`, já no `docker-compose.yml`). No volume do projeto, `BETWEEN` com índice + haversine resolve com folga. Se um dia precisar de PostGIS, a troca é só de imagem (`postgis/postgis`), sem migrar dados.

---

## 5. Autenticação

| Opção | Prós | Contras | Custo | Limites |
|---|---|---|---|---|
| **Própria no NestJS** | Controle total, dados no próprio banco, sem dependência externa. Google: o app obtém o ID token e a API valida com `google-auth-library`. Código por e-mail: gerado, guardado com hash e enviado pelo Resend. Sessão: JWT de acesso curto + refresh token rotativo. | Você escreve e testa o fluxo (~2 a 3 dias). Erros de segurança são seus: exige testes (código expirado, força bruta, reuso de refresh). | Grátis | — |
| **Better Auth (biblioteca)** | Adapter Prisma, plugins de código por e-mail e login social prontos. | Mais uma abstração para aprender e integrar ao Nest. Pensada primeiro para web (cookies). | Grátis (open source) | — |
| **Firebase Auth** | Muito maduro. Login por telefone. | A API precisa validar tokens de terceiros e sincronizar usuários. SMS é pago. Dados de login fora do seu banco. | Grátis (exceto SMS) | 50 mil MAU no plano básico. |

**Recomendação: autenticação própria no NestJS**, com:
- **Google Sign-In nativo** (`@react-native-google-signin/google-signin`) → `POST /auth/google` com o ID token.
- **Código de 6 dígitos por e-mail**: válido por 10 min, máximo de 5 tentativas, guardado com hash. No celular, código é mais simples que link mágico.
- **E-mail e senha** (hash `argon2`) só para a conta de demonstração do revisor da Play.
- **Sessão:** JWT de acesso de 15 min + refresh token opaco, rotativo e com hash no banco. Reuso de um refresh antigo derruba todas as sessões do usuário.
- **Envio de e-mail: Resend** (grátis: 3 mil e-mails/mês, 100/dia). Alternativa: Brevo (300/dia).

---

## 6. Armazenamento de fotos

| Opção | Prós | Contras | Custo | Limites |
|---|---|---|---|---|
| **Disco da VPS, servido pela API** | Zero conta extra. A API grava o arquivo e serve só com URL assinada (HMAC, validade de 1 h). Na Oracle Always Free há até 200 GB de disco. | Fotos e banco no mesmo servidor: o backup precisa incluir as fotos. A banda de saída sai da VPS. Escalar horizontalmente exige storage compartilhado. | Grátis | Disco e banda da VPS. |
| **Cloudflare R2** | **Egress grátis**, 10 GB grátis, API S3, URLs pré-assinadas geradas pela API. | Precisa de cartão para ativar. Mais uma conta. | Grátis | 10 GB-mês, 1 milhão de escritas e 10 milhões de leituras/mês. |
| **Cloudinary** | Transformações e CDN prontos. | Créditos acabam rápido. Lock-in nas URLs. | Grátis | 25 créditos/mês. |

**Recomendação: disco da VPS no MVP, atrás de uma interface de armazenamento** (`salvar`, `ler`, `apagar`, `urlAssinada`) com dois drivers: `disco` e `s3`. Compressão agressiva no celular (`expo-image-manipulator`): 1024 px (~120 KB) + miniatura de 320 px (~25 KB), o que dá **~6.500 fotos por GB**. **Gatilho para migrar para R2:** disco da VPS acima de 70% ou banda de saída apertando. Os caminhos ficam no banco, então a migração é um script.

---

## 7. Sincronização offline

| Opção | Prós | Contras | Custo | Limites |
|---|---|---|---|---|
| **Outbox próprio (expo-sqlite) + TanStack Query persistido** | Simples e sob seu controle. Leitura: cache persistido da última área. Escrita: fila local de operações idempotentes (UUID gerado no celular). Dá para depurar e é suficiente porque as escritas raramente conflitam (reportes são *append-only*). | Você escreve o worker de sincronização (~300 linhas). Sem sincronização bidirecional completa. | Grátis | — |
| **PowerSync** | Sincronização bidirecional real Postgres ↔ SQLite. Consultas locais em SQL. | Mais um serviço e mais um conceito (sync rules). O plano gratuito tem limites e pausa por inatividade. Excessivo para o MVP. | Plano gratuito limitado | Dados sincronizados e conexões simultâneas limitados. |
| **WatermelonDB** | Banco local reativo e rápido, com protocolo de sync. | Você implementa os endpoints de pull/push no backend. Manutenção da biblioteca oscila. Curva de aprendizado. | Grátis | — |

**Recomendação: outbox próprio + TanStack Query.** O domínio favorece isso: quase toda escrita é "adicionar um evento" (reporte, atendimento, check-in), então não há edição concorrente complexa. Cada operação carrega um `id` UUID gerado no celular, e a API grava com `upsert`/`createMany({ skipDuplicates: true })` pelo mesmo id. Reenviar é seguro. Reavalie o PowerSync na Fase 3 se aparecer necessidade de edição offline colaborativa.

---

## 8. Notificações push (Fase 2)

| Opção | Prós | Contras | Custo | Limites |
|---|---|---|---|---|
| **Expo Push Service** | Uma API HTTP simples, chamada da API com `expo-server-sdk`. `expo-notifications` já integrado. Já cobre o iOS no futuro. | Depende do serviço da Expo. Precisa configurar credenciais FCM no EAS mesmo assim. | Grátis | Limite de taxa alto (centenas por segundo); sem limite mensal declarado. |
| **FCM direto** | Sem intermediário. Grátis e ilimitado. | API v1 com OAuth de conta de serviço, mais trabalhosa de integrar. iOS separado (APNs). | Grátis | — |
| **OneSignal** | Painel, segmentação e campanhas prontas. | SDK pesado. Dados de usuários num terceiro (LGPD). Excessivo. | Grátis (mobile) | Recursos avançados pagos. |

**Recomendação: Expo Push Service**, disparado pela API: o serviço de eventos enfileira um job pg-boss `enviar-push`, que chama o `expo-server-sdk` com retentativas. Guarde os tokens na tabela `dispositivos` e remova os inválidos quando a Expo devolver `DeviceNotRegistered`.

---

## 9. Leitura e geração de QR code (Fase 2)

| Opção | Prós | Contras | Custo | Limites |
|---|---|---|---|---|
| **expo-camera (`CameraView` com `barcodeScannerSettings`)** | Já faz parte do Expo. Suficiente para QR. `launchScanner()` usa o scanner do sistema (no Android, o Google Code Scanner, que dispensa permissão de câmera; confirme o suporte na versão do SDK). | Menos controle fino que o VisionCamera. | Grátis | — |
| **react-native-vision-camera (code scanner)** | Performance alta, ML Kit. Muito configurável. | Mais uma lib nativa pesada. Excessivo só para QR. | Grátis | — |
| **Geração: react-native-qrcode-svg** (+ `expo-print` para gerar o PDF da placa) | Gera SVG no celular, sem servidor. | — | Grátis | — |

**Recomendação: expo-camera para ler e react-native-qrcode-svg + expo-print para gerar a placa.** O QR codifica uma URL (`https://<dominio>/c/<codigo-curto>`) e não coordenadas. Isso permite abrir o app por deep link e manter uma página web de fallback.

---

## 10. Build e publicação nas lojas

| Opção | Prós | Contras | Custo no plano gratuito | Limites |
|---|---|---|---|---|
| **EAS Build + Submit + Update** | Build assinado na nuvem. Guarda o keystore com segurança. Envia o AAB direto para a Play (Submit). OTA para correções JS (Update). Futuro iOS sem Mac. | Fila de baixa prioridade no gratuito (pode levar dezenas de minutos). Cota mensal de builds. | Grátis | ≈15 builds Android/mês. EAS Update: ≈1 mil usuários ativos/mês que recebem update. |
| **Build local (`eas build --local` ou Gradle)** | Ilimitado e rápido numa máquina boa. Funciona no WSL/Linux com Android SDK + JDK 17. | Você configura o ambiente e **guarda o keystore** (perdê-lo = não conseguir atualizar o app). | Grátis | — |
| **GitHub Actions** | Automação completa (lint, testes, build). | Build Android consome muitos minutos. Configuração trabalhosa. | Grátis (ilimitado em repositório público; 2 mil min/mês em privado) | — |

**Recomendação: EAS** para builds de release e para o Submit; **build local** de desenvolvimento para não gastar cota; **GitHub Actions** só para lint, typecheck e testes. Use o **Play App Signing** (a Google guarda a chave de assinatura do app, e você só a de upload).

**Google Play (conta pessoal):**
- US$ 25, taxa única. Verificação de identidade (documento) pode levar alguns dias. **Crie a conta primeiro.**
- **Contas pessoais novas precisam de teste fechado com ≥ 12 testadores inscritos por 14 dias seguidos** antes de liberar produção. Comece esse relógio cedo (T0.9).
- Programa de verificação de desenvolvedor Android (que começou pelo Brasil em 2026): a conta Play verificada atende, mas confira se o nome de pacote também precisa ser registrado.
- Nome do pacote definitivo desde o primeiro upload (ex.: `br.app.redecasinha`). Não dá para mudar depois.

---

## 11. Analytics

| Opção | Prós | Contras | Custo no plano gratuito | Limites |
|---|---|---|---|---|
| **SQL no Postgres (views de métricas)** | Métricas de negócio exatas (necessidades atendidas, casinhas ativas) a partir dos dados que já existem. Nenhum dado sai do Brasil. Grátis. | Não mede uso de telas nem funis. | Grátis | — |
| **PostHog Cloud** | Funis, retenção, feature flags. SDK React Native. Open source (dá para auto-hospedar). | Dados vão para servidores nos EUA ou na UE (transferência internacional: declarar na política). É preciso desligar o autocapture de textos. | Grátis | 1 milhão de eventos/mês. |
| **Google Analytics for Firebase** | Grátis e ilimitado. Integra com a Play. | Traz o SDK do Firebase para o app. Dados com o Google. Mais difícil de justificar na LGPD. Latência de relatórios. | Grátis | — |

**Recomendação: views SQL para as métricas de sucesso** (ver [01-visao-geral.md](01-visao-geral.md#métricas-de-sucesso)) **+ PostHog** com ~10 eventos nomeados (`casinha_cadastrada`, `necessidade_reportada`, `atendimento_feito`, `sync_falhou` etc.). Identifique o usuário por um ID interno, nunca pelo e-mail. Autocapture e session replay desligados.

---

## 12. Monitoramento de erros

| Opção | Prós | Contras | Custo no plano gratuito | Limites |
|---|---|---|---|---|
| **Sentry** | Integração oficial com Expo (`@sentry/react-native` + plugin). Source maps enviados pelo EAS. Breadcrumbs. Alertas por e-mail. | Cota pequena: um loop de erro pode esgotá-la (configure sample e filtros). | Grátis (plano Developer) | ≈5 mil erros/mês, 1 usuário. |
| **Firebase Crashlytics** | Grátis e ilimitado. Bom para crashes nativos. | Traz o SDK do Firebase. Erros JS com menos contexto. | Grátis | — |
| **GlitchTip (auto-hospedado)** | Compatível com o SDK do Sentry. Open source. | Você hospeda e mantém. | Grátis (software) | Limitado pelo servidor. |

**Recomendação: Sentry.** Configure `beforeSend` para remover e-mail e coordenadas. Envie como `user.id` só o UUID. Crie um alerta para `sync_falhou` com mais de 20 ocorrências por hora.

---

## 13. Hospedagem da API e do banco

| Opção | Prós | Contras | Custo | Limites |
|---|---|---|---|---|
| **Oracle Cloud Always Free (VPS ARM)** | Grátis por tempo indeterminado e generoso: até 4 vCPUs ARM e 24 GB de RAM, 200 GB de disco, 10 TB de saída/mês. Região São Paulo. Roda API + Postgres + Caddy num `docker compose`. | Exige cartão na criação (verificação). Capacidade ARM às vezes esgotada na região. **Instâncias gratuitas ociosas podem ser recuperadas pela Oracle**: converter a conta para *Pay As You Go* (continua grátis dentro dos limites) evita isso. Você administra o servidor. | Grátis | Limites do Always Free. |
| **VPS paga pequena** (Hetzner, DigitalOcean, Contabo etc.) | Simples, previsível, sem risco de recuperação. | ~US$ 4 a 6/mês. Várias não têm região no Brasil (latência maior). | ~US$ 5/mês | 1–2 vCPU, 2–4 GB. |
| **Render (API) + Neon (Postgres)** | Deploy por git, Postgres gerenciado com branching. Zero administração de servidor. | O plano gratuito do Render **dorme após inatividade** (primeira requisição leva dezenas de segundos, ruim para app na rua). Neon gratuito com ~0,5 GB. Fotos precisam ir para o R2. | Grátis | Instância que dorme; 0,5 GB de banco. |

**Recomendação: Oracle Cloud Always Free** com `docker-compose.prod.yml` (API + Postgres + Caddy com HTTPS automático), convertendo a conta para Pay As You Go para evitar a recuperação por ociosidade. Plano B: VPS paga de ~US$ 5/mês; como tudo roda em Docker, migrar é copiar o compose e restaurar o backup. Backup diário com `pg_dump` + fotos, criptografado com `age` e enviado para fora da VPS.

---

## Bibliotecas do app (referência)

| Função | Pacote |
|---|---|
| Navegação | `expo-router` |
| Estado de servidor e cache | `@tanstack/react-query` + `@tanstack/query-async-storage-persister` |
| Armazenamento chave-valor rápido | `react-native-mmkv` |
| Banco local / outbox | `expo-sqlite` |
| Rede | `@react-native-community/netinfo` |
| Cliente da API | `fetch` + tipos gerados do OpenAPI (`openapi-typescript` + `openapi-fetch`) |
| Mapa | `@maplibre/maplibre-react-native` |
| GPS | `expo-location` |
| Câmera e galeria | `expo-image-picker` (câmera + Photo Picker do Android) |
| Compressão de foto | `expo-image-manipulator` |
| Exibição de imagem com cache | `expo-image` |
| Login Google | `@react-native-google-signin/google-signin` |
| Formulários e validação | `react-hook-form` + `zod` |
| IDs no celular | `expo-crypto` (`randomUUID`) |
| Erros | `@sentry/react-native` |
| Analytics | `posthog-react-native` |
| Testes | `jest` + `@testing-library/react-native` |
