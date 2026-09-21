/**
 * Regras canônicas de classificação de cards — fonte única para TODOS os módulos
 * (Fluxo, Apresentação, Dashboard, Capacidade, Clientes, Incidentes).
 *
 * Qualquer módulo que precise saber "isto é arquivado / épico / bug / incidente /
 * DeadLetter / concluído" deve importar daqui, e nunca reimplementar a regra.
 * Documentação de negócio: docs/indicadores.md
 */

export interface RuleTask {
  category?: string | null;
  status?: string | null;
  tags?: string[] | null;
}

export const DEADLETTER_RE = /dead[\s-]?letter/i;

const norm = (v?: string | null) => (v || "").toLowerCase().trim();

/** Itens arquivados nunca entram em nenhum indicador. */
export function isArchivedStatus(status?: string | null): boolean {
  return norm(status).includes("arquivado");
}

export function isArchived(t: RuleTask): boolean {
  return isArchivedStatus(t.status);
}

/** Status considerado entregue/concluído. */
export function isDoneStatus(status?: string | null): boolean {
  const s = norm(status);
  return s.includes("conclu") || s.includes("done") || s.includes("delivery");
}

/** DeadLetter (DLQ): identificado por tag OU pelo tipo do YouTrack. */
export function isDeadLetter(t: RuleTask): boolean {
  if ((t.tags || []).some(tag => DEADLETTER_RE.test(tag || ""))) return true;
  return !!t.category && DEADLETTER_RE.test(t.category);
}

/**
 * Tipos do YouTrack que representam um incidente.
 * O bundle atual do projeto ATT expõe apenas "Incidente", mas a base histórica
 * (e projetos legados) contém "Bug", "Defeito" e "Erro script" — todos são a
 * mesma coisa para o negócio e precisam cair no mesmo indicador, sem duplicar.
 */
export const INCIDENT_TYPES = [
  "incidente",
  "incidentes",
  "bug",
  "bugs",
  "defeito",
  "defeitos",
  "erro script",
  "erro de script",
  "falha",
] as const;

/** Tipos de atendimento/suporte (demanda não-projeto). */
export const SUPPORT_TYPES = ["atendimento", "orientação", "orientacao", "auxílio técnico", "auxilio tecnico"] as const;

export function isIncident(t: RuleTask): boolean {
  return (INCIDENT_TYPES as readonly string[]).includes(norm(t.category));
}

/** Atendimento / Orientação / Auxílio técnico — demandas de suporte. */
export function isSupport(t: RuleTask): boolean {
  return (SUPPORT_TYPES as readonly string[]).includes(norm(t.category));
}

/** Épico — entra no esforço, fica fora das métricas de fluxo. */
export function isEpic(t: RuleTask): boolean {
  const c = norm(t.category);
  return c === "épico" || c === "epico" || c === "epic";
}

/**
 * Nome canônico do tipo para rótulos e agrupamentos: tipos legados são
 * normalizados para o valor vigente no YouTrack.
 */
export function canonicalCategory(t: RuleTask): string {
  if (isDeadLetter(t)) return "DeadLetter";
  if (isIncident(t)) return "Incidente";
  if (isEpic(t)) return "Épico";
  const c = norm(t.category);
  if (!c) return "Sem Tipo";
  if (c === "atendimento") return "Atendimento";
  if (c === "orientação" || c === "orientacao") return "Orientação";
  if (c === "auxílio técnico" || c === "auxilio tecnico") return "Auxílio técnico";
  if (c === "infraestrutura") return "Infraestrutura";
  if (c.startsWith("tarefa")) return "Tarefa";
  if (c === "sob demanda") return "Tarefa";
  return (t.category || "").trim();
}

/** Squad Qualidade — fora das métricas de fluxo. */
export function isQualidadeSquad(squad?: string | null): boolean {
  return norm(squad) === "qualidade";
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
