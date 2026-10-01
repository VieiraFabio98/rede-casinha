# 06 — Riscos e mitigação

> Este documento não substitui orientação jurídica. Antes do lançamento público, vale uma revisão da política de privacidade e dos termos por um advogado. Clínicas jurídicas de universidades e advogados voluntários da causa animal costumam ajudar de graça.

## Matriz resumo

Escala: **B** = baixa · **M** = média · **A** = alta.

| # | Risco | Probabilidade | Impacto | Mitigação principal | Seção |
|---|---|:-:|:-:|---|---|
| R1 | Localização usada para maus-tratos ou vandalismo | M | **A** | Mapa só com login; área aproximada de 500 m; exata só para adotante, verificado e moderador | [3](#3-segurança-dos-animais-localização) |
| R2 | Vazamento ou uso indevido de dados pessoais (LGPD) | B | A | Minimização, autorização coberta por testes e2e, servidor em São Paulo | [1](#1-lgpd-e-privacidade) |
| R3 | Status falso ("atendido" sem atender) deixa animal sem comida | M | A | Contestação 24 h, verde dura só 7 dias, expiração | [2](#2-moderação-conteúdo-falso-spam-e-duplicatas) |
| R4 | Spam, casinhas falsas, duplicatas | A | M | Login, limites, checagem de 30 m, denúncias | [2](#2-moderação-conteúdo-falso-spam-e-duplicatas) |
| R5 | Estourar o plano gratuito | M | M | Fotos comprimidas, gatilhos de migração | [4](#4-custos-que-crescem-com-o-uso) |
| R6 | Reprovação ou atraso na Google Play | M | A | Teste fechado cedo, checklist de políticas | [5](#5-aprovação-nas-lojas) |
| R7 | Moderador único sobrecarregado ou esgotado | A | A | Automação, limite de 30 min/dia, moderadores voluntários na F2 | [6](#6-outros-riscos) |
| R8 | Ninguém usa (cold start) | A | A | Cidade piloto, semeadura presencial, WhatsApp | [6](#6-outros-riscos) |
| R9 | Fornecedor gratuito some ou muda regras | B | M | Tecnologias abertas e plano B documentado | [6](#6-outros-riscos) |
| R10 | Servidor próprio mal administrado (invasão, disco cheio, fora do ar) | M | A | Hardening básico, atualizações, backup testado, monitoramento | [6](#6-outros-riscos) |

---

## 1. LGPD e privacidade

### Papel e obrigações
- **Controlador:** você, como pessoa física. Enquadra-se como **agente de tratamento de pequeno porte** (Resolução CD/ANPD nº 2/2022): **dispensado de indicar encarregado (DPO)**, mas **obrigado a manter um canal de comunicação** com os titulares, que será o e-mail do projeto publicado na política. Também tem prazos diferenciados para algumas obrigações.
- **Operadores:** provedor da VPS (Oracle Cloud: servidor onde ficam banco, API e fotos), Resend (e-mail), Sentry (erros), PostHog (analytics), Google (login, Play), Expo (build e push). Todos devem constar na política.
- Se o projeto for formalizado (associação), o controlador passa a ser a pessoa jurídica. Atualize a política e reavalie o Marco Civil (art. 15: guarda de registros de acesso por 6 meses para provedores com fins econômicos).

### Inventário de dados

| Dado | Finalidade | Base legal (LGPD art. 7º) | Onde fica | Retenção |
|---|---|---|---|---|
| E-mail | Login, contato sobre a conta | Execução de contrato (V) | Tabela de usuários (Postgres) | Até a exclusão da conta |
| Apelido | Identificação pública das contribuições | Execução de contrato (V) | `perfis` | Até a exclusão (depois vira "Usuário removido") |
| Declaração 18+ e aceite de termos (com versão) | Comprovação de aceite | Exercício regular de direitos (VI) | `perfis` | Conta + 5 anos |
| Localização do usuário no momento de uma ação | Validar proximidade (adoção, reporte) | Legítimo interesse (IX): prevenção de fraude | **Não armazenada** (só o booleano) | Nenhuma |
| Localização das casinhas | Funcionamento do mapa | Legítimo interesse (IX) | `casinhas_localizacao` | Enquanto a casinha existir |
| Fotos | Mostrar o estado da casinha | Execução de contrato (V) | Disco da VPS | Perfil: até remoção; atendimento: 90 dias |
| Histórico de contribuições | Status e histórico das casinhas | Legítimo interesse (IX) | `atividades`, `necessidades` | Permanente, **anonimizado** após a exclusão da conta |
| Auditoria de acesso à localização exata | Segurança dos animais | Legítimo interesse (IX) | `acessos_localizacao` | 180 dias |
| Erros e eventos de uso (pseudonimizados) | Estabilidade, melhoria do produto | Legítimo interesse (IX) | Sentry, PostHog | 90 dias |
| Token de push (F2) | Notificações | Consentimento (I), via permissão do sistema | `dispositivos` | Até revogar ou excluir |

**Atenção:** muitas casinhas ficam **na calçada da casa do protetor**, então a localização exata pode revelar um endereço residencial. Trate-a como dado pessoal, o que é mais um motivo para a proteção da seção 3.

### Medidas concretas
- **Minimização:** apelido em vez de nome; sem telefone; sem CPF; sem localização em segundo plano; coordenadas do usuário descartadas depois da validação.
- **Menores:** uso só para maiores de 18 (autodeclaração). Evita o regime especial do art. 14 da LGPD e as obrigações do ECA Digital para produtos voltados a crianças e adolescentes.
- **Localização dos dados:** VPS na **região São Paulo**, com banco, API e fotos no Brasil. Sentry, PostHog e Resend processam fora do Brasil, o que é **transferência internacional**: declarar na política, preferir fornecedores com DPA e cláusulas-padrão (Resolução CD/ANPD nº 19/2024) e **não enviar dado pessoal direto** a eles (IDs pseudônimos, `beforeSend` que remove e-mail e coordenadas).
- **Legítimo interesse:** registrar num documento curto (LIA, 1 página) o teste de balanceamento para validação de proximidade e auditoria.
- **Direitos do titular:** acesso, correção e exportação por e-mail em até 15 dias (automático na F2); exclusão in-app e via web; correção do apelido no próprio app.
- **Incidentes:** plano de 1 página. (1) Conter: rotacionar chaves, revogar sessões. (2) Avaliar o risco. (3) Se houver risco relevante, comunicar a ANPD e os titulares no prazo da Resolução CD/ANPD nº 15/2024 (3 dias úteis; o prazo é em dobro para agente de pequeno porte). (4) Registrar o incidente.

### Checklist da política de privacidade
- [ ] Identificação do controlador e canal de contato
- [ ] Dados coletados, finalidades e bases legais (tabela acima em linguagem simples)
- [ ] Como a localização é protegida (aproximada × exata)
- [ ] Lista de operadores e transferência internacional
- [ ] Retenção e o que acontece ao excluir a conta
- [ ] Direitos do titular e como exercê-los
- [ ] Idade mínima de 18 anos
- [ ] Data da versão e como mudanças são comunicadas

---

## 2. Moderação: conteúdo falso, spam e duplicatas

### Ameaças e respostas

| Ameaça | Exemplo | Prevenção | Detecção | Resposta |
|---|---|---|---|---|
| **Atendimento falso** | Marca "abasteci" sem ir; a casinha fica verde e ninguém vai | Verde expira em 7 dias; pedidos de água e ração expiram rápido | Contestação por 24 h; consulta semanal: usuários com muitos atendimentos e `validado_local = false` | 3 contestações procedentes em 30 dias → bloqueio de 7 dias |
| **Casinha falsa ou troll** | Cadastro no meio de uma avenida, nome ofensivo | Login obrigatório; 5 cadastros/dia; precisão de GPS ≤ 30 m; foto obrigatória | Denúncias; `em_revisao` para quase-duplicatas | Ocultar e desativar; bloquear em caso de reincidência |
| **Duplicatas** | Duas pessoas cadastram a mesma casinha | Checagem de 30 m com "É uma destas?" | `fila_moderacao` lista pares a menos de 30 m | `mod_mesclar_casinhas` (leva histórico e adotantes) |
| **Spam em massa** | Script criando conta e reportes | Limites diários por usuário; OTP ou Google (custo de criar conta) | Pico de cadastros nos logs da API | Bloquear; exigir Google-only temporariamente |
| **Denúncias em massa (brigada)** | Grupo derruba a casinha de um desafeto | Ocultação automática só com 3 denúncias de contas com ≥ 7 dias | Várias denúncias de contas novas no mesmo alvo | Restaurar e bloquear os denunciantes abusivos |
| **Foto imprópria** | Rosto de pessoa, placa de carro, conteúdo ofensivo | Aviso na câmera; visitantes não veem fotos | Denúncia "expõe pessoa" (prioridade 24 h) | Ocultar a foto; bloquear em caso de reincidência |
| **Uso hostil do app** | Vizinho mapeia casinhas para pedir remoção | Localização aproximada (seção 3) | Auditoria de acessos | Revogar a verificação |

### Operação com 1 moderador (você)
- **Orçamento de tempo:** até 30 min/dia. Se passar disso por 2 semanas seguidas, é o gatilho para a **T2.3** (moderadores regionais voluntários).
- **SLA:** "perigo aos animais" e "expõe pessoa" em até 24 h; o resto em até 48 h.
- **Critérios para promover a verificado** (documentar em `docs/moderacao.md`): conta com ≥ 30 dias, ≥ 10 contribuições não contestadas, adotante de ≥ 1 casinha, e alguém da comunidade que conheça a pessoa (ex.: um protetor do grupo que responde por ela). Na dúvida, não promova, porque verificar é dar acesso à localização exata.
- Toda ação de moderação fica registrada (quem, o quê, quando, por quê).

---

## 3. Segurança dos animais: localização

### Modelo de ameaça (honesto)
Uma casinha é um objeto físico visível na rua. Quem percorre o bairro a pé vai achá-la de qualquer jeito. **O objetivo não é esconder a casinha, e sim impedir que o app facilite ataques remotos, em massa ou a distância**: tirar o custo de "clicar no mapa e ir direto" e fazer o atacante percorrer uma área de ~0,8 km² para cada casinha.

### Camadas de proteção

| Camada | Visitante | Colaborador | Adotante / criador | Verificado | Moderador |
|---|---|---|---|---|---|
| Área aproximada (círculo de 500 m) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Fotos | ❌ | ✅ | ✅ | ✅ | ✅ |
| Localização exata + "Como chegar" | ❌ | ❌ | ✅ (só a dela) | ✅ (50/dia, auditado) | ✅ |

0. **Mapa só com login** ([D01](01-visao-geral.md#d01--mapa-só-com-login-2026-09-25)). Nada de varredura anônima: toda consulta vem de uma conta com limites, rastro e que pode ser bloqueada.
1. **Ponto público fixo com deslocamento de 150–400 m**, sorteado uma vez e armazenado. Nunca é recalculado por consulta, o que impede a triangulação por média.
2. **A exata fica numa tabela separada, sem `select` direto.** Só sai por funções que checam a permissão. Há testes automatizados para cada nível.
3. **Fotos sem EXIF** (reencodadas no celular) e **escondidas de visitantes**. Aviso para não fotografar fachadas nem placas.
4. **Sem oráculos de distância:** `adotar_casinha` devolve só "ok" ou "não permitido"; `validado_local` nunca volta ao app. Tentativas de adoção são limitadas a 3/dia e a checagem de duplicata a 10/dia.
5. **Verificação manual e revogável**, com limite diário de casinhas exatas e auditoria em `acessos_localizacao`. Consulta semanal: verificados com > 20 casinhas distintas por dia ou acessos fora da própria cidade.
6. **Nada de "link com coordenada" no compartilhamento** (T2.2): a página pública não mostra mapa nem área, só nome, status e o botão da loja.
7. **Casinha sensível (F2):** o moderador pode esconder do mapa público uma casinha que já sofreu ataque. Ela fica visível só para adotantes e moderadores.
8. **Fotos dos moradores (F2, [D03](01-visao-geral.md#d03--fotos-dos-moradores-sem-cadastro-de-animal-2026-10-01)):** um animal com foto e nome fica reconhecível, mas a localização segue protegida pelas camadas acima e as fotos só aparecem para quem está logado. A legenda não deve trazer endereço nem horário exato de alimentação; o aviso da câmera e a denúncia de foto cobrem isso. Casinha sensível esconde também os moradores.

### Quando algo acontece
- Denúncia com motivo **"perigo aos animais"** tem prioridade máxima. Avise os adotantes (push na F2).
- Tela fixa **"Como denunciar maus-tratos"** com orientação: registrar boletim de ocorrência (delegacia ou delegacia on-line do estado), Disque Denúncia local, canais da prefeitura. Maus-tratos a cães e gatos é crime (Lei 9.605/1998, art. 32, com pena agravada pela Lei 14.064/2020).
- Se houver suspeita de que um usuário usou o app para achar a casinha: revogar a verificação, preservar os registros de auditoria e colaborar com as autoridades mediante requisição formal.

---

## 4. Custos que crescem com o uso

### Estimativa de consumo por usuário ativo por mês
- API (mapa + detalhe): ~2 MB · miniaturas: ~1,5 MB · fotos grandes: ~1 MB → **~4,5 MB de saída/usuário/mês** (já contando o cache de disco do `expo-image`).
- Banco: ~30 ações × ~400 bytes → irrelevante (anos de dados cabem em poucos GB).
- Fotos: ~150 KB por foto (as duas versões) → 1 GB ≈ 6.500 fotos.

### Limites, gatilhos e o que fazer

Referência: VPS na Oracle Cloud Always Free (ver [03-ferramentas.md](03-ferramentas.md#13-hospedagem-da-api-e-do-banco)).

| Recurso | Limite gratuito | Quando aperta (estimativa) | Gatilho de ação | Ação | Custo depois |
|---|---|---|---|---|---|
| **CPU e RAM da VPS** | até 4 vCPUs ARM e 24 GB | milhares a dezenas de milhares de usuários ativos/mês (API + Postgres no mesmo servidor) | CPU média > 60% ou RAM > 70% por uma semana | Otimizar consultas e índices; separar o Postgres numa segunda instância Always Free | VPS paga maior: ~US$ 10–20/mês |
| **Disco da VPS** | 200 GB (inclui o disco de boot) | centenas de milhares de fotos | 70% de uso | Apagar fotos de atendimento com mais de 90 dias; migrar fotos para o R2 (T2.14) | R2: grátis até 10 GB |
| Saída de rede | 10 TB/mês | não é gargalo nesta escala | — | — | — |
| **Recuperação de instância ociosa** | a Oracle pode recuperar instâncias gratuitas com uso muito baixo por 7 dias | fase de desenvolvimento e começo, com pouco uso | — | Converter a conta para *Pay As You Go* (continua grátis dentro dos limites); backup diário fora da VPS | — |
| Backup | nenhum automático | sempre | — | Backup diário criptografado com teste de restauração (T0.11) | — |
| Resend (código por e-mail) | 100 e-mails/dia | > 100 logins por e-mail/dia | 70/dia | Destacar o login com Google; adicionar Brevo (300/dia) como segundo provedor | Resend pago: ~US$ 20/mês |
| EAS Update (OTA) | ~1 mil MAU que recebem atualização | ~1.000 usuários | — | Usar OTA só para correção crítica; o resto via loja | Plano pago da Expo |
| EAS Build | ~15 builds Android/mês | desenvolvimento intenso | — | Build local para desenvolvimento | — |
| Sentry | ~5 mil erros/mês | loop de erro | alerta de cota | `sampleRate`, filtros, correção rápida | — |
| PostHog | 1 mi de eventos/mês | ~20 mil MAU | — | Eventos só da lista fechada | — |
| Mapa (OpenFreeMap) | sem limite declarado | — | — | Plano B: PMTiles do Brasil no R2 | ~grátis |

### Hábitos que evitam a conta surpresa
- A Oracle exige cartão: crie um **alerta de orçamento de US$ 1** para ser avisado de qualquer cobrança e use só formatos marcados como *Always Free*. Faça o mesmo no R2, quando ativar.
- Olhe CPU, RAM e disco da VPS (`docker stats`, `df -h`, ou um alerta simples por e-mail via cron) na rotina semanal de métricas (T1.16).
- **Primeiro gasto recomendado quando houver verba:** domínio `.com.br` (~R$ 40/ano no registro.br), para HTTPS, links de compartilhamento, e-mail de envio e App Links. **Segundo:** VPS paga (~US$ 5–10/mês), se a Oracle ficar instável ou a instância gratuita for recuperada.
- **Custo projetado:** US$ 0/mês (+ domínio) enquanto a VPS gratuita der conta; ~US$ 5–20/mês depois disso.

---

## 5. Aprovação nas lojas

### Google Play (MVP)

| Requisito | O que fazer | Task |
|---|---|---|
| **Teste fechado para conta pessoal nova** | ≥ 12 testadores inscritos por 14 dias seguidos antes de pedir produção. Começar cedo e recrutar 20 (margem para desistências). | T0.9 |
| Verificação de identidade do desenvolvedor | Documento na criação da conta; conferir o registro do pacote no programa de verificação de desenvolvedor Android (que começou pelo Brasil em 2026). | T0.1 |
| Nível de API alvo | Manter o SDK do Expo atualizado; conferir a exigência vigente de `targetSdkVersion` antes de cada release. | T1.15 |
| **Política de privacidade** | URL pública no Console **e** link dentro do app. | T0.8 |
| **Seção de segurança dos dados** | Declarar: e-mail, ID de usuário, localização precisa (processada de forma efêmera; finalidade: funcionalidade e prevenção de fraude), fotos, interações no app, logs de falha. Criptografia em trânsito: sim. Exclusão: sim. Coerente com a política. | T1.15 |
| **Exclusão de conta** | Dentro do app **e** URL web informada no Console. | T1.11 |
| Permissão de localização | Só em primeiro plano (`ACCESS_FINE_LOCATION`/`COARSE`). Garantir que **não** entra `ACCESS_BACKGROUND_LOCATION` no manifesto (conferir o AAB). Tela explicativa antes do pedido. | T0.6, T1.12 |
| Permissão de câmera | Pedir só ao tirar foto, com explicação. | T1.5 |
| **Fotos e vídeos** | Usar o Photo Picker; bloquear `READ_MEDIA_IMAGES` e `READ_EXTERNAL_STORAGE` (senão é preciso justificar e a chance de reprovação é alta). | T1.5 |
| **Conteúdo gerado por usuários** | Termos proibindo conteúdo ofensivo; denúncia in-app; moderação ativa. Se a revisão pedir, antecipar o "bloquear usuário" (RF06.4, ~1 dia). | T1.10 |
| **Acesso para o revisor** | O revisor precisa entrar no app. Criar uma conta de demonstração com **e-mail e senha** (opção discreta "Outras formas de entrar") e informar as credenciais em "Acesso ao app" no Console. OTP e Google não servem para o revisor. | T1.15 |
| Classificação indicativa | Questionário IARC (interação entre usuários: sim). | T0.9 |
| Público-alvo | 18+, o que evita a política Famílias. | T0.9 |
| Metadados | Sem "melhor", "nº 1" ou palavras-chave repetidas; screenshots reais. | T1.15 |

### App Store (Fase 3, para já saber)
- US$ 99/ano. Uma associação sem fins lucrativos pode pedir **isenção** (confirmar a elegibilidade do Brasil).
- **Sign in with Apple** é obrigatório se houver login com Google (diretriz 4.8).
- UGC (diretriz 1.2): filtro, denúncia, **bloqueio de usuários** e contato publicado. Por isso o RF06.4 é obrigatório antes do iOS.
- Exclusão de conta dentro do app (5.1.1(v)); Privacy Nutrition Labels; textos de permissão claros e específicos no `Info.plist`.
- Revisão mais rígida sobre "funcionalidade mínima": o app precisa de conteúdo real no mapa na hora da revisão.
- Não precisa de Mac: build e envio pelo EAS.

---

## 6. Outros riscos

| Risco | Mitigação |
|---|---|
| **Fundador solo: esgotamento ou ausência** | Escopo enxuto (corte de emergência em [05-tasks.md](05-tasks.md#corte-de-emergência-do-mvp)); moderação limitada a 30 min/dia; documentação e migrations versionadas; um segundo admin de confiança com acesso ao servidor e à Play (convite de usuário no Console) assim que possível. |
| **Cold start: mapa vazio** | Uma cidade só no começo; você e os testadores cadastram presencialmente as casinhas conhecidas (T1.16); divulgação nos grupos de WhatsApp onde os protetores já estão; o link de compartilhamento (T2.2) é o motor de crescimento. |
| **Dados desatualizados** | Status cinza deixa claro que "não sabemos"; expiração por tipo; push para adotantes (F2); encerramento de adoções inativas. |
| **GPS impreciso na cidade** | Exigir ≤ 30 m ou ajuste manual confirmado; guardar `precisao_m`; checagem de duplicata. |
| **OpenFreeMap fora do ar** | A URL do estilo fica numa constante que pode ser trocada por OTA; plano B com PMTiles no R2. |
| **Oracle muda o Always Free ou recupera a instância** | Tudo roda em Docker Compose + migrations versionadas + backup diário fora da VPS: dá para subir numa VPS paga em poucas horas. |
| **Servidor próprio mal administrado** | SSH só com chave; firewall liberando só 22, 80 e 443; Postgres sem porta pública; atualizações automáticas de segurança (`unattended-upgrades`); imagens Docker atualizadas mensalmente; alerta de disco e de API fora do ar (ex.: UptimeRobot grátis em `/saude`); backup com teste de restauração. |
| **Perda da chave de assinatura** | Play App Signing (a Google guarda a chave do app); a chave de upload fica no EAS e tem backup no gerenciador de senhas. |
| **Conflito legal sobre a casinha física** | Os termos deixam claro que o app só registra informação e não instala nem autoriza casinhas. Dica no app: "Converse com vizinhos e, se for espaço público, com a prefeitura". |
| **Responsabilidade por conteúdo de terceiros** | Canal de notificação publicado; remoção rápida de conteúdo manifestamente ilícito depois de notificação (atenção à interpretação do art. 19 do Marco Civil após a decisão do STF de 2025); registro das ações de moderação. |
| **Conta de verificado ou admin comprometida** | Admin usa login Google com 2FA; auditoria de acessos; revogação imediata; nenhuma service key no app. |
