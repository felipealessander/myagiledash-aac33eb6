import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface IncidentTask {
  task_code: string;
  title: string | null;
  category: string | null;
  squad: string | null;
  assignee: string | null;
  status: string | null;
  created_at_yt: string | null;
  resolved_at: string | null;
  started_at: string | null;
  tags: string[] | null;
  client: string | null;
  slo_date: string | null;
  promised_date: string | null;
  spent_minutes: number | null;
  report_id: string;
}

export type PeriodFilter = "3m" | "6m" | "1y";

function isIncident(task: IncidentTask): boolean {
  const cat = task.category?.toLowerCase() || "";
  const tags = (task.tags || []).map(t => t.toLowerCase());
  return cat === "incidente" || tags.includes("incidente") || tags.some(t => t.includes("deadletter"));
}

function isOpen(task: IncidentTask): boolean {
  const s = (task.status || "").toLowerCase().trim();
  return !s.includes("conclu") && !s.includes("done") && !s.includes("arquivado");
}

function getNextBusinessDays(count: number): Date[] {
  const days: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (days.length < count) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(d));
    }
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isWithinBusinessDays(dateStr: string, businessDays: Date[]): boolean {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const last = businessDays[businessDays.length - 1];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today && d <= last;
}

function isDueNextBusinessDay(dateStr: string, businessDays: Date[]): boolean {
  if (businessDays.length === 0) return false;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return isSameDay(d, businessDays[0]);
}

