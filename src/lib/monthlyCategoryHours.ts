import { canonicalCategory, isArchived } from "@/lib/taskRules";

export const MONTHLY_HOUR_KEYS = [
  "tarefasHours",
  "incidentesHours",
  "melhoriasHours",
  "deadLettersHours",
  "epicosHours",
  "outrosHours",
] as const;

export interface CategoryHoursTask {
  category?: string | null;
  status?: string | null;
  tags?: string[] | null;
  spent_minutes?: number | null;
}

export interface MonthlyCategoryHours {
  tarefasHours: number;
  incidentesHours: number;
  melhoriasHours: number;
  deadLettersHours: number;
  epicosHours: number;
  outrosHours: number;
}

export function sumMonthlyCategoryHours(tasks: CategoryHoursTask[]): MonthlyCategoryHours {
  const hours: MonthlyCategoryHours = {
    tarefasHours: 0,
    incidentesHours: 0,
    melhoriasHours: 0,
    deadLettersHours: 0,
    epicosHours: 0,
    outrosHours: 0,
  };

  for (const task of tasks) {
    if (isArchived(task)) continue;
    const spentHours = (Number(task.spent_minutes) || 0) / 60;
    const category = canonicalCategory(task);

    if (category === "Tarefa") hours.tarefasHours += spentHours;
    else if (category === "Incidente") hours.incidentesHours += spentHours;
    else if (category === "Melhoria") hours.melhoriasHours += spentHours;
    else if (category === "DeadLetter") hours.deadLettersHours += spentHours;
    else if (category === "Épico") hours.epicosHours += spentHours;
    else hours.outrosHours += spentHours;
  }

  return hours;
}

export function totalCategoryHours(hours: MonthlyCategoryHours): number {
  return MONTHLY_HOUR_KEYS.reduce((total, key) => total + hours[key], 0);
}