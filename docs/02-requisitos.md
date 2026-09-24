# 02 — Requisitos

Legenda de fase: **MVP** = Fase 1 · **F2** = Fase 2 (comunidade) · **F3** = Fase 3 (escala e parcerias).

## Glossário

| Termo | Definição |
|---|---|
| **Casinha** | Abrigo comunitário para cães e/ou gatos em local público ou semipúblico. |
| **Necessidade** | Pedido aberto para uma casinha: ração, água, reforma, cobertas, limpeza, remédio/veterinário ou outro. |
| **Atendimento** | Registro de que uma necessidade foi resolvida ("abasteci a ração"). |
| **Check-in** | Registro de "passei aqui e está tudo ok", sem necessidade envolvida. |
| **Atividade** | Qualquer registro no histórico da casinha (reporte, atendimento, check-in, edição etc.). |
| **Adotante** | Usuário que se responsabiliza por acompanhar uma casinha (máximo de 3 por casinha). |
| **Localização pública** | Ponto deslocado de 150 a 400 m do real, exibido como uma área de 500 m de raio. |
| **Localização exata** | Coordenada real. Só aparece para quem tem permissão (ver matriz abaixo). |

## Níveis de acesso

| Nível | Quem é | Como obtém |
|---|---|---|
| `visitante` | Sem login | — |
| `colaborador` | Logado, e-mail confirmado, maior de 18 anos declarado | Cadastro |
| `verificado` | Colaborador de confiança | Promovido manualmente por um moderador |
| `moderador` | Cuida de denúncias e verificações | Promovido por um admin (F2: moderadores regionais voluntários) |
| `admin` | Fundador | Definido direto no banco |

"Adotante" e "criador" **não são níveis**. São vínculos com uma casinha específica e dão direitos só sobre ela.

## Requisitos funcionais

### RF01 — Mapa
| ID | Requisito | Fase |
|---|---|---|
| RF01.1 | Abrir o mapa centralizado na localização do usuário (com permissão) ou na última região vista. | MVP |
| RF01.2 | Mostrar casinhas com cor de status (verde, amarelo, vermelho, cinza). | MVP |
| RF01.3 | Agrupar marcadores (clustering) em zoom baixo; o cluster mostra a cor do pior status do grupo. | MVP |
| RF01.4 | Para quem não tem acesso à localização exata, exibir a casinha como **área aproximada** (círculo de 500 m), nunca como pino preciso. | MVP |
| RF01.5 | Filtrar por status ("só urgentes") e por tipo de necessidade. | MVP |
| RF01.6 | Legenda de cores acessível (cor + ícone + texto, não só cor). | MVP |
| RF01.7 | Funcionar offline com os dados já carregados (casinhas da última área vista). | MVP |
| RF01.8 | Baixar um mapa da região para uso offline ("meu bairro"). | F2 |
| RF01.9 | Busca por endereço ou bairro. | F2 |

### RF02 — Casinhas
| ID | Requisito | Fase |
|---|---|---|
| RF02.1 | Cadastrar casinha com GPS: capturar posição, mostrar a precisão e **exigir precisão ≤ 30 m** (ou ajuste manual do pino com confirmação). | MVP |
| RF02.2 | Campos: nome/apelido (ex.: "Casinha da Praça do Rosário"), animais atendidos (cães, gatos, ambos), descrição curta, 1 a 3 fotos. | MVP |
| RF02.3 | Detectar possível duplicata: se já existe casinha a até 30 m, mostrar "É uma destas?" antes de criar. | MVP |
| RF02.4 | Cadastro funciona offline e sincroniza depois. | MVP |
| RF02.5 | Tela de detalhe: status, necessidades abertas, fotos, adotantes (apelidos), histórico das últimas 30 atividades. | MVP |
| RF02.6 | Editar dados e fotos (ver matriz de permissões). | MVP |
| RF02.7 | Pedir desativação ("a casinha foi removida ou destruída"). | MVP |
| RF02.8 | Moderador mescla duplicatas, levando histórico e adotantes. | MVP (via SQL) / F2 (tela) |
| RF02.9 | Compartilhar a casinha por link (WhatsApp) mostrando a área aproximada. | F2 |
| RF02.10 | Placa com QR code que abre a casinha. | F2 |

