import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safeError";
import type { TeamData, CategoryName, BillingData, BillingStatus } from "@/data/dashboardData";
import { getTeamColor } from "@/data/dashboardData";
import * as staticData from "@/data/dashboardData";

export interface MonthOption {
  value: string;
  label: string;
  id: string;
}

interface DBTask {
  task_code: string;
  title: string | null;
  category: string | null;
  billing_status: string | null;
  estimated_minutes: number | null;
  spent_minutes: number | null;
  squad: string | null;
  assignee: string | null;
  status: string | null;
  created_at_yt: string | null;
  resolved_at: string | null;
  started_at: string | null;
  tags: string[] | null;
  corrections_count: number | null;
  qa_returns: number | null;
  interrupted_minutes: number | null;
  client: string | null;
}

// Fallback hardcoded members for static data only
const SQUAD_MEMBERS_STATIC: Record<string, string[]> = {
  "NaN": ["Felipe Souza", "Ana Clara", "Lucas Martins", "Juliana Costa", "Pedro Henrique", "Mariana Lima"],
  "Golden Gate": ["Rafael Oliveira", "Camila Santos", "Bruno Almeida", "Fernanda Rocha", "Thiago Pereira"],
  "Code418": ["Diego Silva", "Isabela Ferreira", "Gustavo Ribeiro", "Larissa Mendes", "Vinícius Cardoso"],
  "Tesseract": ["André Nascimento", "Beatriz Araújo", "Carlos Eduardo", "Daniela Moreira", "Eduardo Campos", "Gabriela Teixeira"],
  "Code402": ["Marcos Vieira", "Patrícia Lopes", "Roberto Dias"],
  "JRE": ["Henrique Barros", "Tatiana Fonseca", "Leonardo Pinto", "Renata Campos"],
  "TheBigBang": ["João Victor", "Amanda Nunes", "Caio Rezende"],
};

// Helper: check if a task status is "archived" (should be excluded from all metrics)
function isArchived(status: string | null): boolean {
  return (status || '').toLowerCase().trim().includes('arquivado');
}

// Helper: check if a task status is "done" (delivered)
function isDoneStatus(status: string | null): boolean {
  const s = (status || '').toLowerCase().trim();
  return s.includes('conclu') || s.includes('done') || s.includes('delivery');
}

