import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SQUAD_CAPACITY, computeCapacitySummaries, getWorkingDaysInMonth, type SquadCapacitySummary } from "@/data/squadCapacity";

interface SquadHours { squad: string; estimated: number; spent: number; productSpent: number }
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

  let allTasks: { squad: string | null; estimated_minutes: number | null; spent_minutes: number | null; status: string | null; tags: string[] | null }[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("report_tasks")
      .select("squad, estimated_minutes, spent_minutes, status, tags")
      .in("report_id", reportIds)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    allTasks = allTasks.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const map = new Map<string, { estimated: number; spent: number; productSpent: number }>();
  for (const t of allTasks) {
    const status = (t.status || "").toLowerCase();
    if (status.includes("arquivado")) continue;
    const sq = t.squad || "Sem Squad";
    const entry = map.get(sq) || { estimated: 0, spent: 0, productSpent: 0 };
    const spent = (t.spent_minutes || 0) / 60;
    entry.estimated += (t.estimated_minutes || 0) / 60;
    entry.spent += spent;
    // Check if task has "Produto" tag (case-insensitive)
    const hasProduto = (t.tags || []).some(tag => tag.toLowerCase() === "produto");
    if (hasProduto) {
      entry.productSpent += spent;
    }
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
  const [avg3mWorkingDays, setAvg3mWorkingDays] = useState(22);

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

      // Calculate average working days for the 3 previous months
      const { data: prev3Reports } = await supabase
        .from("sprint_reports")
        .select("month")
        .in("month", prev3);
      const monthsWithData = new Set((prev3Reports || []).map((r) => r.month));
      const monthCount = monthsWithData.size || 1;

      const avgWd = monthCount > 0
        ? Array.from(monthsWithData).reduce((s, m) => s + getWorkingDaysInMonth(m), 0) / monthCount
        : 22;
      setAvg3mWorkingDays(Math.round(avgWd));

      const avgMap = new Map<string, { estimated: number; spent: number; productSpent: number }>();
      for (const h of prev3Data) {
        const entry = avgMap.get(h.squad) || { estimated: 0, spent: 0, productSpent: 0 };
        entry.estimated += h.estimated;
        entry.spent += h.spent;
        entry.productSpent += h.productSpent;
        avgMap.set(h.squad, entry);
      }
      setAvg3mBySquad(
        Array.from(avgMap.entries()).map(([squad, data]) => ({
          squad,
          estimated: data.estimated / monthCount,
          spent: data.spent / monthCount,
          productSpent: data.productSpent / monthCount,
        }))
      );

      setLoading(false);
    }
    fetchAll();
  }, [selectedMonth]);

  const workingDays = useMemo(
    () => selectedMonth ? getWorkingDaysInMonth(selectedMonth) : 22,
    [selectedMonth]
  );

  const summaries = useMemo<SquadCapacitySummary[]>(
    () => computeCapacitySummaries(SQUAD_CAPACITY, hoursBySquad, workingDays),
    [hoursBySquad, workingDays]
  );

  const avg3mSummaries = useMemo<SquadCapacitySummary[]>(
    () => computeCapacitySummaries(SQUAD_CAPACITY, avg3mBySquad, avg3mWorkingDays),
    [avg3mBySquad, avg3mWorkingDays]
  );

  const totals = useMemo(() => {
    const t = { members: 0, fte: 0, capacity: 0, estimated: 0, spent: 0, productSpent: 0 };
    for (const s of summaries) {
      t.members += s.totalMembers;
      t.fte += s.fteEquivalent;
      t.capacity += s.capacityHours;
      t.estimated += s.estimatedHours;
      t.spent += s.spentHours;
      t.productSpent += s.productSpentHours;
    }
    const deviation = t.spent - t.capacity;
    return {
      ...t,
      deviation,
      utilizationPct: t.capacity > 0 ? parseFloat(((t.spent / t.capacity) * 100).toFixed(1)) : 0,
      estimationPct: t.capacity > 0 ? parseFloat(((t.estimated / t.capacity) * 100).toFixed(1)) : 0,
      productPct: t.spent > 0 ? parseFloat(((t.productSpent / t.spent) * 100).toFixed(1)) : 0,
    };
  }, [summaries]);

  const avg3mTotals = useMemo(() => {
    const t = { spent: 0, estimated: 0, capacity: 0 };
    for (const s of avg3mSummaries) {
      t.spent += s.spentHours;
      t.estimated += s.estimatedHours;
      t.capacity += s.capacityHours;
    }
    return {
      ...t,
      utilizationPct: t.capacity > 0 ? parseFloat(((t.spent / t.capacity) * 100).toFixed(1)) : 0,
    };
  }, [avg3mSummaries]);

  return { months, selectedMonth, setSelectedMonth, summaries, avg3mSummaries, totals, avg3mTotals, loading, workingDays };
}
