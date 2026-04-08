import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SQUAD_CAPACITY, computeCapacitySummaries, HOURS_PER_MONTH, PRODUCTIVE_HOURS_PER_MONTH, type SquadCapacitySummary } from "@/data/squadCapacity";

export interface CapacityMonthOption {
  value: string;
  label: string;
}

interface SquadHours { squad: string; estimated: number; spent: number }

function getPrev3Months(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const result: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(y, m - 1 - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

async function fetchHoursForMonths(months: string[]): Promise<SquadHours[]> {
  if (months.length === 0) return [];

  const { data: reports } = await supabase
    .from("sprint_reports")
    .select("id, month")
    .in("month", months);

  if (!reports || reports.length === 0) return [];

  const reportIds = reports.map((r) => r.id);

  // Paginated fetch
  let allTasks: { squad: string | null; estimated_minutes: number | null; spent_minutes: number | null; status: string | null }[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("report_tasks")
      .select("squad, estimated_minutes, spent_minutes, status")
      .in("report_id", reportIds)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    allTasks = allTasks.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const map = new Map<string, { estimated: number; spent: number }>();
  for (const t of allTasks) {
    const status = (t.status || "").toLowerCase();
    if (status.includes("arquivado")) continue;
    const sq = t.squad || "Sem Squad";
    const entry = map.get(sq) || { estimated: 0, spent: 0 };
    entry.estimated += (t.estimated_minutes || 0) / 60;
    entry.spent += (t.spent_minutes || 0) / 60;
    map.set(sq, entry);
  }

  return Array.from(map.entries()).map(([squad, data]) => ({ squad, ...data }));
}

export function useCapacityData() {
  const [months, setMonths] = useState<CapacityMonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [hoursBySquad, setHoursBySquad] = useState<SquadHours[]>([]);
  const [avg3mBySquad, setAvg3mBySquad] = useState<SquadHours[]>([]);

  // Fetch available months
  useEffect(() => {
    async function fetchMonths() {
      const { data } = await supabase
        .from("sprint_reports")
        .select("month, label")
        .order("month", { ascending: false });

      if (data && data.length > 0) {
        const uniqueMonths = new Map<string, string>();
        for (const r of data) {
          if (!uniqueMonths.has(r.month)) {
            uniqueMonths.set(r.month, r.label || r.month);
          }
        }
        const opts = Array.from(uniqueMonths.entries()).map(([value, label]) => ({ value, label }));
        setMonths(opts);
        setSelectedMonth(opts[0].value);
      }
      setLoading(false);
    }
    fetchMonths();
  }, []);

  // Fetch hours for selected month + last 3 months average
  useEffect(() => {
    if (!selectedMonth) return;
    async function fetchAll() {
      setLoading(true);

      const prev3 = getPrev3Months(selectedMonth);

      const [current, prev3Data] = await Promise.all([
        fetchHoursForMonths([selectedMonth]),
        fetchHoursForMonths(prev3),
      ]);

      setHoursBySquad(current);

      // Average the prev3 data (divide by number of months that had data)
      // We need to know how many months actually had reports
      const { data: prev3Reports } = await supabase
        .from("sprint_reports")
        .select("month")
        .in("month", prev3);
      const monthsWithData = new Set((prev3Reports || []).map((r) => r.month)).size || 1;

      const avgMap = new Map<string, { estimated: number; spent: number }>();
      for (const h of prev3Data) {
        const entry = avgMap.get(h.squad) || { estimated: 0, spent: 0 };
        entry.estimated += h.estimated;
        entry.spent += h.spent;
        avgMap.set(h.squad, entry);
      }
      setAvg3mBySquad(
        Array.from(avgMap.entries()).map(([squad, data]) => ({
          squad,
          estimated: data.estimated / monthsWithData,
          spent: data.spent / monthsWithData,
        }))
      );

      setLoading(false);
    }
    fetchAll();
  }, [selectedMonth]);

  const summaries = useMemo<SquadCapacitySummary[]>(
    () => computeCapacitySummaries(SQUAD_CAPACITY, hoursBySquad),
    [hoursBySquad]
  );

  const avg3mSummaries = useMemo<SquadCapacitySummary[]>(
    () => computeCapacitySummaries(SQUAD_CAPACITY, avg3mBySquad),
    [avg3mBySquad]
  );

  const totals = useMemo(() => {
    const t = { members: 0, fte: 0, theoretical: 0, productive: 0, estimated: 0, spent: 0 };
    for (const s of summaries) {
      t.members += s.totalMembers;
      t.fte += s.fteEquivalent;
      t.theoretical += s.theoreticalHours;
      t.productive += s.productiveHours;
      t.estimated += s.estimatedHours;
      t.spent += s.spentHours;
    }
    const deviation = t.productive > 0 ? t.spent - t.productive : 0;
    return {
      ...t,
      deviation,
      utilizationPct: t.productive > 0 ? parseFloat(((t.spent / t.productive) * 100).toFixed(1)) : 0,
      estimationPct: t.productive > 0 ? parseFloat(((t.estimated / t.productive) * 100).toFixed(1)) : 0,
    };
  }, [summaries]);

  const avg3mTotals = useMemo(() => {
    const t = { spent: 0, estimated: 0, productive: 0 };
    for (const s of avg3mSummaries) {
      t.spent += s.spentHours;
      t.estimated += s.estimatedHours;
      t.productive += s.productiveHours;
    }
    return {
      ...t,
      utilizationPct: t.productive > 0 ? parseFloat(((t.spent / t.productive) * 100).toFixed(1)) : 0,
    };
  }, [avg3mSummaries]);

  return { months, selectedMonth, setSelectedMonth, summaries, avg3mSummaries, totals, avg3mTotals, loading };
}
