# Legendas dos gráficos com cores claras

## Problema confirmado

Inspecionei os gráficos renderizados no dashboard e nas páginas de incidentes/clientes/capacidade. O Recharts pinta o texto da legenda com a **mesma cor da série**, então itens com cores escuras ficam quase invisíveis sobre o fundo escuro. Exemplos encontrados:

- "Entregas por Tipo (Mensal)": `Incidente` (vermelho escuro) e `DeadLetter` (roxo escuro)
- "Throughput vs WIP Mensal": `WIP` (roxo escuro)
- "Criados vs Resolvidos" (Incidentes): `Criados` (vermelho escuro)

O mesmo vale para qualquer gráfico futuro que use uma cor de série escura.

## Solução

1. **Regra global de estilo** em `src/index.css`: forçar o texto da legenda do Recharts (`.recharts-legend-item-text`) a usar `hsl(var(--foreground))`, mantendo apenas o quadradinho/ícone colorido para identificar a série. Isso corrige todos os gráficos de uma vez, inclusive os novos.
2. **Ticks dos eixos e rótulos**: aplicar a mesma garantia para textos de eixo/label que hoje não definem cor explícita, usando `hsl(var(--muted-foreground))`.
3. **Clarear as cores de série mais escuras** usadas como fill nos gráficos (vermelho de incidente e roxo de DeadLetter/WIP), subindo a luminosidade para melhor contraste tanto nas barras quanto nos ícones da legenda.
4. **Revalidar visualmente** com um script que percorre as rotas principais e verifica que nenhum texto de legenda tem luminância baixa.

## Detalhes técnicos

- `src/index.css`: adicionar bloco `@layer base` com as regras `.recharts-legend-item-text` e `.recharts-cartesian-axis-tick-value` (esta última só quando não houver `fill` explícito).
- Cores escuras ajustadas nos componentes que as declaram inline: `MonthlyTrendCharts.tsx` (incidente `hsl(0,72%,51%)` → tom mais claro; DeadLetter/WIP `hsl(280,67%,56%)` → tom mais claro) e equivalentes em `IncidentsByClientChart.tsx` / demais gráficos de incidentes.
- Nenhuma mudança em lógica de dados ou cálculo de indicadores.
