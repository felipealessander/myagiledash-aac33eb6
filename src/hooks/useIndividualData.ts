import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MonthOption } from "@/hooks/useDashboardData";

interface TeamMember {
  name: string;
  username: string;
  squad: string | null;
}

interface TaskCard {
  task_code: string;
  title: string | null;
  status: string | null;
}

interface DevMetric {
  name: string;
  displayName: string;
  totalTasks: number;
  completedTasks: number;
  spentHours: number;
  estimatedHours: number;
  reworkCount: number;
  reworkRate: number;
  reworkCards: TaskCard[];
  taskCards: TaskCard[];
}

export function useIndividualData(selectedMonth: string, months: MonthOption[]) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from("team_members")
        .select("name, username, squad")
        .eq("active", true)
        .order("name");
      if (data) setTeamMembers(data);
    };
    fetchMembers();
  }, []);

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
        .select("assignee, task_code, title, status, spent_minutes, estimated_minutes, qa_returns, corrections_count")
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

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of teamMembers) {
      map.set(m.username, m.name);
      map.set(m.name, m.name);
    }
    return map;
  }, [teamMembers]);

  const memberSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of teamMembers) {
      s.add(m.username);
      s.add(m.name);
    }
    return s;
  }, [teamMembers]);

  const allDevNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const t of tasks) {
      if (t.assignee && memberSet.has(t.assignee)) {
        names.set(t.assignee, memberMap.get(t.assignee) || t.assignee);
      }
    }
    return Array.from(names.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, display]) => ({ key, display }));
  }, [tasks, memberSet, memberMap]);

  const devMetrics: DevMetric[] = useMemo(() => {
    const byDev = new Map<string, any[]>();

    for (const t of tasks) {
      const assignee = t.assignee;
      if (!assignee || !memberSet.has(assignee)) continue;
      if (!byDev.has(assignee)) byDev.set(assignee, []);
      byDev.get(assignee)!.push(t);
    }

    return Array.from(byDev.entries())
      .map(([assignee, devTasks]) => {
        const displayName = memberMap.get(assignee) || assignee;
        const completedTasks = devTasks.filter(t => {
          const s = (t.status || "").toLowerCase();
          return s.includes("done") || s.includes("resolved") || s.includes("closed") || s.includes("conclu");
        }).length;

        const spentHours = devTasks.reduce((s: number, t: any) => s + (t.spent_minutes || 0) / 60, 0);
        const estimatedHours = devTasks.reduce((s: number, t: any) => s + (t.estimated_minutes || 0) / 60, 0);

        const reworkTasks = devTasks.filter((t: any) => (t.qa_returns || 0) > 0 || (t.corrections_count || 0) > 0);
        const reworkCount = reworkTasks.length;
        const reworkRate = devTasks.length > 0 ? (reworkCount / devTasks.length) * 100 : 0;

        const taskCards: TaskCard[] = devTasks.map(t => ({
          task_code: t.task_code,
          title: t.title,
          status: t.status,
        }));

        const reworkCards: TaskCard[] = reworkTasks.map(t => ({
          task_code: t.task_code,
          title: t.title,
          status: t.status,
        }));

        return {
          name: assignee,
          displayName,
          totalTasks: devTasks.length,
          completedTasks,
          spentHours,
          estimatedHours,
          reworkCount,
          reworkRate,
          reworkCards,
          taskCards,
        };
      })
      .sort((a, b) => b.spentHours - a.spentHours);
  }, [tasks, memberSet, memberMap]);

  return { devMetrics, allDevNames, loading };
}
