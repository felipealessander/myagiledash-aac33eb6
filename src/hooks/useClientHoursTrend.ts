import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeClientUsage, type TaskLite, type MonthlyHoursLite } from "@/lib/clientUsage";
import type { Client, ClientMonthlyHours } from "./useClientsData";

export interface MonthlyClientPoint {
  month: string; // YYYY-MM
  contracted: number;
  spent: number;
  utilizationPct: number; // aggregate
  perClient: Record<string, { contracted: number; spent: number; utilizationPct: number }>;
}

async function fetchTasksForMonth(month: string): Promise<TaskLite[]> {
  const [yyyy, mm] = month.split("-").map(Number);
  const start = new Date(Date.UTC(yyyy, mm - 1, 1)).toISOString();
  const end = new Date(Date.UTC(yyyy, mm, 1)).toISOString();
  const PAGE = 1000;
  const all: TaskLite[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("report_tasks")
      .select("client, spent_minutes, status, resolved_at, created_at_yt")
      .not("client", "is", null)
      .or(
        `and(resolved_at.gte.${start},resolved_at.lt.${end}),` +
        `and(resolved_at.is.null,created_at_yt.gte.${start},created_at_yt.lt.${end})`
      )
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error || !data) break;
    all.push(...(data as TaskLite[]));
    if (data.length < PAGE) break;
  }
  return all;
}

/** Return the last N months (YYYY-MM) ending at `endMonth` inclusive, oldest first. */
export function lastNMonths(endMonth: string, n: number): string[] {
  const [y, m] = endMonth.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function useClientHoursTrend(endMonth: string | null, windowSize = 3) {
  const [points, setPoints] = useState<MonthlyClientPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!endMonth || endMonth === "static" || endMonth.startsWith("year-")) {
      setPoints([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const months = lastNMonths(endMonth, windowSize);
      const [c, h] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("client_monthly_hours").select("*"),
      ]);
      const clients = (c.data || []) as Client[];
      const hours = (h.data || []) as ClientMonthlyHours[];

      const tasksPerMonth = await Promise.all(months.map(fetchTasksForMonth));

      const result: MonthlyClientPoint[] = months.map((month, idx) => {
        const { usage } = computeClientUsage(month, clients, tasksPerMonth[idx], hours as MonthlyHoursLite[]);
        const perClient: Record<string, { contracted: number; spent: number; utilizationPct: number }> = {};
        let contracted = 0;
        let spent = 0;
        for (const u of usage) {
          if (u.contractedHours === 0 && u.spentHours === 0) continue;
          perClient[u.clientName] = {
            contracted: u.contractedHours,
            spent: u.spentHours,
            utilizationPct: u.utilizationPct,
          };
          contracted += u.contractedHours;
          spent += u.spentHours;
        }
        return {
          month,
          contracted: Math.round(contracted),
          spent: Math.round(spent),
          utilizationPct: contracted > 0 ? Math.round((spent / contracted) * 1000) / 10 : 0,
          perClient,
        };
      });

      if (!cancelled) {
        setPoints(result);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [endMonth, windowSize]);

  return { points, loading };
}
