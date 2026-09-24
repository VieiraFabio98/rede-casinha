# Rede Casinha — app

App Android em React Native + Expo (SDK 57, Expo Router, TypeScript). Visão do projeto em [`../docs`](../docs).

## Pré-requisitos

- Node 22+
- JDK 17+ e Android SDK com `ANDROID_HOME` definido (só para build local)
- Celular Android com **Depuração por Wi-Fi** (Android 11+) ou USB

## Primeira vez

```bash
cp .env.example .env   # URL da API e ID do cliente Google (não são segredos)
```

```bash
npm install
npx eas-cli@latest login
npx eas-cli@latest init   # cria o projeto no EAS e mostra o projectId
```

O `init` não consegue editar o `app.config.ts` sozinho, porque é uma config dinâmica. Copie o que ele mostrar para dentro do `config`:

```ts
owner: '<seu-usuario-expo>',
extra: { eas: { projectId: '<id>' } },
```

## Rodar no celular (dev build)

O app usa **dev build** (`expo-dev-client`), não o Expo Go, porque o MapLibre (T0.6) exige código nativo.

### Pelo cabo (recomendado no WSL)

O WSL não enxerga USB, então os scripts usam o `adb.exe` do Android SDK do **Windows**.

1. No celular: Opções do desenvolvedor → **Depuração USB** ligada (nos Xiaomi, também **Instalar via USB**). Conecte o cabo, escolha "Transferência de arquivos" e aceite **"Permitir depuração USB?"**.
2. Gere e instale o APK (só quando mudar algo nativo):
   ```bash
   npm run android:apk        # build econômico (~8 min; cabe num WSL de 8 GB)
   npm run android:instalar
   ```
3. Em três terminais:
   ```bash
   cd api && nvm use && npm run start:dev   # API (o código de login por e-mail aparece aqui)
   cd app && npm start                      # Metro
   cd app && npm run celular                # liga o celular à API e ao Metro (deixe aberto)
   ```
4. Abra **Rede Casinha (dev)** no celular. Edições no código aparecem na hora (Fast Refresh).

**Por que a ponte (`scripts/ponte-wsl.mjs`)?** O `adb reverse` do Windows entrega as conexões em `127.0.0.1`, mas o WSL em rede NAT só encaminha esse endereço para servidores que escutam em `0.0.0.0`. O Metro e a API escutam em `::`, e sem a ponte o app mostra `unexpected end of stream on http://localhost:8081`.

### Por Wi-Fi (sem cabo)

Opções do desenvolvedor → **Depuração sem fio** → parear com código. No WSL:

```bash
adb pair <ip>:<porta-de-pareamento>   # digite o código
adb connect <ip>:<porta>
adb reverse tcp:3000 tcp:3000 && adb reverse tcp:8081 tcp:8081
```

### Build na nuvem (EAS)

`npx eas-cli@latest build -p android --profile development`. O EAS assina com outra chave: cadastre o SHA-1 dela (`npx eas-cli@latest credentials`) num cliente OAuth Android do Google, ou o login com Google falha.

## Variantes

| Variante | Pacote | Nome | Uso |
|---|---|---|---|
| `development` | `br.app.redecasinha.dev` | Rede Casinha (dev) | Dev build local/EAS |
| produção | `br.app.redecasinha` | Rede Casinha | Play Store (perfis `preview` e `production`) |

As duas variantes convivem no mesmo celular. A escolha é feita pela variável `APP_VARIANT` (os scripts `npm` já definem).

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Metro para o dev build |
| `npm run android:apk` | Gera o APK de desenvolvimento com pouca memória |
| `npm run android:instalar` | Instala o APK no celular do cabo |
| `npm run celular` | Liga o celular do cabo à API e ao Metro no WSL |
| `npm run android` | Build local de dev + instala no celular |
| `npm run prebuild` | Regenera `android/` (não versionado: CNG) |
| `npm run check` | Typecheck + lint (inclui Prettier). Rodar antes de todo commit |
| `npm run format` | Formata tudo com Prettier |
| `npm run doctor` | Diagnóstico do Expo |

## Estrutura

```
src/
├── app/            # Rotas (Expo Router). Só telas e layouts
│   ├── _layout.tsx # Stack raiz
│   └── (tabs)/     # Abas: Mapa, Minhas casinhas, Perfil
├── api/            # Chamadas RPC tipadas + hooks React Query
├── offline/        # Outbox e sync worker
├── map/            # Camadas, estilos, clustering
├── fotos/          # Compressão e upload
├── domain/         # Tipos e regras puras
├── components/     # Componentes de UI
├── constants/      # Tema e espaçamentos
├── hooks/
└── i18n/pt-BR.ts   # Todos os textos visíveis
```

A pasta `android/` é gerada pelo `prebuild` e **não é versionada**. Configuração nativa só pelo `app.config.ts` e config plugins.

## Login com Google (Google Cloud → projeto `rede-casinha` → Google Auth Platform → Clientes)

| Cliente OAuth | Tipo | Pacote | SHA-1 do certificado | ID do cliente |
|---|---|---|---|---|
| API Rede Casinha | Aplicativo da Web | — | — | `979435269036-a1j81bqpbfjkank13jftksb9e4a5sbi0.apps.googleusercontent.com` (usado no código) |
| App Rede Casinha (dev) | Android | `br.app.redecasinha.dev` | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (debug) | `979435269036-kp7381e8071vqrhdgnq9qq2ias0sjc63.apps.googleusercontent.com` |
| App Rede Casinha | Android | `br.app.redecasinha` | SHA-1 da Play App Signing (criar depois do 1º upload) | — |

Se o login falhar com `DEVELOPER_ERROR`, o pacote ou o SHA-1 do build não batem com nenhum cliente Android acima.
Para ver o SHA-1 da chave de debug: `npm run prebuild && keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android`.
