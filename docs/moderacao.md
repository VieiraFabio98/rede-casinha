# Moderação

> Como moderar a Rede Casinha no MVP, sem tela no app: pelas rotas `/admin` da API, usando o **Bruno** (cliente HTTP) com a coleção em `api/bruno/`. Fase 2: tela no app e moderadores regionais (T2.3).

## Orçamento de tempo e prazos

- **Até 30 min por dia.** Se passar disso por 2 semanas seguidas, é o gatilho para a T2.3 (moderadores voluntários).
- **Prazos (SLA):**
  - **"Coloca os animais em perigo"** e **"Expõe uma pessoa"**: em até **24 h**. A fila já mostra essas primeiro (`prioridade: true`).
  - Todo o resto: em até **48 h**.
- Toda ação exige um **motivo** e fica registrada em `acoes_moderacao` (quem, o quê, quando, por quê).

## Como entrar (Bruno)

1. Instale o [Bruno](https://www.usebruno.com/) e abra a pasta `api/bruno/` (Open Collection).
2. Escolha o ambiente **local** (ou o de produção, quando existir, na T0.11) e preencha `email` com uma conta **moderador** ou **admin**.
3. Rode **1 Entrar → 1 Pedir código**, copie o código (em desenvolvimento, aparece no log da API; em produção, chega por e-mail) para `codigo` e rode **2 Verificar código**. O token fica guardado sozinho e vale 15 minutos.
4. Rode **2 Moderação → 01 Fila**.

Os ids que as rotas pedem (`alvoId`, `casinhaId`, `usuarioId`, `denunciaId`) vêm da fila: copie para o ambiente.

## A fila (`GET /admin/fila`)

| Parte | O que é | O que fazer |
|---|---|---|
| `denuncias` | Agrupadas por alvo, prioritárias primeiro e depois as mais antigas. Traz o total, os motivos, a descrição de cada uma e o estado atual do alvo (`oculto_auto` = já ocultado pelas 3 denúncias). | Decidir: **ocultar** (as denúncias viram procedentes) ou **restaurar** (improcedentes). Para fechar uma só, **resolver denúncia**. |
| `casinhasEmRevisao` | Casinhas marcadas `em_revisao` (possível duplicata no cadastro, T1.6). | **Ativar** se estiver certa; **mesclar** se for duplicata; **desativar** se for falsa. |
| `pedidosDesativacao` | "A casinha não existe mais", enviados por usuários. | Confirmar com quem cuida da região (ou ir até lá) e **desativar**; se ela continua lá, **ativar** (o pedido sai da fila). |
| `possiveisDuplicatas` | Pares de casinhas a até 30 m uma da outra, com a distância. | **Mesclar** a duplicata na que fica, ou ignorar se forem mesmo duas casinhas. |

## Ocultação automática (RF06.2)

- **3 denúncias** abertas de **contas diferentes com pelo menos 7 dias** ocultam o alvo até a revisão:
  - casinha e foto ficam `oculto_auto` (somem do mapa; criador e adotantes continuam vendo);
  - necessidade é **cancelada** (sai do status da casinha).
- Contas com menos de 7 dias denunciam, mas **não contam** para ocultar: é a proteção contra "brigada" de contas criadas para derrubar a casinha de alguém. Se aparecerem muitas denúncias de contas novas no mesmo alvo, **restaure** e considere **bloquear** as contas abusivas.
- Denúncia de **perfil nunca bloqueia sozinha**: só vai para a fila.
- A resposta da denúncia é sempre `ok`: ninguém fica sabendo quantas denúncias o alvo tem nem se ele foi ocultado.

## Ações

| Ação (Bruno) | Rota | Efeito |
|---|---|---|
| Ocultar | `POST /admin/ocultar` | Casinha/foto: `oculto_moderador`. Necessidade: cancelada. Denúncias abertas do alvo → procedentes. |
| Restaurar | `POST /admin/restaurar` | Volta a visível (necessidade cancelada volta a aberta, se não houver outra aberta do mesmo tipo). Denúncias abertas → improcedentes. |
| Desativar | `POST /admin/casinhas/:id/desativar` | Sai do mapa (`inativa`). Histórico e adoções ficam guardados. |
| Ativar | `POST /admin/casinhas/:id/ativar` | Aprova casinha em revisão, reativa uma desativada ou mantém depois de um pedido de desativação. |
| Mesclar | `POST /admin/casinhas/:id/mesclar` | A casinha da rota (duplicata) vai para `destinoId`: histórico, fotos, necessidades e adotantes. Necessidade aberta que o destino já tem do mesmo tipo é cancelada; adotante que já adota o destino, ou que passaria de 3, tem a adoção encerrada. A origem fica `inativa`, apontando para o destino. |
| Alterar nível | `POST /admin/usuarios/:id/nivel` | Moderador promove a verificado (e rebaixa a colaborador). Criar ou mexer em moderador e admin: só admin. Ninguém muda o próprio nível. |
| Bloquear | `POST /admin/usuarios/:id/bloqueio` | Até a data em `ate` (`null` desbloqueia). Bloqueado não vê o mapa nem faz ações. Moderador não bloqueia moderador nem admin. |
| Resolver denúncia | `POST /admin/denuncias/:id/resolver` | Fecha uma denúncia avulsa (procedente ou não), sem mexer no alvo. |

## Critérios para promover a verificado

Verificar é dar acesso à **localização exata** (até 50 casinhas por dia, com registro). Todos os critérios:

1. Conta com **pelo menos 30 dias**.
2. **Pelo menos 10 contribuições** (reportes, atendimentos, check-ins) **sem contestação procedente**.
3. **Adotante de pelo menos 1 casinha.**
4. **Alguém da comunidade responde pela pessoa** (por exemplo, um protetor conhecido do grupo local).

**Na dúvida, não promova.** O motivo registrado deve dizer quem respondeu pela pessoa.

Revogar é imediato (nível de volta a `colaborador`). Revise toda semana: verificados que abrem muitas casinhas distintas por dia ou fora da própria cidade (`acessos_localizacao`).

## Bloqueio: referência

| Situação | Bloqueio |
|---|---|
| 3 atendimentos contestados e confirmados como falsos em 30 dias (RN03) | 7 dias |
| Conteúdo ofensivo ou que expõe pessoa, primeira vez | ocultar o conteúdo e avisar; na reincidência, 7 dias |
| Denúncias em massa contra um alvo (brigada) | 7 dias para as contas envolvidas |
| Casinha falsa de propósito, spam ou uso hostil (mapear casinhas para prejudicar) | 30 dias ou mais; em caso grave, até o fim da conta |

Quando um bloqueio envolver ameaça aos animais, avise os adotantes da casinha e registre tudo no motivo.