function buildDashboardData(rawTasks: DBTask[], selectedMonth?: string) {
  // Exclude archived tasks from ALL calculations
  const tasks = rawTasks.filter(t => !isArchived(t.status));

  const squadTasksMap = new Map<string, DBTask[]>();

  for (const task of tasks) {
    const squadName = task.squad || "Sem Squad";
    if (!squadTasksMap.has(squadName)) {
      squadTasksMap.set(squadName, []);
    }
    squadTasksMap.get(squadName)!.push(task);
  }

  // Build team data from squads
  const squadNames = Array.from(squadTasksMap.keys()).sort();
  const teams: TeamData[] = squadNames.map((name, index) => {
    const tTasks = squadTasksMap.get(name)!;
    const categoryMap = new Map<string, { spentHours: number; estimatedHours: number; taskCount: number }>();

    for (const t of tTasks) {
      // If task has DeadLetter tag, override category to "DeadLetter"
      const hasDeadLetter = (t.tags || []).some(tag => tag.toLowerCase().includes('deadletter'));
      const cat = hasDeadLetter ? "DeadLetter" : (t.category || "Tarefa");
      const entry = categoryMap.get(cat) || { spentHours: 0, estimatedHours: 0, taskCount: 0 };
      entry.spentHours += (t.spent_minutes || 0) / 60;
      entry.estimatedHours += (t.estimated_minutes || 0) / 60;
      entry.taskCount += 1;
      categoryMap.set(cat, entry);
    }

    const categories = Array.from(categoryMap.entries()).map(([catName, data]) => ({
      name: catName as CategoryName,
      ...data,
    }));

    // Known team members override
    const TEAM_MEMBERS: Record<string, string[]> = {
      "Golden Gate": ["Renan", "João Ostrovski", "José Vitor", "João Griebner", "Lucas Ramos", "Alexandre (cross)", "Sávio (cross)", "Breno (cross)"],
      "Tesseract": ["Guilherme", "Carol Schlickmann", "Davi Santos", "João Neres", "Mauricio Verona", "Alexandre (cross)", "Sávio (cross)", "Roberto (cross)"],
      "Code418": ["Jhennyfer", "Michelle Victoriano", "Raphael Maia", "Tais Marcolino", "Anderson Nóbrega", "Alexandre (cross)", "Tássio (cross)"],
      "JRE": ["Carlos Melo", "Kauan Mello", "Gustavo Rezin", "Felipe Mendes (cross)", "Wendell (cross)", "Pedro (cross)"],
      "TheBigBang": ["Carlos Melo", "Gabriel Lopes", "Sthefanie", "Sheila", "Jaison (cross)", "Wendell (cross)", "Pedro (cross)"],
      "TheBigBang-Cobrança": ["Ronaldo", "Kauan Paiva", "Nicolas", "Douglas Sheibler", "Felipe Mendes (cross)", "Tássio (cross)", "Henrique (cross)"],
      "Code402": ["Eduarda", "João Marcelo", "Marcos Ghizo", "Felipe Mendes (cross)", "Wendell (cross)", "Henrique (cross)"],
    };

    const memberNames = TEAM_MEMBERS[name] || [];

    return {
      name,
      color: getTeamColor(index),
      members: memberNames.length || 1,
      memberNames,
      categories,
    };
  });

  // Category totals
  const catMap = new Map<string, { hours: number; count: number }>();
  for (const t of tasks) {
    const hasDeadLetter = (t.tags || []).some(tag => tag.toLowerCase().includes('deadletter'));
    const cat = hasDeadLetter ? "DeadLetter" : (t.category || "Tarefa");
    const entry = catMap.get(cat) || { hours: 0, count: 0 };
    entry.hours += (t.spent_minutes || 0) / 60;
    entry.count += 1;
    catMap.set(cat, entry);
  }
  const categoryTotals = Array.from(catMap.entries()).map(([name, data]) => ({
    name: name as CategoryName,
    ...data,
  }));

  // Billing data
  const billMap = new Map<string, { estimatedHours: number; spentHours: number; taskCount: number }>();

  function normalizeBillingStatus(raw: string | null): string {
    if (!raw) return "Nenhum Faturável";
    const lower = raw.toLowerCase().trim();
    if (lower === "sim") return "Faturável";
    if (lower === "não" || lower === "nao") return "Não Faturável";
    if (lower.includes("não fatur") || lower.includes("nao fatur")) return "Não Faturável";
    if (lower.includes("nenhum")) return "Nenhum Faturável";
    if (lower.includes("fatur")) return "Faturável";
    return "Nenhum Faturável";
  }

  for (const t of tasks) {
    const status = normalizeBillingStatus(t.billing_status);
    const entry = billMap.get(status) || { estimatedHours: 0, spentHours: 0, taskCount: 0 };
    entry.spentHours += (t.spent_minutes || 0) / 60;
    entry.estimatedHours += (t.estimated_minutes || 0) / 60;
    entry.taskCount += 1;
    billMap.set(status, entry);
  }

  const billingLabelMap: Record<string, { label: string; description: string; color: string }> = {
    "Faturável": { label: "Faturável", description: "Atividades marcadas como faturáveis ao cliente", color: "hsl(var(--primary))" },
    "Não Faturável": { label: "Não Faturável", description: "Atividades explicitamente marcadas como não faturáveis", color: "hsl(var(--warning))" },
    "Nenhum Faturável": { label: "Sem Marcação", description: "A opção de 'Faturável' não foi preenchida na tarefa", color: "hsl(var(--muted-foreground))" },
  };

  const billingData: BillingData[] = ["Faturável", "Não Faturável", "Nenhum Faturável"].map(status => {
    const data = billMap.get(status) || { estimatedHours: 0, spentHours: 0, taskCount: 0 };
    const meta = billingLabelMap[status];
    return {
      status: status as BillingStatus,
      ...meta,
      ...data,
    };
  });

  const totalSpent = tasks.reduce((s, t) => s + (t.spent_minutes || 0) / 60, 0);
  const totalEstimated = tasks.reduce((s, t) => s + (t.estimated_minutes || 0) / 60, 0);
  const totalTasks = tasks.length;

  const billingTotalSpent = billingData.reduce((s, b) => s + b.spentHours, 0);
  const billingTotalEstimated = billingData.reduce((s, b) => s + b.estimatedHours, 0);
  const billingTotalTasks = billingData.reduce((s, b) => s + b.taskCount, 0);

  // Helper: check if resolved_at falls within the selected month period
  const isResolvedInPeriod = (resolvedAt: string): boolean => {
    if (!selectedMonth) return true;
    const resolved = resolvedAt.slice(0, 7); // "YYYY-MM"
    if (selectedMonth.startsWith("year-")) {
      return resolved.startsWith(selectedMonth.replace("year-", ""));
    }
    return resolved === selectedMonth;
  };

  // Agile metrics - Lead Time: created_at_yt -> resolved_at, descontando tempo em "Interrompido"
  // Exclude "Qualidade" squad from agile metrics as their workflow differs significantly
  const isQualidadeSquad = (t: DBTask) => (t.squad || '').toLowerCase().trim() === 'qualidade';
  const interruptedDays = (t: DBTask) => Math.max(0, (t.interrupted_minutes || 0) / (60 * 24));
  const resolvedTasks = tasks.filter(t => t.created_at_yt && t.resolved_at && t.category !== "Épico" && !isQualidadeSquad(t) && isResolvedInPeriod(t.resolved_at!));
  const leadTimes = resolvedTasks.map(t => {
    const created = new Date(t.created_at_yt!).getTime();
    const resolved = new Date(t.resolved_at!).getTime();
    const raw = (resolved - created) / (1000 * 60 * 60 * 24);
    return Math.max(0, raw - interruptedDays(t));
  });

  // Lead time by squad
  const leadTimeBySquad: { squad: string; avg: number; median: number; p85: number; count: number }[] = [];
  for (const squadName of squadNames) {
    const squadResolved = resolvedTasks.filter(t => (t.squad || "Sem Squad") === squadName);
    if (squadResolved.length === 0) {
      leadTimeBySquad.push({ squad: squadName, avg: 0, median: 0, p85: 0, count: 0 });
      continue;
    }
    const times = squadResolved.map(t => {
      const c = new Date(t.created_at_yt!).getTime();
      const r = new Date(t.resolved_at!).getTime();
      return Math.max(0, (r - c) / (1000 * 60 * 60 * 24) - interruptedDays(t));
    }).sort((a, b) => a - b);
    const avg = times.reduce((s, v) => s + v, 0) / times.length;
    const median = times[Math.floor(times.length / 2)];
    const p85 = times[Math.floor(times.length * 0.85)];
    leadTimeBySquad.push({ squad: squadName, avg: Math.round(avg * 10) / 10, median: Math.round(median * 10) / 10, p85: Math.round(p85 * 10) / 10, count: squadResolved.length });
  }

  // Cycle Time by squad (started_at -> resolved_at, descontando tempo em "Interrompido")
  const cycleTimeTasks = tasks.filter(t => t.started_at && t.resolved_at && t.category !== "Épico" && !isQualidadeSquad(t) && isResolvedInPeriod(t.resolved_at!));
  const cycleTimeBySquad: { squad: string; avg: number; median: number; p85: number; count: number }[] = [];
  for (const squadName of squadNames) {
    const squadCycle = cycleTimeTasks.filter(t => (t.squad || "Sem Squad") === squadName);
    if (squadCycle.length === 0) {
      cycleTimeBySquad.push({ squad: squadName, avg: 0, median: 0, p85: 0, count: 0 });
      continue;
    }
    const times = squadCycle.map(t => {
      const started = new Date(t.started_at!).getTime();
      const resolved = new Date(t.resolved_at!).getTime();
      return Math.max(0, (resolved - started) / (1000 * 60 * 60 * 24) - interruptedDays(t));
    }).sort((a, b) => a - b);
    const avg = times.reduce((s, v) => s + v, 0) / times.length;
    const median = times[Math.floor(times.length / 2)];
    const p85 = times[Math.floor(times.length * 0.85)];
    cycleTimeBySquad.push({ squad: squadName, avg: Math.round(avg * 10) / 10, median: Math.round(median * 10) / 10, p85: Math.round(p85 * 10) / 10, count: squadCycle.length });
  }

  // Throughput by week
  const throughputByWeek: { week: string; count: number }[] = [];
  const resolvedByWeek = new Map<string, number>();
  for (const t of resolvedTasks) {
    const d = new Date(t.resolved_at!);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    resolvedByWeek.set(key, (resolvedByWeek.get(key) || 0) + 1);
  }
  Array.from(resolvedByWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([week, count]) => throughputByWeek.push({ week, count }));

  // WIP: tasks with status not done/delivered (exclude Qualidade squad)
  const wipBySquad: { squad: string; wip: number }[] = squadNames.filter(n => n.toLowerCase() !== 'qualidade').map(name => {
    const squadTasks = squadTasksMap.get(name) || [];
    const openTasks = squadTasks.filter(t => !isDoneStatus(t.status));
    return { squad: name, wip: openTasks.length };
  });

  // Rework metrics (qa_returns > 0 OR corrections_count > 0)
  const reworkTasks = tasks.filter(t => (t.qa_returns || 0) > 0 || (t.corrections_count || 0) > 0);
  const reworkCount = reworkTasks.length;
  const reworkTotalCorrections = reworkTasks.reduce((s, t) => s + Math.max(t.qa_returns || 0, t.corrections_count || 0), 0);
  const reworkRate = totalTasks > 0 ? Math.round((reworkCount / totalTasks) * 100 * 10) / 10 : 0;

  const reworkBySquad: { squad: string; count: number; corrections: number; rate: number }[] = squadNames.map(name => {
    const squadTasks = squadTasksMap.get(name) || [];
    const squadRework = squadTasks.filter(t => (t.qa_returns || 0) > 0 || (t.corrections_count || 0) > 0);
    return {
      squad: name,
      count: squadRework.length,
      corrections: squadRework.reduce((s, t) => s + Math.max(t.qa_returns || 0, t.corrections_count || 0), 0),
      rate: squadTasks.length > 0 ? Math.round((squadRework.length / squadTasks.length) * 100 * 10) / 10 : 0,
    };
  });

  // Incidents created in the selected month (by created_at_yt)
  const incidentsCreatedInMonth = tasks.filter(t => {
    const cat = (t.tags || []).some(tag => tag.toLowerCase().includes('deadletter')) ? "DeadLetter" : (t.category || "Tarefa");
    if (cat !== "Incidente") return false;
    if (!t.created_at_yt || !selectedMonth) return false;
    const created = t.created_at_yt.slice(0, 7); // "YYYY-MM"
    if (selectedMonth.startsWith("year-")) {
      return created.startsWith(selectedMonth.replace("year-", ""));
    }
    return created === selectedMonth;
  }).length;

  // Incidents by client
  const incidentsByClient: { client: string; count: number }[] = [];
  const clientIncidentMap = new Map<string, number>();
  for (const t of tasks) {
    const hasDeadLetter = (t.tags || []).some(tag => tag.toLowerCase().includes('deadletter'));
    const cat = hasDeadLetter ? "DeadLetter" : (t.category || "Tarefa");
    if (cat !== "Incidente") continue;
    const clientName = t.client || "Sem Cliente";
    clientIncidentMap.set(clientName, (clientIncidentMap.get(clientName) || 0) + 1);
  }
  Array.from(clientIncidentMap.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([client, count]) => incidentsByClient.push({ client, count }));

  return {
    teams,
    categoryTotals,
    billingData,
    totalSpent,
    totalEstimated,
    totalTasks,
    billingTotalSpent,
    billingTotalEstimated,
    billingTotalTasks,
    leadTimeBySquad,
    cycleTimeBySquad,
    throughputByWeek,
    wipBySquad,
    reworkCount,
    reworkTotalCorrections,
    reworkRate,
    reworkBySquad,
    incidentsCreatedInMonth,
    incidentsByClient,
  };
}

