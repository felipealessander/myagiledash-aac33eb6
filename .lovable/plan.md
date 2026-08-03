# Reestruturação do Dashboard de Indicadores — Fases restantes

## Já concluído nas etapas anteriores

- Rótulos de Lead Time / Cycle Time corrigidos (rotação -35º) e alerta de "dados insuficientes" quando a amostra é pequena — a Code418 tinha dados válidos, mas os rótulos estavam sendo ocultados automaticamente pelo gráfico.
- Throughput com alternância Semanal / Mensal (últimos 6 meses) e linha de tendência.
- Linhas de tendência nas séries de evolução mensal.
- Listagem paginada de incidentes (Incidentes / Bugs / DLQ) direto na página, com busca e link para o YouTrack.
- Nova ordem dos blocos: Produto (geral) → Incidentes → Métricas Ágeis → Evolução Mensal → Sob Demanda → Faturamento.
- Regras de classificação centralizadas em `src/lib/taskRules.ts`; 105 testes automatizados passando.

## O que falta (esta fase)

### 1. Filtro global de meses (multi-seleção)

Hoje o seletor de período aceita **um** valor por vez (mês único ou "Ano consolidado"). Será substituído por um filtro multi-seleção:

- selecionar 1 mês, vários meses, o ano inteiro ou limpar (volta ao consolidado do ano);
- chip visível no topo indicando o período ativo (ano completo / mês único / N meses / intervalo);
- o mesmo conjunto de meses é aplicado a todos os blocos, sem recarregar a página;
- meses sem dados continuam visíveis nos gráficos com valor zero.

### 2. Comparação mensal nos blocos compatíveis

Com 2+ meses selecionados, cada bloco compatível passa a exibir série por mês, variação absoluta e variação percentual:

- visão geral consolidada (KPIs viram mini-série comparativa);
- indicadores de incidentes (evolução + tendência + abertura dos registros por mês);
- distribuição por time (barras agrupadas por mês);
- horas por categoria (barras agrupadas por mês + comparação percentual);
- Entregas por Tipo — mensal, com seleção de tipos e tendência.

Indicadores que não suportam comparação (ex.: WIP instantâneo) exibem uma nota explicando o motivo.

### 3. Visão por squad condicionada à seleção

- Sem squad selecionada: apenas o consolidado de todas as squads; os cards e gráficos por squad ficam ocultos.
- Com 1+ squads: aparecem os widgets por squad, comparação entre squads e comparação mensal, sempre com os mesmos filtros de período.

### 4. Rastreabilidade (clicar no número → ver os cards)

Cada KPI e cada barra/ponto de gráfico abre um painel com os cards que compõem o valor (código, título, squad, tipo, datas, horas), paginado no mesmo padrão da listagem de incidentes. A soma do detalhamento tem de bater com o valor exibido.

### 5. Regra única de Cycle Time

Revisar a regra para todas as squads (não só Code418): mesma fonte de `started_at` / `resolved_at`, mesmos status válidos, mesma exclusão de incidentes/épicos, e mensagem explícita de "Dados insuficientes" quando a amostra for menor que o mínimo — nunca zero silencioso.

### 6. Testes automatizados

Cobrir: consolidado anual sem mês, mês único, múltiplos meses, meses vazios, variação absoluta/percentual, exibição condicional por squad, paginação de incidentes, consistência widget × listagem, exclusão de incidentes dos ágeis, comparação mensal de distribuição por time e horas por categoria, tendência de Entregas por Tipo, Cycle Time por squad (incl. Code418), throughput semanal e mensal, filtros combinados (período + squad + cliente + tipo) e ausência de duplicidade.

## Detalhes técnicos

- `useDashboardData` passa a expor `selectedMonths: string[]` (o modo "ano" é a lista completa de meses do ano) e um agregador que devolve, por mês, o mesmo conjunto de métricas — todos os blocos consomem esse agregador em vez de recalcular.
- Novo `src/lib/monthComparison.ts` com as funções puras de agregação por mês, variação absoluta/percentual e alinhamento de meses vazios; é onde ficam os testes de comparação.
- Novo componente `MonthMultiSelector` substitui `MonthSelector`; `PeriodBadge` mostra o período ativo em cada bloco.
- Novo `DrillDownSheet` reutilizável (tabela paginada de cards) usado por KPIs e gráficos, alimentado pelas mesmas funções de filtro dos indicadores — garante que widget, gráfico e detalhamento nunca divirjam.
- Cycle Time e demais métricas de fluxo permanecem em `src/lib/flowMetrics.ts` / `src/lib/taskRules.ts` como fonte única; a revisão do item 5 é feita lá, não nos componentes.
- Testes em `src/test/monthComparison.test.ts`, `src/test/flowMetrics.test.ts` (extensão) e `src/test/dashboardAggregation.test.ts`.

## Execução sugerida

1. Filtro global multi-mês + agregador por mês + `PeriodBadge`.
2. Comparação mensal nos blocos (geral, incidentes, time, categoria, tipos).
3. Exibição condicional por squad.
4. Drill-down rastreável em KPIs e gráficos.
5. Revisão da regra de Cycle Time + estados de dados insuficientes.
6. Bateria de testes.
