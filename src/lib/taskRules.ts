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
 * Incidente. Por regra de negócio, o tipo "Bug" do YouTrack É um incidente —
 * não existe indicador separado de Bug para evitar contagem duplicada.
 */
export function isIncident(t: RuleTask): boolean {
  const c = norm(t.category);
  return c === "incidente" || c === "incidentes" || c === "bug" || c === "bugs";
}

/** Épico — entra no esforço, fica fora das métricas de fluxo. */
export function isEpic(t: RuleTask): boolean {
  const c = norm(t.category);
  return c === "épico" || c === "epico" || c === "epic";
}

/** Squad Qualidade — fora das métricas de fluxo. */
export function isQualidadeSquad(squad?: string | null): boolean {
  return norm(squad) === "qualidade";
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
