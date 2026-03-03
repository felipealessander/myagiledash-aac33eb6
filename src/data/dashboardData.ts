// Data extracted from the Report_Time_Felipe.xlsx spreadsheet
// Teams are now dynamic based on imported data

export type TeamName = string;
export type CategoryName = string;

export interface TeamData {
  name: TeamName;
  color: string;
  members: number;
  memberNames: string[];
  categories: { name: CategoryName; spentHours: number; estimatedHours: number; taskCount: number }[];
}

// Dynamic color palette for teams
const TEAM_COLOR_PALETTE = [
  "hsl(217, 91%, 60%)",  // blue
  "hsl(142, 71%, 45%)",  // green
  "hsl(38, 92%, 50%)",   // amber
  "hsl(280, 67%, 55%)",  // purple
  "hsl(0, 84%, 60%)",    // red
  "hsl(190, 90%, 50%)",  // cyan
  "hsl(330, 80%, 55%)",  // pink
  "hsl(60, 70%, 45%)",   // yellow-green
];

export function getTeamColor(index: number): string {
  return TEAM_COLOR_PALETTE[index % TEAM_COLOR_PALETTE.length];
}

// Static data for fallback
export const teams: TeamData[] = [
  {
    name: "NaN",
    color: "var(--team-nan)",
    members: 6,
    memberNames: ["Felipe Souza", "Ana Clara", "Lucas Martins", "Juliana Costa", "Pedro Henrique", "Mariana Lima"],
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
    memberNames: ["Rafael Oliveira", "Camila Santos", "Bruno Almeida", "Fernanda Rocha", "Thiago Pereira"],
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
    memberNames: ["Diego Silva", "Isabela Ferreira", "Gustavo Ribeiro", "Larissa Mendes", "Vinícius Cardoso"],
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
    memberNames: ["André Nascimento", "Beatriz Araújo", "Carlos Eduardo", "Daniela Moreira", "Eduardo Campos", "Gabriela Teixeira"],
    categories: [
      { name: "Atendimento", spentHours: 29.5, estimatedHours: 0, taskCount: 5 },
      { name: "Auxílio técnico", spentHours: 3.6, estimatedHours: 0, taskCount: 1 },
      { name: "Incidente", spentHours: 89, estimatedHours: 0, taskCount: 7 },
      { name: "Melhoria", spentHours: 6.5, estimatedHours: 0, taskCount: 1 },
      { name: "Tarefa", spentHours: 419, estimatedHours: 183, taskCount: 27 },
      { name: "Épico", spentHours: 4, estimatedHours: 20, taskCount: 1 },
    ],
  },
  {
    name: "Code402",
    color: "hsl(190, 90%, 50%)",
    members: 3,
    memberNames: ["Marcos Vieira", "Patrícia Lopes", "Roberto Dias"],
    categories: [
      { name: "Atendimento", spentHours: 18.2, estimatedHours: 0, taskCount: 3 },
      { name: "Incidente", spentHours: 45, estimatedHours: 0, taskCount: 4 },
      { name: "Tarefa", spentHours: 210, estimatedHours: 95, taskCount: 14 },
    ],
  },
  {
    name: "JRE",
    color: "hsl(330, 80%, 55%)",
    members: 4,
    memberNames: ["Henrique Barros", "Tatiana Fonseca", "Leonardo Pinto", "Renata Campos"],
    categories: [
      { name: "Atendimento", spentHours: 22.5, estimatedHours: 0, taskCount: 4 },
      { name: "Incidente", spentHours: 52, estimatedHours: 0, taskCount: 5 },
      { name: "Tarefa", spentHours: 280, estimatedHours: 120, taskCount: 18 },
      { name: "Melhoria", spentHours: 5, estimatedHours: 0, taskCount: 1 },
    ],
  },
  {
    name: "TheBigBang",
    color: "hsl(60, 70%, 45%)",
    members: 3,
    memberNames: ["João Victor", "Amanda Nunes", "Caio Rezende"],
    categories: [
      { name: "Atendimento", spentHours: 15, estimatedHours: 0, taskCount: 2 },
      { name: "Incidente", spentHours: 38, estimatedHours: 0, taskCount: 3 },
      { name: "Tarefa", spentHours: 175, estimatedHours: 80, taskCount: 12 },
    ],
  },
];

// Summary totals from spreadsheet
export const totalEstimated = 776.83;
export const totalSpent = 2262.52;
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

// Billing data
export type BillingStatus = "Faturável" | "Não Faturável" | "Nenhum Faturável";

export interface BillingData {
  status: BillingStatus;
  label: string;
  description: string;
  estimatedHours: number;
  spentHours: number;
  taskCount: number;
  color: string;
}

export const billingData: BillingData[] = [
  {
    status: "Faturável",
    label: "Faturável",
    description: "Atividades marcadas como faturáveis ao cliente",
    estimatedHours: 144.5,
    spentHours: 184.25,
    taskCount: 11,
    color: "hsl(var(--primary))",
  },
  {
    status: "Não Faturável",
    label: "Não Faturável",
    description: "Atividades explicitamente marcadas como não faturáveis",
    estimatedHours: 110.5,
    spentHours: 159.15,
    taskCount: 10,
    color: "hsl(var(--warning))",
  },
  {
    status: "Nenhum Faturável",
    label: "Sem Marcação",
    description: "A opção de 'Faturável' não foi preenchida na tarefa",
    estimatedHours: 521.83,
    spentHours: 1923.12,
    taskCount: 176,
    color: "hsl(var(--muted-foreground))",
  },
];

export const billingTotalSpent = billingData.reduce((s, b) => s + b.spentHours, 0);
export const billingTotalEstimated = billingData.reduce((s, b) => s + b.estimatedHours, 0);
export const billingTotalTasks = billingData.reduce((s, b) => s + b.taskCount, 0);
