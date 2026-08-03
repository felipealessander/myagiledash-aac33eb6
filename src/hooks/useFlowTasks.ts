import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MonthOption } from "@/hooks/useDashboardData";
import type { FlowTask } from "@/lib/flowMetrics";

const SELECT_COLUMNS =
  "task_code, title, category, squad, status, client, created_at_yt, started_at, resolved_at, tags, spent_minutes, interrupted_minutes";

/**
 * Janela ISO (UTC) do período. Aceita "YYYY-MM" ou "year-YYYY".
 * A competência dos indicadores é pelo mês da data ISO (mesma regra de
 * `monthKeyOf` em flowMetrics), por isso a janela é em UTC.
 */
function periodRange(periodValue: string): { start: string; end: string } {
  if (periodValue.startsWith("year-")) {
    const year = Number(periodValue.replace("year-", ""));
    return { start: `${year}-01-01T00:00:00.000Z`, end: `${year + 1}-01-01T00:00:00.000Z` };
  }
  const [y, m] = periodValue.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

async function fetchPaginated(
  build: (from: number, to: number) => ReturnType<typeof supabase.from>,
): Promise<FlowTask[]> {
  const out: FlowTask[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = (await (build(from, from + pageSize - 1) as any)) as {
      data: FlowTask[] | null;
      error: unknown;
    };
    if (error) break;
    out.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/**
 * Carrega as tarefas de um período pela DATA (não pelo relatório de origem):
 *  - concluídas com `resolved_at` dentro do período (regra de competência);
 *  - abertas com `created_at_yt` dentro do período (WIP / não entregas).
 *
 * Buscar por relatório perdia cards concluídos no mês cujo registro só existe
 * no relatório de outro mês. A deduplicação por `task_code` acontece em
 * `flowMetrics`.
 */
async function fetchTasksForPeriod(periodValue: string): Promise<FlowTask[]> {
  const { start, end } = periodRange(periodValue);

  const [resolved, opened] = await Promise.all([
    fetchPaginated((from, to) =>
      supabase
        .from("report_tasks")
        .select(SELECT_COLUMNS)
        .gte("resolved_at", start)
        .lt("resolved_at", end)
        .range(from, to) as any,
    ),
    fetchPaginated((from, to) =>
      supabase
        .from("report_tasks")
        .select(SELECT_COLUMNS)
        .is("resolved_at", null)
        .gte("created_at_yt", start)
        .lt("created_at_yt", end)
        .range(from, to) as any,
    ),
  ]);

  return [...resolved, ...opened];
}

/**
 * Carrega as tarefas por período, com cache, para alimentar os widgets de
 * fluxo com comparação entre períodos e histórico Sob Demanda.
 */
export function useFlowTasks(months: MonthOption[], monthValues: string[]) {
  const [tasksByPeriod, setTasksByPeriod] = useState<Record<string, FlowTask[]>>({});
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<string, FlowTask[]>>({});

  const wanted = useMemo(() => {
    const values = new Set<string>();
    for (const value of monthValues) {
      if (value.startsWith("year-") || months.some(m => m.value === value)) values.add(value);
    }
    return Array.from(values);
  }, [months, monthValues]);

  const key = wanted.join("|");

  const load = useCallback(async () => {
    const list = key ? key.split("|") : [];
    const missing = list.filter(value => !cache.current[value]);
    if (missing.length > 0) setLoading(true);
    await Promise.all(
      missing.map(async value => {
        cache.current[value] = await fetchTasksForPeriod(value);
      }),
    );
    const next: Record<string, FlowTask[]> = {};
    for (const value of list) next[value] = cache.current[value] || [];
    setTasksByPeriod(next);
    setLoading(false);
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { tasksByPeriod, loading };
}