### RF03 — Necessidades e atendimentos
| ID | Requisito | Fase |
|---|---|---|
| RF03.1 | Reportar necessidade: tipo, urgência (normal/urgente), observação opcional, foto opcional. | MVP |
| RF03.2 | Marcar como atendida com 1 toque ("Abasteci ração"), com observação e foto opcionais. | MVP |
| RF03.3 | Check-in "Passei aqui, está tudo ok". | MVP |
| RF03.4 | "Ainda precisa": reconfirma uma necessidade aberta e renova o prazo. | MVP |
| RF03.5 | Contestar um atendimento em até 24 h ("não foi atendido"), o que reabre a necessidade. | MVP |
| RF03.6 | Todas as ações acima funcionam offline (fila local) e sincronizam depois. | MVP |
| RF03.7 | Quantidade no pedido (ex.: "2 sacos de 10 kg"). | F2 |
| RF03.8 | Escala de abastecimento entre adotantes (quem vai em qual dia). | F2 |

### RF04 — Adoção de casinha
| ID | Requisito | Fase |
|---|---|---|
| RF04.1 | Adotar casinha: permitido ao criador, ou ao colaborador que esteja **a até 100 m da localização exata** no momento (validação no servidor). | MVP |
| RF04.2 | Até 3 adotantes ativos por casinha. | MVP |
| RF04.3 | Tela "Minhas casinhas", com status e necessidades de cada uma. | MVP |
| RF04.4 | Deixar de adotar. | MVP |
| RF04.5 | Push para adotantes: nova necessidade urgente, necessidade expirando, atendimento feito por terceiro. | F2 |
| RF04.6 | Adotante que fica 45 dias sem nenhuma atividade na casinha recebe um aviso; após 60 dias, a adoção é encerrada automaticamente. | F2 |
| RF04.7 | "Seguir" casinha sem adotar (receber avisos). | F2 |

### RF05 — Conta e perfil
| ID | Requisito | Fase |
|---|---|---|
| RF05.1 | Login com Google e com código de 6 dígitos por e-mail. Login com e-mail e senha como opção discreta ("Outras formas de entrar"), necessária para a conta de demonstração do revisor da loja. | MVP |
| RF05.2 | No cadastro: apelido público (não precisa ser o nome real), declaração de idade ≥ 18 anos, aceite de termos e da política de privacidade (com versão registrada). | MVP |
| RF05.3 | Excluir a conta **dentro do app** e também por página web (exigência da Google Play). | MVP |
| RF05.4 | Exportar meus dados (LGPD, direito de acesso). MVP: pedido por e-mail, atendido manualmente em até 15 dias. | MVP (manual) / F2 (automático) |
| RF05.5 | Perfil público com contagem de contribuições e selos. | F2 |

### RF06 — Moderação
| ID | Requisito | Fase |
|---|---|---|
| RF06.1 | Denunciar casinha, foto, necessidade ou usuário (motivos: falsa, duplicada, ofensiva, expõe pessoa, perigo aos animais, outro). | MVP |
| RF06.2 | Ocultar automaticamente um conteúdo que recebe 3 denúncias de usuários diferentes com contas de pelo menos 7 dias, até a revisão (evita brigadas de contas novas). | MVP |
| RF06.3 | Moderador: ocultar ou restaurar conteúdo, desativar casinha, bloquear usuário, promover a verificado, mesclar casinhas. MVP: via rotas `/admin` da API (cliente HTTP). | MVP (API) / F2 (tela no app) |
| RF06.4 | Bloquear usuário (esconder o conteúdo dele para mim). | F2 |
| RF06.5 | Fila de moderação dentro do app, com moderadores regionais. | F2 |

### RF07 — Parcerias
| ID | Requisito | Fase |
|---|---|---|
| RF07.1 | Contas de organização (ONG ou prefeitura) com membros. | F3 |
| RF07.2 | Painel web com dados agregados por bairro e município. | F3 |
| RF07.3 | Dados abertos anonimizados (contagens por município, sem coordenadas). | F3 |
| RF07.4 | App iOS. | F3 |

## Matriz de permissões