export type DashboardData = ReturnType<typeof buildDashboardData>;

export interface SquadAgilePoint {
  squad: string;
  median: number;
  p85: number;
  count: number;
}

export interface MonthlyTrendPoint {
  month: string;
  label: string;
  totalTasks: number;
  totalSpentHours: number;
  totalEstimatedHours: number;
  incidentes: number;
  melhorias: number;
  deadLetters: number;
  tarefas: number;
  bugs: number;
  epicos: number;
  outros: number;
  reworkRate: number;
  leadTimeAvg: number;
  cycleTimeAvg: number;
  leadTimeMedianGlobal: number;
  cycleTimeMedianGlobal: number;
  leadTimeP85Global: number;
  cycleTimeP85Global: number;
  leadTimeBySquad: SquadAgilePoint[];
  cycleTimeBySquad: SquadAgilePoint[];
  throughput: number;
  // CFD cumulative fields
  cfdBacklog: number;
  cfdDev: number;
  cfdQA: number;
  cfdDone: number;
}

function buildMonthlyTrend(rawTasks: DBTask[], months: MonthOption[]): MonthlyTrendPoint[] {
  // Exclude archived tasks from trend calculations
  const tasks = rawTasks.filter(t => !isArchived(t.status));

  const tasksByReportId = new Map<string, DBTask[]>();
  for (const t of tasks) {
    const rid = (t as any).report_id as string;
    if (!rid) continue;
    if (!tasksByReportId.has(rid)) tasksByReportId.set(rid, []);
    tasksByReportId.get(rid)!.push(t);
  }

  const result = months
    .slice()
    .sort((a, b) => a.value.localeCompare(b.value))
    .map(m => {
      const mTasks = tasksByReportId.get(m.id) || [];
      const totalTasks = mTasks.length;
      const totalSpentHours = mTasks.reduce((s, t) => s + (t.spent_minutes || 0) / 60, 0);
      const totalEstimatedHours = mTasks.reduce((s, t) => s + (t.estimated_minutes || 0) / 60, 0);

      let incidentes = 0, melhorias = 0, deadLetters = 0, tarefas = 0, bugs = 0, epicos = 0, outros = 0;
      for (const t of mTasks) {
        const hasDL = (t.tags || []).some(tag => tag.toLowerCase().includes('deadletter'));
        const cat = hasDL ? "DeadLetter" : (t.category || "Tarefa");
        if (cat === "Incidente") incidentes++;
        else if (cat === "Melhoria") melhorias++;
        else if (cat === "DeadLetter") deadLetters++;
        else if (cat === "Tarefa") tarefas++;
        else if (cat === "Bug") bugs++;
        else if (cat === "Épico") epicos++;
        else outros++;
      }

      const reworkCount = mTasks.filter(t => (t.qa_returns || 0) > 0 || (t.corrections_count || 0) > 0).length;
      const reworkRate = totalTasks > 0 ? Math.round((reworkCount / totalTasks) * 1000) / 10 : 0;

      // Only count tasks resolved within THIS month for lead/cycle time
      const isResolvedInThisMonth = (ra: string) => ra.slice(0, 7) === m.value;
      // Exclude Qualidade squad from agile metrics in trend
      const isQualidade = (t: DBTask) => (t.squad || '').toLowerCase().trim() === 'qualidade';
      const interruptedDaysT = (t: DBTask) => Math.max(0, (t.interrupted_minutes || 0) / (60 * 24));
      const resolved = mTasks.filter(t => t.created_at_yt && t.resolved_at && t.category !== "Épico" && !isQualidade(t) && isResolvedInThisMonth(t.resolved_at!));
      const leadTimes = resolved.map(t => Math.max(0, (new Date(t.resolved_at!).getTime() - new Date(t.created_at_yt!).getTime()) / 86400000 - interruptedDaysT(t)));
      const leadTimeAvg = leadTimes.length > 0 ? Math.round((leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) * 10) / 10 : 0;

      const cycled = mTasks.filter(t => t.started_at && t.resolved_at && t.category !== "Épico" && !isQualidade(t) && isResolvedInThisMonth(t.resolved_at!));
      const cycleTimes = cycled.map(t => Math.max(0, (new Date(t.resolved_at!).getTime() - new Date(t.started_at!).getTime()) / 86400000 - interruptedDaysT(t)));
      const cycleTimeAvg = cycleTimes.length > 0 ? Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10 : 0;

      // Stats helpers
      const pct = (arr: number[], p: number) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
        return Math.round(sorted[idx] * 10) / 10;
      };
      const leadTimeMedianGlobal = pct(leadTimes, 0.5);
      const leadTimeP85Global = pct(leadTimes, 0.85);
      const cycleTimeMedianGlobal = pct(cycleTimes, 0.5);
      const cycleTimeP85Global = pct(cycleTimes, 0.85);

      // Per-squad lead/cycle stats
      const groupBySquad = (items: { squad: string | null; v: number }[]) => {
        const m = new Map<string, number[]>();
        for (const it of items) {
          const sq = it.squad || "Sem Squad";
          if (!m.has(sq)) m.set(sq, []);
          m.get(sq)!.push(it.v);
        }
        return Array.from(m.entries()).map(([squad, vs]) => ({
          squad,
          median: pct(vs, 0.5),
          p85: pct(vs, 0.85),
          count: vs.length,
        }));
      };
      const leadTimeBySquad = groupBySquad(resolved.map((t, i) => ({ squad: t.squad, v: leadTimes[i] })));
      const cycleTimeBySquad = groupBySquad(cycled.map((t, i) => ({ squad: t.squad, v: cycleTimes[i] })));

      // Throughput: count tasks with done status (aligned with CFD definition)
      const throughput = mTasks.filter(t => isDoneStatus(t.status)).length;

      // CFD status grouping (3 Kanban phases — archived already excluded)
      const doneStatuses = ['concluida', 'delivery'];
      const qaStatuses = ['teste qa', 'teste dev', 'homologação', 'homologacao', 'validação', 'code review', 'aguardando merge'];
      const devStatuses = ['em desenvolvimento', 'em discovery', 'estudo'];
      let cfdDone = 0, cfdQA = 0, cfdDev = 0, cfdBacklog = 0;
      for (const t of mTasks) {
        const s = (t.status || '').toLowerCase().trim();
        if (doneStatuses.some(ds => s.includes(ds))) cfdDone++;
        else if (qaStatuses.some(qs => s.includes(qs))) cfdQA++;
        else if (devStatuses.some(ds => s.includes(ds))) cfdDev++;
        else cfdBacklog++;
      }

      return {
        month: m.value,
        label: m.label,
        totalTasks,
        totalSpentHours: Math.round(totalSpentHours),
        totalEstimatedHours: Math.round(totalEstimatedHours),
        incidentes, melhorias, deadLetters, tarefas, bugs, epicos, outros,
        reworkRate,
        leadTimeAvg,
        cycleTimeAvg,
        leadTimeMedianGlobal,
        cycleTimeMedianGlobal,
        leadTimeP85Global,
        cycleTimeP85Global,
        leadTimeBySquad,
        cycleTimeBySquad,
        throughput,
        cfdBacklog, cfdDev, cfdQA, cfdDone,
      };
    });

  // CFD must be cumulative (market standard)
  let cumBacklog = 0, cumDev = 0, cumQA = 0, cumDone = 0;
  for (const point of result) {
    cumBacklog += point.cfdBacklog;
    cumDev += point.cfdDev;
    cumQA += point.cfdQA;
    cumDone += point.cfdDone;
    point.cfdBacklog = cumBacklog;
    point.cfdDev = cumDev;
    point.cfdQA = cumQA;
    point.cfdDone = cumDone;
  }

  return result;
}

