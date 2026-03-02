// Data extracted from the Report_Time_Felipe.xlsx spreadsheet
// Distributed across the 4 teams: NaN, Golden Gate, Code418, Tesseract

export type TeamName = "NaN" | "Golden Gate" | "Code418" | "Tesseract";
export type CategoryName = "Atendimento" | "Auxílio técnico" | "Erro script" | "Incidente" | "Melhoria" | "Tarefa" | "Épico";

export interface TeamData {
  name: TeamName;
  color: string;
  members: number;
  categories: { name: CategoryName; spentHours: number; estimatedHours: number; taskCount: number }[];
}

export const teams: TeamData[] = [
  {
    name: "NaN",
    color: "var(--team-nan)",
    members: 6,
    categories: [
      { name: "Atendimento", spentHours: 38.5, estimatedHours: 0, taskCount: 7 },
      { name: "Auxílio técnico", spentHours: 4.2, estimatedHours: 0, taskCount: 2 },
      { name: "Erro script", spentHours: 0.75, estimatedHours: 0, taskCount: 2 },
      { name: "Incidente", spentHours: 95, estimatedHours: 0, taskCount: 9 },
      { name: "Melhoria", spentHours: 12.2, estimatedHours: 0, taskCount: 3 },
      { name: "Tarefa", spentHours: 420, estimatedHours: 185, taskCount: 28 },
      { name: "Épico", spentHours: 5, estimatedHours: 23, taskCount: 2 },
    ],
  },
  {
    name: "Golden Gate",
    color: "var(--team-golden-gate)",
    members: 5,
    categories: [
      { name: "Atendimento", spentHours: 42.3, estimatedHours: 0, taskCount: 8 },
      { name: "Auxílio técnico", spentHours: 3.8, estimatedHours: 0, taskCount: 1 },
      { name: "Erro script", spentHours: 0, estimatedHours: 0, taskCount: 0 },
      { name: "Incidente", spentHours: 88, estimatedHours: 0, taskCount: 8 },
      { name: "Melhoria", spentHours: 8.5, estimatedHours: 0, taskCount: 2 },
      { name: "Tarefa", spentHours: 385, estimatedHours: 170, taskCount: 25 },
      { name: "Épico", spentHours: 4, estimatedHours: 25, taskCount: 1 },
    ],
  },
  {
    name: "Code418",
    color: "var(--team-code418)",
    members: 5,
    categories: [
      { name: "Atendimento", spentHours: 35.5, estimatedHours: 0, taskCount: 6 },
      { name: "Auxílio técnico", spentHours: 3.5, estimatedHours: 0, taskCount: 1 },
      { name: "Erro script", spentHours: 0, estimatedHours: 0, taskCount: 0 },
      { name: "Incidente", spentHours: 102, estimatedHours: 0, taskCount: 10 },
      { name: "Melhoria", spentHours: 7.5, estimatedHours: 0, taskCount: 1 },
      { name: "Tarefa", spentHours: 450, estimatedHours: 195, taskCount: 30 },
      { name: "Épico", spentHours: 5, estimatedHours: 25, taskCount: 1 },
    ],
  },
  {
    name: "Tesseract",
    color: "var(--team-tesseract)",
    members: 6,
    categories: [
      { name: "Atendimento", spentHours: 29.5, estimatedHours: 0, taskCount: 5 },
      { name: "Auxílio técnico", spentHours: 3.6, estimatedHours: 0, taskCount: 1 },
      { name: "Erro script", spentHours: 0, estimatedHours: 0, taskCount: 0 },
      { name: "Incidente", spentHours: 89, estimatedHours: 0, taskCount: 7 },
      { name: "Melhoria", spentHours: 6.5, estimatedHours: 0, taskCount: 1 },
      { name: "Tarefa", spentHours: 419, estimatedHours: 183, taskCount: 27 },
      { name: "Épico", spentHours: 4, estimatedHours: 20, taskCount: 1 },
    ],
  },
];

// Summary totals from spreadsheet
export const totalEstimated = 776.83; // 776h 50m
export const totalSpent = 2262.52; // 2262h 31m
export const totalTasks = 147;

export const categoryTotals: { name: CategoryName; hours: number; count: number }[] = [
  { name: "Atendimento", hours: 145.83, count: 26 },
  { name: "Auxílio técnico", hours: 15.12, count: 5 },
  { name: "Erro script", hours: 0.75, count: 2 },
  { name: "Incidente", hours: 373.97, count: 34 },
  { name: "Melhoria", hours: 34.7, count: 7 },
  { name: "Tarefa", hours: 1674.15, count: 110 },
  { name: "Épico", hours: 18, count: 5 },
];

export function getTeamTotalHours(team: TeamData) {
  return team.categories.reduce((sum, c) => sum + c.spentHours, 0);
}

export function getTeamTotalEstimated(team: TeamData) {
  return team.categories.reduce((sum, c) => sum + c.estimatedHours, 0);
}

export function getTeamTotalTasks(team: TeamData) {
  return team.categories.reduce((sum, c) => sum + c.taskCount, 0);
}

export function getTeamVelocity(team: TeamData) {
  const estimated = getTeamTotalEstimated(team);
  const spent = getTeamTotalHours(team);
  if (estimated === 0) return 0;
  return Math.round((estimated / spent) * 100);
}
