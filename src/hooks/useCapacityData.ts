import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SQUAD_CAPACITY, computeCapacitySummaries, type SquadCapacitySummary } from "@/data/squadCapacity";

export interface CapacityMonthOption {
  value: string;
  label: string;
}

export function useCapacityData() {
  const [months, setMonths] = useState<CapacityMonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [hoursBySquad, setHoursBySquad] = useState<{ squad: string; estimated: number; spent: number }[]>([]);

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

  // Fetch hours by squad for selected month
  useEffect(() => {
    if (!selectedMonth) return;
    async function fetchHours() {
      setLoading(true);
      // Get report IDs for month
      const { data: reports } = await supabase
        .from("sprint_reports")
        .select("id")
        .eq("month", selectedMonth);

      if (!reports || reports.length === 0) {
        setHoursBySquad([]);
        setLoading(false);
        return;
      }

      const reportIds = reports.map((r) => r.id);
      const { data: tasks } = await supabase
        .from("report_tasks")
        .select("squad, estimated_minutes, spent_minutes, status")
        .in("report_id", reportIds);

      if (!tasks) {
        setHoursBySquad([]);
        setLoading(false);
        return;
      }

      // Aggregate by squad, exclude archived
      const map = new Map<string, { estimated: number; spent: number }>();
      for (const t of tasks) {
        const status = (t.status || "").toLowerCase();
        if (status.includes("arquivado")) continue;
        const sq = t.squad || "Sem Squad";
        const entry = map.get(sq) || { estimated: 0, spent: 0 };
        entry.estimated += (t.estimated_minutes || 0) / 60;
        entry.spent += (t.spent_minutes || 0) / 60;
        map.set(sq, entry);
      }

      setHoursBySquad(
        Array.from(map.entries()).map(([squad, data]) => ({ squad, ...data }))
      );
      setLoading(false);
    }
    fetchHours();
  }, [selectedMonth]);

  const summaries = useMemo<SquadCapacitySummary[]>(
    () => computeCapacitySummaries(SQUAD_CAPACITY, hoursBySquad),
    [hoursBySquad]
  );

  const totals = useMemo(() => {
    const t = {
      members: 0,
      fte: 0,
      theoretical: 0,
      productive: 0,
      estimated: 0,
      spent: 0,
    };
    for (const s of summaries) {
      t.members += s.totalMembers;
      t.fte += s.fteEquivalent;
      t.theoretical += s.theoreticalHours;
      t.productive += s.productiveHours;
      t.estimated += s.estimatedHours;
      t.spent += s.spentHours;
    }
    return {
      ...t,
      utilizationPct: t.productive > 0 ? parseFloat(((t.spent / t.productive) * 100).toFixed(1)) : 0,
      estimationPct: t.productive > 0 ? parseFloat(((t.estimated / t.productive) * 100).toFixed(1)) : 0,
    };
  }, [summaries]);

  return { months, selectedMonth, setSelectedMonth, summaries, totals, loading };
}