export function useDashboardData() {
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("year-2026");
  const [dbTasks, setDbTasks] = useState<DBTask[] | null>(null);
  const [dbTasksForTrend, setDbTasksForTrend] = useState<DBTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchMonths = useCallback(async () => {
    const { data, error } = await supabase
      .from("sprint_reports")
      .select("id, month, label")
      .order("month", { ascending: false });

    if (error) {
      console.error("Error loading months:", error);
      return;
    }

    const options: MonthOption[] = (data || []).map(r => ({
      value: r.month,
      label: r.label || r.month,
      id: r.id,
    }));

    setMonths(options);
  }, []);

  useEffect(() => {
    fetchMonths();
  }, [fetchMonths]);

  useEffect(() => {
    // Year consolidation: load tasks from ALL reports of that year
    if (selectedMonth.startsWith("year-")) {
      const year = selectedMonth.replace("year-", "");
      const yearMonths = months.filter(m => m.value.startsWith(year));
      if (yearMonths.length === 0) {
        setDbTasks([]);
        return;
      }

      setLoading(true);
      const reportIds = yearMonths.map(m => m.id);
      // Fetch all tasks across all months - paginate to avoid 1000-row limit
      const fetchAllYearTasks = async () => {
        const allTasks: any[] = [];
        for (const rid of reportIds) {
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const { data, error } = await supabase
              .from("report_tasks")
              .select("report_id, task_code, title, category, billing_status, estimated_minutes, spent_minutes, squad, assignee, status, created_at_yt, resolved_at, started_at, tags, corrections_count, qa_returns, interrupted_minutes, client")
              .eq("report_id", rid)
              .range(from, from + pageSize - 1);
            if (error) {
              console.error("Error loading year tasks:", error);
              toast({ title: "Erro ao carregar dados", description: getSafeErrorMessage(error), variant: "destructive" });
              setLoading(false);
              return;
            }
            allTasks.push(...(data || []));
            if (!data || data.length < pageSize) break;
            from += pageSize;
          }
        }
        setDbTasks(allTasks);
        setDbTasksForTrend(allTasks);
        setLoading(false);
      };
      fetchAllYearTasks();
      return;
    }

    const monthOption = months.find(m => m.value === selectedMonth);
    if (!monthOption) {
      setDbTasks(null);
      return;
    }

    setLoading(true);
    supabase
      .from("report_tasks")
      .select("task_code, title, category, billing_status, estimated_minutes, spent_minutes, squad, assignee, status, created_at_yt, resolved_at, started_at, tags, corrections_count, qa_returns, interrupted_minutes, client")
      .eq("report_id", monthOption.id)
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          console.error("Error loading tasks:", error);
          toast({ title: "Erro ao carregar dados", description: getSafeErrorMessage(error), variant: "destructive" });
          return;
        }
        setDbTasks(data || []);
      });

    // Also load all year tasks for the trend chart
    const year = selectedMonth.slice(0, 4);
    const yearMonths = months.filter(m => m.value.startsWith(year));
    const yearReportIds = yearMonths.map(m => m.id);
    const fetchYearForTrend = async () => {
      const allTasks: any[] = [];
      for (const rid of yearReportIds) {
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("report_tasks")
            .select("report_id, task_code, title, category, billing_status, estimated_minutes, spent_minutes, squad, assignee, status, created_at_yt, resolved_at, started_at, tags, corrections_count, qa_returns, interrupted_minutes, client")
            .eq("report_id", rid)
            .range(from, from + pageSize - 1);
          if (error) break;
          allTasks.push(...(data || []));
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }
      }
      setDbTasksForTrend(allTasks);
    };
    fetchYearForTrend();
  }, [selectedMonth, months, toast]);

  const dashboardData: DashboardData = useMemo(() => {
    if (!dbTasks || dbTasks.length === 0) {
      return {
        teams: [],
        categoryTotals: [],
        billingData: [],
        totalSpent: 0,
        totalEstimated: 0,
        totalTasks: 0,
        billingTotalSpent: 0,
        billingTotalEstimated: 0,
        billingTotalTasks: 0,
        leadTimeBySquad: [],
        cycleTimeBySquad: [],
        throughputByWeek: [],
        wipBySquad: [],
        reworkCount: 0,
        reworkTotalCorrections: 0,
        reworkRate: 0,
        reworkBySquad: [],
        incidentsCreatedInMonth: 0,
        incidentsByClient: [],
      };
    }

    return buildDashboardData(dbTasks, selectedMonth);
  }, [dbTasks, selectedMonth]);

  const [selectedSquads, setSelectedSquads] = useState<string[]>([]);

  const filteredDashboardData: DashboardData = useMemo(() => {
    if (selectedSquads.length === 0) return dashboardData;
    if (!dbTasks || dbTasks.length === 0) {
      const filtered = {
        ...dashboardData,
        teams: dashboardData.teams.filter(t => selectedSquads.includes(t.name)),
      };
      return filtered;
    }
    const filtered = dbTasks.filter(t => selectedSquads.includes(t.squad || "Sem Squad"));
    return buildDashboardData(filtered, selectedMonth);
  }, [dashboardData, selectedSquads, selectedMonth, dbTasks]);

  const isYearView = selectedMonth.startsWith("year-");
  const yearMonthsForTrend = useMemo(() => {
    if (isYearView) {
      const year = selectedMonth.replace("year-", "");
      return months.filter(m => m.value.startsWith(year));
    }
    // For single month, get all months of the same year for context
    const year = selectedMonth.slice(0, 4);
    return months.filter(m => m.value.startsWith(year));
  }, [isYearView, selectedMonth, months]);

  const monthlyTrend: MonthlyTrendPoint[] = useMemo(() => {
    if (!dbTasksForTrend || dbTasksForTrend.length === 0 || yearMonthsForTrend.length === 0) return [];
    return buildMonthlyTrend(dbTasksForTrend, yearMonthsForTrend);
  }, [dbTasksForTrend, yearMonthsForTrend]);

  return {
    months,
    selectedMonth,
    setSelectedMonth,
    dashboardData: filteredDashboardData,
    unfilteredDashboardData: dashboardData,
    allTeams: dashboardData.teams,
    loading,
    refetchMonths: fetchMonths,
    selectedSquads,
    setSelectedSquads,
    monthlyTrend,
    isYearView,
  };
}
