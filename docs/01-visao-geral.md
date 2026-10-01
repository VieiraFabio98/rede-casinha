# 01 — Visão geral: Rede Casinha

> Nome provisório. Documento vivo — atualize quando uma decisão mudar.

## Premissas deste projeto

| Tema | Decisão |
|---|---|
| Plataforma inicial | **Somente Android** (Google Play). iOS fica para a Fase 3. |
| Stack | **React Native com Expo** (TypeScript). |
| Equipe | **1 pessoa** (fundador), sem ONG parceira no lançamento. |
| Abrangência | App aberto para o Brasil todo; os primeiros dados vêm da cidade do fundador. |
| Login | **Obrigatório para tudo, inclusive para ver o mapa** (Google ou código por e-mail). Sem login, só a tela de entrada. Ver [D01](#d01--mapa-só-com-login-2026-09-25). |
| Verificação | Usuário "verificado" (que vê localização exata) é promovido **manualmente por um moderador**. No início, o único moderador é o fundador. |
| QR code | Fora do MVP. Planejado para a Fase 2. |
| Orçamento | Zero. Único custo obrigatório: **US$ 25 (taxa única)** da conta Google Play. |

## Problema

Casinhas comunitárias para cães e gatos de rua são mantidas por pessoas que não se conhecem e se coordenam por grupos de WhatsApp, Instagram e boca a boca. O resultado:

1. **Informação se perde.** "A casinha da praça está sem água" some no meio de 300 mensagens do grupo.
2. **Esforço duplicado e buracos.** Duas pessoas levam ração para a mesma casinha no mesmo dia enquanto outra, a 2 quarteirões, fica uma semana vazia.
3. **Ninguém sabe onde estão as casinhas.** Não existe um mapa. Quem quer ajudar não sabe por onde começar.
4. **Sem histórico.** Não dá para saber quando a casinha foi abastecida pela última vez nem quem cuida dela.
5. **Dependência de uma pessoa.** Quando a protetora que cuida de uma casinha adoece ou viaja, ninguém fica sabendo.

## Objetivo

Ser o **mapa de referência das casinhas comunitárias do Brasil**, mostrando em tempo quase real **o que cada uma está precisando** e permitindo que qualquer pessoa ajude em poucos toques, mesmo com internet ruim.

Objetivo do MVP, bem mais estreito: **provar que a comunidade de uma cidade mantém o status das casinhas atualizado pelo app**, em vez de só pelo WhatsApp.

## Público-alvo

| Segmento | Papel no app | Quando entra |
|---|---|---|
| Protetores independentes | Cadastram, adotam e atualizam casinhas. São o núcleo. | MVP |
| Vizinhos / ajudantes eventuais | Veem o que falta e resolvem ("levei água"). | MVP |
| ONGs de proteção animal | Coordenam várias casinhas e voluntários. | Fase 2–3 |
| Prefeituras (bem-estar animal, zoonoses) | Consomem dados agregados e apoiam com insumos. | Fase 3 |

## Personas

### Dona Marta — protetora independente
- 58 anos. Cuida de 6 casinhas no bairro há 8 anos e gasta do próprio bolso.
- Celular Android de entrada, plano pré-pago e pouco espaço livre. Usa WhatsApp o dia inteiro.
- **Dor:** carrega tudo sozinha e ninguém a ajuda de forma organizada.
- **Quer:** marcar rápido "abasteci" e pedir ajuda quando não consegue ir.
- **Implicação no design:** fonte grande, poucos passos, funcionar offline, app leve.

### Lucas — vizinho que quer ajudar
- 27 anos. Passa por uma casinha todo dia no caminho do trabalho.
- **Dor:** quer ajudar, mas não sabe se falta algo nem se "pode mexer".
- **Quer:** abrir o app, ver "falta água aqui" e resolver em 2 minutos.
- **Implicação no design:** o mapa já abre na localização dele; ação principal em 1 toque.

### Carla — coordenadora de grupo de protetores
- 41 anos. Administra um grupo de WhatsApp com 200 protetores da cidade.
- **Dor:** organiza escala de ração em planilha e mensagens, e ninguém atualiza.
- **Quer:** uma visão geral da cidade para direcionar voluntários.
- **Implicação no design:** status agregado por região e link fácil de compartilhar no WhatsApp (Fase 2).

### Rafael — servidor da prefeitura (futuro)
- Trabalha no departamento de bem-estar animal.
- **Quer:** saber onde há concentração de animais e casinhas para planejar castração e doação de ração.
- **Implicação:** dados abertos e agregados, sem localização exata (Fase 3).

### Anti-persona — pessoa mal-intencionada
- Quer achar casinhas para envenenar animais, destruir abrigos ou "denunciar" protetores.
- **Implicação:** a localização exata **nunca** é pública e o mapa só abre com login. Ver [06-riscos.md](06-riscos.md) e [D01](#d01--mapa-só-com-login-2026-09-25).

## Proposta de valor

> **"Veja o que a casinha perto de você precisa e resolva em 2 minutos."**

- **Para protetores:** divide o trabalho, registra histórico e recebe ajuda sem precisar pedir em 5 grupos.
- **Para vizinhos:** um jeito concreto e rápido de ajudar, sem compromisso.
- **Para a causa:** um mapa real das casinhas do país, que hoje não existe.

Diferenciais em relação ao WhatsApp: **status visual por casinha**, **histórico**, **funciona offline** e **localização protegida**.

## Status no mapa

| Cor | Status | Significado |
|---|---|---|
| 🟢 Verde | `ok` | Nenhuma necessidade aberta e alguém passou nos últimos 7 dias. |
| 🟡 Amarelo | `atencao` | Existe pelo menos 1 necessidade aberta. |
| 🔴 Vermelho | `urgente` | Existe necessidade marcada como urgente, ou água/ração em aberto há mais de 48 h. |
| ⚪ Cinza | `sem_noticias` | Ninguém atualizou há mais de 7 dias. **Falta de dado não é "ok".** |

As regras completas estão em [02-requisitos.md](02-requisitos.md#regras-de-negócio).

## Métricas de sucesso

**Métrica norte:** **necessidades atendidas por semana**. Ela captura o valor real, que é animal com água e comida.

| Métrica | Como medir | Meta aos 3 meses do lançamento (cidade piloto) |
|---|---|---|
| Necessidades atendidas por semana | `necessidades` com status `atendida` na semana | ≥ 15/semana |
| Tempo mediano entre reporte e atendimento | mediana de `atendida_em - criada_em` | < 48 h |
| Casinhas ativas | casinhas com ≥ 1 atividade nos últimos 30 dias | ≥ 30 |
| % de casinhas adotadas | casinhas com ≥ 1 adotante ativo / casinhas ativas | ≥ 40% |
| % do mapa em cinza | casinhas `sem_noticias` / casinhas ativas | < 30% |
| Contribuidores ativos por mês | usuários com ≥ 1 ação no mês | ≥ 40 |
| Retenção de contribuidores (M1) | % dos que contribuíram no mês N e voltam no mês N+1 | ≥ 35% |
| Qualidade | denúncias procedentes / total de casinhas | < 5% |
| Estabilidade | sessões sem crash (Sentry) | ≥ 99,5% |

**Critério para continuar investindo depois do piloto:** se em 3 meses a métrica norte ficar abaixo de 5/semana, entreviste 10 protetores antes de escrever mais código. O problema provavelmente é adoção, não funcionalidade.

## Fora de escopo (por enquanto)

- Adoção de **animais** (existem apps para isso). Aqui "adotar" é adotar a **casinha**.
- Cadastro individual de animais (ficha com nome, sexo, castração, vacinas…). Fotos dos animais que frequentam a casinha entram na F2, sem ficha ([D03](#d03--fotos-dos-moradores-sem-cadastro-de-animal-2026-10-01)).
- Doações em dinheiro dentro do app.
- Chat entre usuários.
- iOS e versão web completa.

## Registro de decisões

Decisões que mudaram o plano original. A mais recente fica no fim.

### D01 — Mapa só com login (2026-09-25)

- **Antes:** o visitante sem conta via o mapa com a área aproximada e o status das casinhas. O login só era pedido para reportar, cadastrar e adotar.
- **Agora:** todo o app exige login. Sem sessão, a única tela é a de entrada; com cadastro pendente, só a de cadastro.
- **Por quê:** o mapa anônimo deixava a anti-persona varrer as casinhas de uma cidade inteira sem se identificar, por script ou por muitos aparelhos, e sem ter o que bloquear. Com login, toda consulta fica ligada a uma conta (e-mail ou Google confirmado, 18+ declarado) que tem limites, deixa rastro e pode ser bloqueada.
- **O que não muda:** o login continua não bastando para ver a localização exata. A área de 500 m, a exata só para adotante, verificado e moderador, e os limites diários seguem valendo ([06-riscos.md](06-riscos.md#3-segurança-dos-animais-localização)).
- **Custo aceito:** mais atrito para quem só quer olhar, o que pesa contra o cold start (R8). Para compensar, a tela de entrada explica o motivo, e o login continua a um toque (Google) ou a um código por e-mail.
- **Consequências:**
  - API: `GET /casinhas` e `GET /casinhas/:id` exigem token. Nenhuma leitura de casinha é `@Publico()`.
  - App: as abas ficam atrás de `Stack.Protected` com `estado === 'logado'`; o `useExigirLogin()` deixou de existir.
  - Compartilhamento (T2.2): a página web de um link não mostra mapa nem área, só nome, status e o botão da loja.

### D02 — Camadas dentro de cada módulo da API (2026-09-28)

- **Antes:** cada módulo tinha controller + service; o service era o caso de uso e falava direto com o Prisma, dentro da transação.
- **Agora:** cada módulo tem três pastas: `domain` (entidades, repositórios e providers como **interfaces**, mais as regras puras), `application` (DTOs e use-cases, que só conhecem as interfaces) e `infra` (controller, repositórios Prisma com o mapeamento para a entidade, adaptadores para outros módulos). As transações passam por uma porta `Transacao`; erros e respostas HTTP usam `src/shared`.
- **Por quê:** separar a regra de negócio do banco e do HTTP, testar use-cases sem banco (dublês em memória) e deixar claro o que cada módulo depende dos outros (portas no `domain`, adaptadores na `infra`).
- **Custo aceito:** mais arquivos e indireção por ação; os testes de ponta a ponta continuam sendo a prova principal das regras que dependem do banco (índices, travas, cascata).
- **Como foi feito:** piloto no módulo `necessidades`, depois os outros dez (concluído em 2026-09-28); a antiga pasta `comum/` foi absorvida por `shared/`. Um teste de arquitetura impede `domain` de importar Nest/Prisma/infra e `application` de importar Prisma/infra. Detalhes em [04-arquitetura.md](04-arquitetura.md#camadas-de-um-módulo).

### D03 — Fotos dos moradores, sem cadastro de animal (2026-10-01)

- **Antes:** só fotos da casinha (perfil, até 5) e de atividades; cadastro de animais estava fora de escopo.
- **Agora (F2, T2.15):** a casinha ganha uma seção **"Quem mora aqui"** com fotos dos animais que a frequentam e uma legenda curta opcional ("Caramelo, dócil, aparece de manhã"). Não existe entidade `Animal`: é uma foto com `tipo = animal`.
- **Por quê:** cria vínculo (ajuda a retenção de contribuidores), mostra que a casinha está em uso e ajuda a notar quando um morador some. A ficha completa de animal (opção B) custaria uma entidade nova, telas, moderação e mescla de duplicatas, e abriria caminho para o app virar app de adoção de animais, que segue fora de escopo.
- **Custo aceito:** mais fotos para moderar (a denúncia de foto já cobre) e um animal identificado por nome (risco baixo; ver [06-riscos.md](06-riscos.md#3-segurança-dos-animais-localização)).
- **Se ONGs pedirem a ficha (F3):** a legenda e as fotos de morador viram o ponto de partida da migração para uma entidade `Animal`.
