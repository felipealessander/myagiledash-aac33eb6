import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MonthOption } from "@/hooks/useDashboardData";
import type { FlowTask } from "@/lib/flowMetrics";

const SELECT_COLUMNS =
  "task_code, title, category, squad, status, client, created_at_yt, started_at, resolved_at, tags, spent_minutes, interrupted_minutes";

async function fetchTasksForReport(reportId: string): Promise<FlowTask[]> {
  const out: FlowTask[] = [];
  const pageSize = 1000;
  let from = 0;
  // Paginate to bypass the 1000-row PostgREST limit
  while (true) {
    const { data, error } = await supabase
      .from("report_tasks")
      .select(SELECT_COLUMNS)
      .eq("report_id", reportId)
      .range(from, from + pageSize - 1);
    if (error) break;
    out.push(...((data || []) as FlowTask[]));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/**
 * Carrega as tarefas por mês (report), com cache, para alimentar os widgets de
 * fluxo com comparação entre períodos e histórico Sob Demanda.
 */
export function useFlowTasks(months: MonthOption[], monthValues: string[]) {
  const [tasksByPeriod, setTasksByPeriod] = useState<Record<string, FlowTask[]>>({});
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<string, FlowTask[]>>({});

  const wanted = useMemo(() => {
    const ids = new Map<string, string>();
    for (const value of monthValues) {
      const opt = months.find(m => m.value === value);
      if (opt) ids.set(value, opt.id);
    }
    return ids;
  }, [months, monthValues]);

  const load = useCallback(async () => {
    const missing = Array.from(wanted.entries()).filter(([value]) => !cache.current[value]);
    if (missing.length > 0) setLoading(true);
    await Promise.all(
      missing.map(async ([value, id]) => {
        cache.current[value] = await fetchTasksForReport(id);
      }),
    );
    const next: Record<string, FlowTask[]> = {};
    for (const value of wanted.keys()) next[value] = cache.current[value] || [];
    setTasksByPeriod(next);
    setLoading(false);
  }, [wanted]);

  useEffect(() => {
    load();
  }, [load]);

  return { tasksByPeriod, loading };
}
