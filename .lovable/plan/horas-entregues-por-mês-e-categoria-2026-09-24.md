# Horas entregues por mês e categoria

## Objetivo
Adicionar à visão anual do dashboard um gráfico solicitado pela diretoria, mostrando as horas realizadas em cada mês, separadas por categoria.

## Implementação
1. Calcular, para cada mês do ano selecionado, a soma de `spent_minutes` convertida em horas por categoria.
2. Usar as regras canônicas já existentes: excluir Arquivados, consolidar Bug/Defeito/Erro script como Incidente, identificar DeadLetter antes das demais categorias e manter Épico no esforço.
3. Exibir barras empilhadas mensais para Tarefa, Incidente, Melhoria, DeadLetter, Épico e Outros, com total do mês no tooltip e legendas claras.
4. Manter o gráfico dentro de “Evolução Mensal”, respeitando o ano e os filtros de squads selecionados.
5. Adicionar testes para validar soma de horas, conversão de minutos, classificação, exclusão de arquivados e ausência de duplicidade entre Incidente e DeadLetter.

## Regra de competência
O mês seguirá a mesma competência dos demais gráficos anuais: o relatório mensal ao qual o card pertence. Assim, o novo gráfico será reconciliável com o total de “Horas realizadas” já exibido no dashboard.

## Resultado esperado
Em cada mês, a soma das barras por categoria será igual ao total de horas realizadas daquele mês, permitindo acompanhar a composição anual do esforço entregue.
