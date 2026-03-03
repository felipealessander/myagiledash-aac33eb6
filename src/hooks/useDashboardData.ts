import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

function buildDashboardData(tasks: DBTask[]) {
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
      const cat = t.category || "Tarefa";
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

    // Extract unique assignees from the tasks for this squad
    const assigneeSet = new Set<string>();
    for (const t of tTasks) {
      if (t.assignee) assigneeSet.add(t.assignee);
    }
    const memberNames = Array.from(assigneeSet).sort();

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
    const cat = t.category || "Tarefa";
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

  // Agile metrics - Lead Time (use same population as cycle time: only tasks with started_at)
  const resolvedTasks = tasks.filter(t => t.created_at_yt && t.resolved_at && t.started_at);
  const leadTimes = resolvedTasks.map(t => {
    const created = new Date(t.created_at_yt!).getTime();
    const resolved = new Date(t.resolved_at!).getTime();
    return Math.max(0, (resolved - created) / (1000 * 60 * 60 * 24));
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
      return Math.max(0, (r - c) / (1000 * 60 * 60 * 24));
    }).sort((a, b) => a - b);
    const avg = times.reduce((s, v) => s + v, 0) / times.length;
    const median = times[Math.floor(times.length / 2)];
    const p85 = times[Math.floor(times.length * 0.85)];
    leadTimeBySquad.push({ squad: squadName, avg: Math.round(avg * 10) / 10, median: Math.round(median * 10) / 10, p85: Math.round(p85 * 10) / 10, count: squadResolved.length });
  }

  // Cycle Time by squad (started_at -> resolved_at)
  const cycleTimeTasks = tasks.filter(t => t.started_at && t.resolved_at);
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
      return Math.max(0, (resolved - started) / (1000 * 60 * 60 * 24));
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

  // WIP: tasks with status not resolved/done
  const wipBySquad: { squad: string; wip: number }[] = squadNames.map(name => {
    const squadTasks = squadTasksMap.get(name) || [];
    const openTasks = squadTasks.filter(t => {
      const s = (t.status || "").toLowerCase();
      return !s.includes("done") && !s.includes("resolved") && !s.includes("closed") && !s.includes("conclu");
    });
    return { squad: name, wip: openTasks.length };
  });

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
  };
}

export type DashboardData = ReturnType<typeof buildDashboardData>;

export function useDashboardData() {
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("static");
  const [dbTasks, setDbTasks] = useState<DBTask[] | null>(null);
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
    if (selectedMonth === "static") {
      setDbTasks(null);
      return;
    }

    const monthOption = months.find(m => m.value === selectedMonth);
    if (!monthOption) return;

    setLoading(true);
    supabase
      .from("report_tasks")
      .select("task_code, title, category, billing_status, estimated_minutes, spent_minutes, squad, assignee, status, created_at_yt, resolved_at, started_at")
      .eq("report_id", monthOption.id)
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          console.error("Error loading tasks:", error);
          toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
          return;
        }
        setDbTasks(data || []);
      });
  }, [selectedMonth, months, toast]);

  const dashboardData: DashboardData = useMemo(() => {
    if (selectedMonth === "static" || !dbTasks) {
      return {
        teams: staticData.teams,
        categoryTotals: staticData.categoryTotals,
        billingData: staticData.billingData,
        totalSpent: staticData.totalSpent,
        totalEstimated: staticData.totalEstimated,
        totalTasks: staticData.totalTasks,
        billingTotalSpent: staticData.billingTotalSpent,
        billingTotalEstimated: staticData.billingTotalEstimated,
        billingTotalTasks: staticData.billingTotalTasks,
        leadTimeBySquad: [],
        cycleTimeBySquad: [],
        throughputByWeek: [],
        wipBySquad: [],
      };
    }

    return buildDashboardData(dbTasks);
  }, [selectedMonth, dbTasks]);

  const [selectedSquad, setSelectedSquad] = useState<string | null>(null);

  const filteredDashboardData: DashboardData = useMemo(() => {
    if (!selectedSquad) return dashboardData;
    // Re-build from filtered tasks
    if (selectedMonth === "static" || !dbTasks) {
      // Filter static teams
      const filtered = {
        ...dashboardData,
        teams: dashboardData.teams.filter(t => t.name === selectedSquad),
      };
      return filtered;
    }
    const filtered = dbTasks.filter(t => (t.squad || "Sem Squad") === selectedSquad);
    return buildDashboardData(filtered);
  }, [dashboardData, selectedSquad, selectedMonth, dbTasks]);

  return {
    months,
    selectedMonth,
    setSelectedMonth,
    dashboardData: filteredDashboardData,
    allTeams: dashboardData.teams,
    loading,
    refetchMonths: fetchMonths,
    selectedSquad,
    setSelectedSquad,
  };
}
