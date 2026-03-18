import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MonthOption } from "@/hooks/useDashboardData";

interface DevMetric {
  name: string;
  totalTasks: number;
  completedTasks: number;
  spentHours: number;
  estimatedHours: number;
  reworkCount: number;
  reworkRate: number;
}

export function useIndividualData(selectedMonth: string, months: MonthOption[]) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (months.length === 0) return;

    const fetchTasks = async () => {
      setLoading(true);

      let reportIds: string[] = [];

      if (selectedMonth.startsWith("year-")) {
        const year = selectedMonth.replace("year-", "");
        reportIds = months.filter(m => m.value.startsWith(year)).map(m => m.id);
      } else {
        const found = months.find(m => m.value === selectedMonth);
        if (found) reportIds = [found.id];
      }

      if (reportIds.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("report_tasks")
        .select("assignee, status, spent_minutes, estimated_minutes, qa_returns, corrections_count")
        .in("report_id", reportIds);

      setLoading(false);
      if (error) {
        console.error("Error loading individual data:", error);
        return;
      }
      setTasks(data || []);
    };

    fetchTasks();
  }, [selectedMonth, months]);

  const allDevNames = useMemo(() => {
    const names = new Set<string>();
    for (const t of tasks) {
      if (t.assignee) names.add(t.assignee);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const devMetrics: DevMetric[] = useMemo(() => {
    const byDev = new Map<string, any[]>();

    for (const t of tasks) {
      const name = t.assignee || "Não atribuído";
      if (!byDev.has(name)) byDev.set(name, []);
      byDev.get(name)!.push(t);
    }

    return Array.from(byDev.entries())
      .map(([name, devTasks]) => {
        const completedTasks = devTasks.filter(t => {
          const s = (t.status || "").toLowerCase();
          return s.includes("done") || s.includes("resolved") || s.includes("closed") || s.includes("conclu");
        }).length;

        const spentHours = devTasks.reduce((s: number, t: any) => s + (t.spent_minutes || 0) / 60, 0);
        const estimatedHours = devTasks.reduce((s: number, t: any) => s + (t.estimated_minutes || 0) / 60, 0);

        const reworkTasks = devTasks.filter((t: any) => (t.qa_returns || 0) > 0 || (t.corrections_count || 0) > 0);
        const reworkCount = reworkTasks.length;
        const reworkRate = devTasks.length > 0 ? (reworkCount / devTasks.length) * 100 : 0;

        return {
          name,
          totalTasks: devTasks.length,
          completedTasks,
          spentHours,
          estimatedHours,
          reworkCount,
          reworkRate,
        };
      })
      .sort((a, b) => b.spentHours - a.spentHours);
  }, [tasks]);

  return { devMetrics, allDevNames, loading };
}
