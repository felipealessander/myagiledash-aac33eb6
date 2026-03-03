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
}

function buildDashboardData(tasks: DBTask[]) {
  // Group tasks by squad (dynamic teams)
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

    // Count unique task codes as proxy for team size
    const uniqueTasks = new Set(tTasks.map(t => t.task_code));

    return {
      name,
      color: getTeamColor(index),
      members: Math.max(1, Math.ceil(uniqueTasks.size / 10)), // estimate members
      memberNames: [], // no member data from XLSX
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
  for (const t of tasks) {
    const status = t.billing_status || "Nenhum Faturável";
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
    const meta = billingLabelMap[status] || { label: status, description: "", color: "hsl(var(--muted-foreground))" };
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
      .select("task_code, title, category, billing_status, estimated_minutes, spent_minutes, squad")
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
      };
    }

    return buildDashboardData(dbTasks);
  }, [selectedMonth, dbTasks]);

  return {
    months,
    selectedMonth,
    setSelectedMonth,
    dashboardData,
    loading,
    refetchMonths: fetchMonths,
  };
}
