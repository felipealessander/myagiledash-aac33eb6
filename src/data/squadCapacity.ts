// Squad capacity data model
// Each person: 160h/month theoretical, 128h/month productive (80% efficiency)

export const HOURS_PER_DAY = 8;
export const DAYS_PER_WEEK = 5;
export const HOURS_PER_MONTH = 160; // 8 * 5 * 4
export const EFFICIENCY_FACTOR = 0.8;
export const PRODUCTIVE_HOURS_PER_MONTH = HOURS_PER_MONTH * EFFICIENCY_FACTOR; // 128h

export type MemberRole = "Líder Técnico" | "Dev Back-end" | "Dev Front-end" | "Arquiteto" | "QA";

export interface SquadMember {
  name: string;
  role: MemberRole;
  cross: boolean; // true = shared across squads
  /** Fraction of capacity allocated to this squad (0-1). 1 = dedicated */
  allocation: number;
}

export interface SquadCapacityConfig {
  name: string;
  product: string; // product/domain name
  members: SquadMember[];
}

// Cross-squad members and their allocation across squads:
// Alexandre (Front-end): Golden Gate, Tesseract, CODE418 → 1/3 each ≈ 0.33
// Sávio (Arquiteto): Golden Gate, Tesseract → 1/2 each = 0.50
// Breno (QA): Golden Gate → 1.0 (only listed for GG)
// Roberto (QA): Tesseract → 1.0 (only listed for Tesseract)
// Tássio (Arquiteto): CODE418, TheBigBang-Cobrança → 1/2 each = 0.50
// Felipe Mendes (Front-end): JRE, TheBigBang-Cobrança, CODE402 → 1/3 each ≈ 0.33
// Jaison (Front-end): TheBigBang-Tributário → 1.0
// Wendell (Arquiteto): JRE, TheBigBang-Tributário, CODE402 → 1/3 each ≈ 0.33
// Pedro (QA): JRE, TheBigBang-Tributário → 1/2 each = 0.50
// Henrique (QA): TheBigBang-Cobrança, CODE402 → 1/2 each = 0.50

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
  fteEquivalent: number; // sum of allocations
  theoreticalHours: number;
  productiveHours: number;
  estimatedHours: number;
  spentHours: number;
  utilizationPct: number; // spentHours / productiveHours * 100
  estimationPct: number; // estimatedHours / productiveHours * 100
  members: SquadMember[];
}

export function computeCapacitySummaries(
  squadConfigs: SquadCapacityConfig[],
  hoursData: { squad: string; estimated: number; spent: number }[]
): SquadCapacitySummary[] {
  return squadConfigs.map((sq) => {
    const fte = sq.members.reduce((sum, m) => sum + m.allocation, 0);
    const theoretical = fte * HOURS_PER_MONTH;
    const productive = fte * PRODUCTIVE_HOURS_PER_MONTH;

    const match = hoursData.find(
      (h) => h.squad.toLowerCase() === sq.name.toLowerCase()
    );
    const estimated = match?.estimated ?? 0;
    const spent = match?.spent ?? 0;

    return {
      name: sq.name,
      product: sq.product,
      totalMembers: sq.members.length,
      fteEquivalent: parseFloat(fte.toFixed(2)),
      theoreticalHours: Math.round(theoretical),
      productiveHours: Math.round(productive),
      estimatedHours: Math.round(estimated),
      spentHours: Math.round(spent),
      utilizationPct: productive > 0 ? parseFloat(((spent / productive) * 100).toFixed(1)) : 0,
      estimationPct: productive > 0 ? parseFloat(((estimated / productive) * 100).toFixed(1)) : 0,
      members: sq.members,
    };
  });
}