function isOverdue(dateStr: string): boolean {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

/**
 * Returns true if the task has a promised_date set to the current year or later,
 * meaning the SLO has already been addressed with a commitment date.
 */
function hasValidPromisedDate(task: IncidentTask): boolean {
  if (!task.promised_date) return false;
  const d = new Date(task.promised_date);
  if (isNaN(d.getTime())) return false;
  const currentYear = new Date().getFullYear();
  return d.getFullYear() >= currentYear;
}

/**
 * An SLO should only be counted as pending if there's no valid promised_date.
 * If promised_date is set (current year or later), the SLO is considered addressed.
 */
function isSloStillPending(task: IncidentTask): boolean {
  return !hasValidPromisedDate(task);
}

export interface IncidentsBySquad {
  squad: string;
  total: number;
  open: number;
  sloExpiring: IncidentTask[];
  promisedExpiring: IncidentTask[];
}

export interface IncidentTrend {
  month: string;
  label: string;
  created: number;
  resolved: number;
  open: number;
}

export function useIncidentsData() {
  const [allTasks, setAllTasks] = useState<IncidentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("3m");

  const fetchAllIncidents = useCallback(async () => {
    setLoading(true);

    const { data: reports } = await supabase
      .from("sprint_reports")
      .select("id, month, label")
      .order("month", { ascending: false });

    if (!reports || reports.length === 0) {
      setAllTasks([]);
      setLoading(false);
      return;
    }

    const all: IncidentTask[] = [];
    for (const r of reports) {
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("report_tasks")
          .select("task_code, title, category, squad, assignee, status, created_at_yt, resolved_at, started_at, tags, client, slo_date, promised_date, spent_minutes, report_id")
          .eq("report_id", r.id)
          .range(from, from + 999);
        if (error || !data) break;
        all.push(...(data as unknown as IncidentTask[]));
        if (data.length < 1000) break;
        from += 1000;
      }
    }

    setAllTasks(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllIncidents();
  }, [fetchAllIncidents]);

  const incidents = useMemo(() => allTasks.filter(isIncident), [allTasks]);

  const uniqueIncidents = useMemo(() => {
    const map = new Map<string, IncidentTask>();
    for (const t of incidents) {
      const existing = map.get(t.task_code);
      if (!existing) {
        map.set(t.task_code, t);
      }
    }
    return Array.from(map.values());
  }, [incidents]);

  const openIncidents = useMemo(() => uniqueIncidents.filter(isOpen), [uniqueIncidents]);

  const businessDays = useMemo(() => getNextBusinessDays(5), []);

  // SLO: only count if there's NO valid promised_date (current year or later)
  const sloExpiring = useMemo(() =>
    openIncidents.filter(t => t.slo_date && isSloStillPending(t) && isWithinBusinessDays(t.slo_date, businessDays))
      .sort((a, b) => new Date(a.slo_date!).getTime() - new Date(b.slo_date!).getTime()),
    [openIncidents, businessDays]
  );

  const sloOverdue = useMemo(() =>
    openIncidents.filter(t => t.slo_date && isSloStillPending(t) && isOverdue(t.slo_date))
      .sort((a, b) => new Date(a.slo_date!).getTime() - new Date(b.slo_date!).getTime()),
    [openIncidents]
  );

  // Promised: only show items with valid promised_date (current year or later)
  const promisedExpiring = useMemo(() =>
    openIncidents.filter(t => hasValidPromisedDate(t) && isWithinBusinessDays(t.promised_date!, businessDays))
      .sort((a, b) => new Date(a.promised_date!).getTime() - new Date(b.promised_date!).getTime()),
    [openIncidents, businessDays]
  );

  const promisedOverdue = useMemo(() =>
    openIncidents.filter(t => hasValidPromisedDate(t) && isOverdue(t.promised_date!))
      .sort((a, b) => new Date(a.promised_date!).getTime() - new Date(b.promised_date!).getTime()),
    [openIncidents]
  );

  const bySquad = useMemo((): IncidentsBySquad[] => {
    const squadMap = new Map<string, IncidentTask[]>();
    for (const t of uniqueIncidents) {
      const sq = t.squad || "Sem Squad";
      if (!squadMap.has(sq)) squadMap.set(sq, []);
      squadMap.get(sq)!.push(t);
    }
    return Array.from(squadMap.entries()).map(([squad, tasks]) => {
      const openTasks = tasks.filter(isOpen);
      return {
        squad,
        total: tasks.length,
        open: openTasks.length,
        sloExpiring: openTasks.filter(t => t.slo_date && isSloStillPending(t) && (isWithinBusinessDays(t.slo_date, businessDays) || isOverdue(t.slo_date))),
        promisedExpiring: openTasks.filter(t => hasValidPromisedDate(t) && (isWithinBusinessDays(t.promised_date!, businessDays) || isOverdue(t.promised_date!))),
      };
    }).sort((a, b) => b.open - a.open);
  }, [uniqueIncidents, businessDays]);

  const trend = useMemo((): IncidentTrend[] => {
    const now = new Date();
    const monthsBack = period === "3m" ? 3 : period === "6m" ? 6 : 12;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

    const monthMap = new Map<string, { created: number; resolved: number }>();

    for (const t of incidents) {
      if (t.created_at_yt) {
        const d = new Date(t.created_at_yt);
        if (d >= cutoff) {
          const key = t.created_at_yt.slice(0, 7);
          const entry = monthMap.get(key) || { created: 0, resolved: 0 };
          entry.created++;
          monthMap.set(key, entry);
        }
      }
      if (t.resolved_at) {
        const d = new Date(t.resolved_at);
        if (d >= cutoff) {
          const key = t.resolved_at.slice(0, 7);
          const entry = monthMap.get(key) || { created: 0, resolved: 0 };
          entry.resolved++;
          monthMap.set(key, entry);
        }
      }
    }

    const MONTHS_PT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    let running = 0;
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        running += data.created - data.resolved;
        const [y, m] = month.split("-");
        return {
          month,
          label: `${MONTHS_PT[parseInt(m)]}/${y.slice(2)}`,
          created: data.created,
          resolved: data.resolved,
          open: Math.max(0, running),
        };
      });
  }, [incidents, period]);

  return {
    loading,
    openIncidents,
    sloExpiring,
    sloOverdue,
    promisedExpiring,
    promisedOverdue,
    bySquad,
    trend,
    period,
    setPeriod,
    businessDays,
    totalIncidents: uniqueIncidents.length,
    isDueNextBusinessDay: (dateStr: string) => isDueNextBusinessDay(dateStr, businessDays),
    isOverdue,
    refetch: fetchAllIncidents,
  };
}