| Ação | Visitante | Colaborador | Criador / Adotante (da casinha) | Verificado | Moderador |
|---|:-:|:-:|:-:|:-:|:-:|
| Ver mapa com área aproximada e status | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver fotos | ❌ | ✅ | ✅ | ✅ | ✅ |
| Ver localização exata | ❌ | ❌ | ✅ (só dessa casinha) | ✅ (máx. 50 casinhas distintas por dia, com registro em log) | ✅ |
| Cadastrar casinha | ❌ | ✅ (5/dia) | — | ✅ (20/dia) | ✅ |
| Reportar, atender, check-in, reconfirmar | ❌ | ✅ | ✅ | ✅ | ✅ |
| Editar nome, descrição e fotos | ❌ | ❌ | ✅ | ❌ | ✅ |
| Ajustar localização em até 30 m (com GPS no local) | ❌ | ❌ | ✅ | ❌ | ✅ |
| Ajustar localização em mais de 30 m | ❌ | ❌ | ❌ (solicita) | ❌ | ✅ |
| Pedir desativação | ❌ | ✅ | ✅ | ✅ | ✅ |
| Desativar ou excluir | ❌ | ❌ | ❌ | ❌ | ✅ |
| Adotar | ❌ | ✅ (a até 100 m) | ✅ (criador) | ✅ (a até 100 m) | ✅ |
| Promover a verificado | ❌ | ❌ | ❌ | ❌ | ✅ |

## Regras de negócio

### RN01 — Cálculo do status (feito no servidor)
Avaliadas nesta ordem, a primeira regra verdadeira define o status:
1. `inativa`: casinha desativada. **Não aparece no mapa.**
2. `urgente` 🔴: existe necessidade aberta com urgência `urgente`, **ou** necessidade aberta de `agua`/`racao` criada há mais de 48 h.
3. `atencao` 🟡: existe pelo menos 1 necessidade aberta.
4. `ok` 🟢: a última atividade (check-in, atendimento, reporte ou reconfirmação) foi há 7 dias ou menos.
5. `sem_noticias` ⚪: todo o resto.

O status é recalculado por trigger a cada atividade e por um job a cada hora, que cuida das transições por tempo.

### RN02 — Expiração de necessidades
Uma necessidade aberta **expira** se ninguém a reconfirmar dentro do prazo do tipo dela. Racional: água e comida mudam rápido. Um "sem ração" de 5 dias atrás provavelmente já foi resolvido ou precisa ser confirmado de novo.

| Tipo | Prazo até expirar |
|---|---|
| `agua` | 2 dias |
| `racao` | 3 dias |
| `limpeza` | 7 dias |
| `remedio_veterinario` | 7 dias |
| `cobertas` | 14 dias |
| `outro` | 14 dias |
| `reforma` | 30 dias |

- "Ainda precisa" renova o prazo a partir de agora. Cada usuário pode reconfirmar a mesma necessidade no máximo 1 vez a cada 12 h.
- Uma necessidade expirada sai do cálculo de status e fica no histórico como "expirada".
- **Não existem duas necessidades abertas do mesmo tipo na mesma casinha.** Reportar de novo um tipo que já está aberto vira reconfirmação (e, se o novo reporte for urgente, a urgência sobe).

### RN03 — Atendimento e contestação
- Qualquer colaborador pode marcar uma necessidade como atendida.
- Durante 24 h depois do atendimento, qualquer colaborador pode contestar. A necessidade volta a `aberta` e a contestação fica registrada no histórico.
- Um usuário com 3 atendimentos contestados e confirmados como falsos por um moderador em 30 dias é bloqueado por 7 dias.
- Um atendimento feito offline que chega ao servidor depois de outro atendimento da mesma necessidade é registrado como atividade, mas não muda o status. O app mostra "Alguém já tinha atendido. Obrigado!".

### RN04 — Duplicatas
- Ao cadastrar, o servidor procura casinhas ativas a até 30 m. Se encontrar, o app mostra os candidatos (nome e foto, **sem coordenadas**).
- O usuário pode confirmar que é uma casinha nova. Nesse caso ela é criada com `situacao = em_revisao`: aparece no mapa, mas entra na fila de moderação.
- A mescla (moderador) leva atividades, fotos e adotantes para a casinha de destino e desativa a de origem.

### RN05 — Localização
- A localização exata fica numa tabela separada, que só o módulo de localização da API pode ler.
- A **localização pública** é calculada **uma única vez**, no cadastro: ponto exato + deslocamento aleatório com distância entre 150 e 400 m e direção aleatória. Ela é armazenada e **não é recalculada a cada consulta**, porque sortear de novo a cada consulta permitiria descobrir o ponto real tirando a média de várias respostas.
- A localização pública só é recalculada se a exata mudar mais de 30 m.
- O app desenha um círculo de 500 m de raio em volta do ponto público, e o ponto exato sempre fica dentro dele.
- As coordenadas do **usuário** enviadas para validar proximidade (adoção e reportes) **não são armazenadas**. Guardamos só o resultado booleano (`validado_local`), e esse resultado não é devolvido ao app.
- As fotos são reencodadas no celular antes do upload, o que remove o EXIF e, com ele, o GPS embutido.

