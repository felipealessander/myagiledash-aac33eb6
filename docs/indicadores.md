# Portal de Indicadores Attus — Inventário e Regras dos Indicadores

Fonte única das regras de fluxo: `src/lib/flowMetrics.ts`.
Nenhum widget deve reimplementar cálculo próprio de Lead Time, Cycle Time, contagem
de entregas ou estatísticas. Cards, gráficos, históricos, comparações e detalhamentos
consomem exatamente o mesmo resultado (`buildFlowMetrics` / `buildFlowComparison` /
`buildOnDemandHistory`).

## Regras transversais

| Tema | Regra |
| --- | --- |
| Competência mensal | Sempre pela **data de fechamento** (`resolved_at`). Item aberto em mês anterior e fechado no mês selecionado conta no mês de conclusão. Itens abertos não são entregas. |
| Deduplicação | `dedupeByTaskCode` — um `task_code` aparece uma única vez; vence o registro com conclusão mais recente (estado final após troca de squad/status). |
| Arquivados | Status contendo "Arquivado" é excluído globalmente. |
| Elegibilidade de fluxo | Épicos e squad "Qualidade" ficam fora das métricas de fluxo. |
| Incidentes | Incidente, Bug e DeadLetter ficam fora dos indicadores gerais por padrão e têm aba própria sempre completa. |
| Bugs / DeadLetters | Filtros independentes (`inclusion.bugs`, `inclusion.deadletters`). "Bug" e "Incidente" são a mesma opção por regra de negócio. Card com dupla classificação conta uma vez (DeadLetter tem precedência). |
| Sob Demanda | Item com cliente vinculado (`client` preenchido). |
| Datas invertidas | `businessDaysBetween` retorna 0 quando fim ≤ início — nunca há valor negativo. |
| Divisão por zero | `computeStats` e `computeVariation` retornam 0 / `null` sem dados. |

## Indicadores

### Lead Time
- **Objetivo**: tempo total desde a solicitação até a entrega.
- **Fonte**: `report_tasks` (via `useFlowTasks`).
- **Início**: `created_at_yt` (abertura do card). **Término**: `resolved_at`.
- **Unidade**: dias **úteis** (seg–sex), arredondados a 1 casa nas estatísticas.
- **Ausência de dados**: card sem `created_at_yt` **não** entra no Lead Time; é contado em `missingCreated` e listado como inconsistência.
- **Reabertos**: contados em `reopened` (tags "reabert"/"retorno"/"corrigir"); o cálculo usa a conclusão vigente.
- **Tipos participantes**: demandas regulares + Bug/Incidente e DeadLetter conforme filtros.

### Cycle Time
- **Início**: `started_at` (entrada em desenvolvimento). **Término**: `resolved_at`.
- **Fallback**: sem `started_at`, usa `created_at_yt` e o card é sinalizado em `missingStart` e no painel de inconsistências (não gera valor artificial oculto).
- Esperas e retornos de status não são descontados — o Cycle Time é ponta a ponta do desenvolvimento.
- Mudança de squad não duplica o card (dedupe por `task_code`).

### Quantidades
- `completed`: itens com `resolved_at` no período.
- `open`: itens sem `resolved_at` criados no período (nunca entram como entrega).
- `byType`: distribuição por classificação (regular / bug / deadletter / incidente).

### Estatísticas
- **Média**: aritmética simples sobre os valores válidos.
- **Mediana**: percentil 50 por *nearest-rank*.
- **P85**: percentil 85 por *nearest-rank*.
- Sem registros ⇒ todos os valores são 0 e `count = 0` (ausência de dados, não erro).
- Arredondamento: 1 casa decimal (`round1`).
- Não há remoção automática de outliers nos indicadores de fluxo.

### Comparação mensal
- Até 3 meses selecionáveis; todos usam a mesma regra, os mesmos filtros de squad/cliente e a mesma configuração de Bugs/DeadLetters.
- Variação absoluta e percentual via `computeVariation` (percentual `null` quando o mês anterior é 0).

### Histórico Sob Demanda
- `buildOnDemandHistory`: mês a mês, itens com cliente vinculado — concluídos, abertos, clientes distintos, horas apontadas, Lead/Cycle mediana e P85.

## Rastreabilidade

Cada segmento expõe `items` com: código, título, squad, cliente, tipo, categoria,
data de abertura, data de início, data de fechamento, Lead, Cycle, horas apontadas,
flags de Bug / DeadLetter / Incidente, **motivo de inclusão** e inconsistências.
A quantidade de linhas do detalhamento é igual a `completed`.

## Monitoramento de inconsistências

`detectTaskIssues` sinaliza, sem alterar silenciosamente os números:
fechamento anterior à abertura, início anterior à abertura, concluído sem abertura,
concluído sem início, card sem squad e card sem classificação.
Elas aparecem no painel "Inconsistências de dados detectadas" do widget.

## Manutenção

Qualquer mudança de regra exige atualizar este documento e os testes em
`src/test/flowMetrics.test.ts`.

## Fonte única das regras de classificação (`src/lib/taskRules.ts`)

Todos os módulos do portal consomem as mesmas funções para classificar cards —
nenhum módulo reimplementa a regra:

| Regra | Função | Definição |
| --- | --- | --- |
| Arquivado | `isArchivedStatus` / `isArchived` | status **contém** "arquivado" (qualquer sufixo) — excluído de todos os indicadores |
| Concluído | `isDoneStatus` | status contém "conclu", "done" ou "delivery" |
| DeadLetter (DLQ) | `isDeadLetter` | tag **ou** tipo casando `dead[ -]?letter` |
| Bug | `isBug` | tipo `Bug` / `Bugs` |
| Incidente | `isIncident` | tipo `Incidente` / `Incidentes` |
| Épico | `isEpic` | tipo `Épico` / `Epico` / `Epic` — entra no esforço, fora do fluxo |
| Squad Qualidade | `isQualidadeSquad` | squad `Qualidade` — fora das métricas de fluxo |

Módulos já centralizados: Fluxo (`flowMetrics`), Apresentação (`presentationMetrics`),
Dashboard (`useDashboardData`), Capacidade (`useCapacityData`), Clientes
(`clientUsage` / `useClientsData`) e Incidentes (`useIncidentsData`).

Divergências corrigidas nesta auditoria:
- **Clientes** excluía arquivados apenas com igualdade exata (`status === "arquivado"`);
  status como "Arquivado (duplicado)" entravam no realizado. Agora usa a regra por conteúdo.
- **Apresentação** e **Incidentes** não reconheciam o tipo no plural ("Incidentes").
- Regex de DeadLetter estava duplicada em quatro arquivos; agora é única.

Cobertura: `src/test/taskRules.test.ts`.
