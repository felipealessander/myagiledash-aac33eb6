// Squad capacity data model
// Capacity = working days in month × hours/day per role × allocation

export type MemberRole = "Líder Técnico" | "Dev Back-end" | "Dev Front-end" | "Arquiteto" | "QA";

/** Hours per day by role */
export const ROLE_HOURS_PER_DAY: Record<MemberRole, number> = {
  "Líder Técnico": 2,
  "Dev Back-end": 8,
  "Dev Front-end": 8,
  "Arquiteto": 2,
  "QA": 8,
};

export interface SquadMember {
  name: string;
  role: MemberRole;
  cross: boolean;
  /** Fraction of capacity allocated to this squad (0-1). 1 = dedicated */
  allocation: number;
}

export interface SquadCapacityConfig {
  name: string;
  product: string;
  members: SquadMember[];
}

/**
 * Calculate working days (Mon-Fri) in a given month.
 * Does not account for holidays — can be enhanced later.
 */
export function getWorkingDaysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow >= 1 && dow <= 5) count++;
  }
  return count;
}

// Squad definitions
export const SQUAD_CAPACITY: SquadCapacityConfig[] = [
  {
    name: "Golden Gate",
    product: "Contencioso Judicial",
    members: [
      { name: "Renan", role: "Líder Técnico", cross: false, allocation: 1 },
      { name: "João Ostrovski", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "José Vitor", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "João Griebner", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Lucas Ramos", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Alexandre", role: "Dev Front-end", cross: true, allocation: 0.33 },
      { name: "Sávio", role: "Arquiteto", cross: true, allocation: 0.50 },
      { name: "Breno", role: "QA", cross: true, allocation: 1 },
    ],
  },
  {
    name: "Tesseract",
    product: "Consultivo",
    members: [
      { name: "Guilherme", role: "Líder Técnico", cross: false, allocation: 1 },
      { name: "Carol Schlickmann", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Davi Santos", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "João Neres", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Mauricio Verona", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Alexandre", role: "Dev Front-end", cross: true, allocation: 0.33 },
      { name: "Sávio", role: "Arquiteto", cross: true, allocation: 0.50 },
      { name: "Roberto", role: "QA", cross: true, allocation: 1 },
    ],
  },
  {
    name: "Code418",
    product: "Lotação e Distribuição",
    members: [
      { name: "Jhennyfer", role: "Líder Técnico", cross: false, allocation: 1 },
      { name: "Michelle Victoriano", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Raphael Maia", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Tais Marcolino", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Anderson Nóbrega", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Alexandre", role: "Dev Front-end", cross: true, allocation: 0.34 },
      { name: "Tássio", role: "Arquiteto", cross: true, allocation: 0.50 },
    ],
  },
  {
    name: "JRE",
    product: "Requisitórios",
    members: [
      { name: "Carlos Melo", role: "Líder Técnico", cross: false, allocation: 0.50 },
      { name: "Kauan Mello", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Gustavo Rezin", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Felipe Mendes", role: "Dev Front-end", cross: true, allocation: 0.33 },
      { name: "Wendell", role: "Arquiteto", cross: true, allocation: 0.33 },
      { name: "Pedro", role: "QA", cross: true, allocation: 0.50 },
    ],
  },
  {
    name: "TheBigBang",
    product: "Contencioso Tributário",
    members: [
      { name: "Carlos Melo", role: "Líder Técnico", cross: false, allocation: 0.50 },
      { name: "Gabriel Lopes", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Sthefanie", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Sheila", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Jaison", role: "Dev Front-end", cross: true, allocation: 1 },
      { name: "Wendell", role: "Arquiteto", cross: true, allocation: 0.33 },
      { name: "Pedro", role: "QA", cross: true, allocation: 0.50 },
    ],
  },
  {
    name: "TheBigBang-Cobrança",
    product: "Cobrança Administrativa e Judicial",
    members: [
      { name: "Ronaldo", role: "Líder Técnico", cross: false, allocation: 1 },
      { name: "Kauan Paiva", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Nicolas", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Douglas Sheibler", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Felipe Mendes", role: "Dev Front-end", cross: true, allocation: 0.33 },
      { name: "Tássio", role: "Arquiteto", cross: true, allocation: 0.50 },
      { name: "Henrique", role: "QA", cross: true, allocation: 0.50 },
    ],
  },
  {
    name: "Code402",
    product: "Code402",
    members: [
      { name: "Eduarda", role: "Líder Técnico", cross: false, allocation: 1 },
      { name: "João Marcelo", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Marcos Ghizo", role: "Dev Back-end", cross: false, allocation: 1 },
      { name: "Felipe Mendes", role: "Dev Front-end", cross: true, allocation: 0.34 },
      { name: "Wendell", role: "Arquiteto", cross: true, allocation: 0.34 },
      { name: "Henrique", role: "QA", cross: true, allocation: 0.50 },
    ],
  },
];

export interface SquadCapacitySummary {
  name: string;
  product: string;
  totalMembers: number;
  fteEquivalent: number;
  capacityHours: number;
  estimatedHours: number;
  spentHours: number;
  productSpentHours: number; // hours on tasks tagged "Produto"
  productPct: number; // productSpentHours / spentHours * 100
  utilizationPct: number;
  estimationPct: number;
  members: SquadMember[];
  workingDays: number;
}

/**
 * Compute capacity for a member based on their role, allocation, and working days.
 */
export function getMemberCapacity(member: SquadMember, workingDays: number): number {
  const hoursPerDay = ROLE_HOURS_PER_DAY[member.role];
  return workingDays * hoursPerDay * member.allocation;
}

export function computeCapacitySummaries(
  squadConfigs: SquadCapacityConfig[],
  hoursData: { squad: string; estimated: number; spent: number; productSpent: number }[],
  workingDays: number
): SquadCapacitySummary[] {
  return squadConfigs.map((sq) => {
    const capacityHours = sq.members.reduce(
      (sum, m) => sum + getMemberCapacity(m, workingDays),
      0
    );
    const fte = sq.members.reduce((sum, m) => sum + m.allocation, 0);

    const match = hoursData.find(
      (h) => h.squad.toLowerCase() === sq.name.toLowerCase()
    );
    const estimated = match?.estimated ?? 0;
    const spent = match?.spent ?? 0;
    const productSpent = match?.productSpent ?? 0;

    return {
      name: sq.name,
      product: sq.product,
      totalMembers: sq.members.length,
      fteEquivalent: parseFloat(fte.toFixed(2)),
      capacityHours: Math.round(capacityHours),
      estimatedHours: Math.round(estimated),
      spentHours: Math.round(spent),
      productSpentHours: Math.round(productSpent),
      productPct: spent > 0 ? parseFloat(((productSpent / spent) * 100).toFixed(1)) : 0,
      utilizationPct: capacityHours > 0 ? parseFloat(((spent / capacityHours) * 100).toFixed(1)) : 0,
      estimationPct: capacityHours > 0 ? parseFloat(((estimated / capacityHours) * 100).toFixed(1)) : 0,
      members: sq.members,
      workingDays,
    };
  });
}