### RN06 — Limites anti-abuso (por usuário)
| Ação | Limite |
|---|---|
| Cadastrar casinha | 5/dia (colaborador), 20/dia (verificado) |
| Tentativas de cadastro que batem na checagem de duplicata | 10/dia |
| Reportes, atendimentos, check-ins e reconfirmações | 60/dia no total |
| Pedidos de adoção | 3/dia |
| Fotos | 20/dia; máximo de 5 fotos de perfil por casinha; fotos de atendimento são apagadas após 90 dias |
| Denúncias | 20/dia |
| Casinhas com localização exata vistas (verificado) | 50 distintas/dia |

### RN07 — Conta
- Idade mínima: 18 anos (autodeclarada). Isso evita o tratamento de dados de menores (LGPD art. 14 e ECA Digital).
- Ao excluir a conta: perfil, e-mail, tokens de push e adoções são apagados. As contribuições (reportes, atendimentos) ficam anonimizadas como "Usuário removido", porque o histórico da casinha é de interesse coletivo. As fotos enviadas pelo usuário são apagadas.
- Apelido: de 3 a 30 caracteres, único, sem e-mail ou telefone (validação por regex).

## Requisitos não funcionais

| ID | Requisito | Meta concreta | Fase |
|---|---|---|---|
| RNF01 | **Offline-first para escrita** | Toda ação de escrita entra numa fila local e é enviada quando houver rede. Nenhuma ação é perdida se o app for fechado. | MVP |
| RNF02 | **Conexão ruim** | Carregar o mapa de uma área funciona em 3G lento (400 kbps) em < 5 s. Respostas de API < 50 KB por área. | MVP |
| RNF03 | **Aparelhos simples** | Roda liso em Android 8+ com 2 GB de RAM. APK/AAB baixado < 30 MB. | MVP |
| RNF04 | **Fotos leves** | Duas versões por foto: 1024 px (~120 KB) e miniatura de 320 px (~25 KB), JPEG com qualidade 0,7, sem EXIF. | MVP |
| RNF05 | **Segurança** | Toda escrita passa pela API, que valida permissão, entrada (DTOs) e limites. Guard global: toda rota exige login, exceto as marcadas como públicas. Banco sem porta exposta à internet. | MVP |
| RNF06 | **Privacidade** | Localização exata nunca sai do servidor para quem não tem permissão (validado por testes e2e automatizados para cada nível de acesso). | MVP |
| RNF07 | **Acessibilidade** | Status indicado por cor + ícone + texto. Alvos de toque ≥ 48 dp. Suporte a fonte grande do sistema. Leitor de tela nos fluxos principais. | MVP |
| RNF08 | **Usabilidade na rua** | Ação principal ("Abasteci" / "Precisa de...") a no máximo 2 toques do detalhe da casinha. Usável com uma mão. | MVP |
| RNF09 | **Custo** | Operar a custo zero (VPS Always Free da Oracle + planos gratuitos) nos primeiros milhares de usuários ativos por mês, com gatilhos de ação definidos (ver [06-riscos.md](06-riscos.md#4-custos-que-crescem-com-o-uso)). | MVP |
| RNF10 | **Observabilidade** | Crashes e erros de sincronização reportados ao Sentry sem dados pessoais. | MVP |
| RNF11 | **Idioma** | pt-BR. Textos centralizados num arquivo para facilitar i18n no futuro. | MVP |
| RNF12 | **Permissões mínimas** | Só localização *enquanto o app está em uso*. Nada de localização em segundo plano. Fotos pelo seletor do sistema (Photo Picker), sem permissão de galeria. | MVP |
| RNF13 | **Backups** | Dump diário do banco + fotos, criptografado, guardado fora da VPS, com teste de restauração. | MVP |
| RNF14 | **Atualização rápida** | Correções só de JavaScript publicadas por OTA (EAS Update) sem passar pela loja. | MVP |

## Critério de "MVP pronto"

O MVP está pronto quando, **no celular Android de um testador, com o modo avião ligado**, é possível:
1. Abrir o mapa e ver as casinhas da última área carregada.
2. Cadastrar uma casinha com foto.
3. Reportar "sem água" em outra casinha.
4. Desligar o modo avião e ver, em até 30 s, as três ações refletidas no mapa de **outro** aparelho, com a cor certa.

Além disso: o app está publicado em produção na Google Play e há pelo menos 20 casinhas reais cadastradas na cidade piloto.
