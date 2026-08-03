import { describe, it, expect } from "vitest";
import {
  applyFlowFilters,
  buildFlowComparison,
  buildFlowMetrics,
  buildOnDemandHistory,
  businessDaysBetween,
  computeStats,
  dedupeByTaskCode,
  isIncidentTask,
  isOnDemandTask,
  percentile,
  toComparisonChartData,
  type FlowTask,
} from "@/lib/flowMetrics";

const t = (o: Partial<FlowTask>): FlowTask => ({
  task_code: "X-1",
  category: "Tarefa",
  squad: "Golden Gate",
  status: "Concluída",
  client: null,
  created_at_yt: "2026-05-04T09:00:00Z", // segunda
  started_at: "2026-05-04T09:00:00Z",
  resolved_at: "2026-05-08T18:00:00Z", // sexta
  spent_minutes: 60,
  ...o,
});

describe("businessDaysBetween", () => {
  it("conta apenas dias úteis", () => {
    expect(businessDaysBetween(new Date("2026-05-04T00:00:00Z"), new Date("2026-05-08T00:00:00Z"))).toBe(4);
    // sexta -> segunda = 1 dia útil
    expect(businessDaysBetween(new Date("2026-05-01T00:00:00Z"), new Date("2026-05-04T00:00:00Z"))).toBe(1);
    // mesmo dia
    expect(businessDaysBetween(new Date("2026-05-04T08:00:00Z"), new Date("2026-05-04T20:00:00Z"))).toBe(0);
  });

  it("não retorna valores negativos em alterações retroativas", () => {
    expect(businessDaysBetween(new Date("2026-05-08T00:00:00Z"), new Date("2026-05-04T00:00:00Z"))).toBe(0);
  });
});

describe("percentile / computeStats", () => {
  it("usa nearest-rank", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.85)).toBe(9);
    expect(percentile([], 0.5)).toBe(0);
  });

  it("diferencia média, mediana e P85", () => {
    const s = computeStats([1, 1, 1, 1, 1, 1, 1, 1, 1, 100]);
    expect(s.count).toBe(10);
    expect(s.avg).toBe(10.9);
    expect(s.median).toBe(1);
    expect(s.p85).toBe(1);
    expect(s.max).toBe(100);
  });

  it("retorna zeros para lista vazia", () => {
    expect(computeStats([])).toMatchObject({ count: 0, avg: 0, median: 0, p85: 0 });
  });
});

describe("classificação", () => {
  it("trata Incidente, Bug e DeadLetter como incidentes", () => {
    expect(isIncidentTask(t({ category: "Incidente" }))).toBe(true);
    expect(isIncidentTask(t({ category: "Bug" }))).toBe(true);
    expect(isIncidentTask(t({ category: "DeadLetter" }))).toBe(true);
    expect(isIncidentTask(t({ tags: ["dead letter"] }))).toBe(true);
    expect(isIncidentTask(t({ category: "Melhoria" }))).toBe(false);
  });

  it("identifica Sob Demanda pelo cliente vinculado", () => {
    expect(isOnDemandTask(t({ client: "PGE SP" }))).toBe(true);
    expect(isOnDemandTask(t({ client: "   " }))).toBe(false);
    expect(isOnDemandTask(t({ client: null }))).toBe(false);
  });
});

describe("normalização", () => {
  it("remove duplicidades de task_code mantendo o estado final", () => {
    const rows = [
      t({ task_code: "A-1", squad: "Code418", resolved_at: null, started_at: null }),
      t({ task_code: "A-1", squad: "JRE", resolved_at: "2026-05-08T18:00:00Z" }),
    ];
    const out = dedupeByTaskCode(rows);
    expect(out).toHaveLength(1);
    expect(out[0].squad).toBe("JRE");
  });

  it("mudança de squad não duplica o item nos indicadores", () => {
    const rows = [
      t({ task_code: "A-1", squad: "Code418", resolved_at: "2026-05-06T18:00:00Z" }),
      t({ task_code: "A-1", squad: "JRE", resolved_at: "2026-05-08T18:00:00Z" }),
    ];
    const m = buildFlowMetrics(rows, { periodKey: "2026-05" });
    expect(m.general.completed).toBe(1);
    expect(m.general.bySquad).toHaveLength(1);
    expect(m.general.bySquad[0].squad).toBe("JRE");
  });

  it("exclui arquivados e respeita filtros de squad e cliente", () => {
    const rows = [
      t({ task_code: "A", status: "Arquivado" }),
      t({ task_code: "B", squad: "JRE", client: "PGE SP" }),
      t({ task_code: "C", squad: "Code418", client: "AGE MG" }),
    ];
    expect(applyFlowFilters(rows).map(x => x.task_code)).toEqual(["B", "C"]);
    expect(applyFlowFilters(rows, { squads: ["JRE"] }).map(x => x.task_code)).toEqual(["B"]);
    expect(applyFlowFilters(rows, { clients: ["AGE MG"] }).map(x => x.task_code)).toEqual(["C"]);
  });
});

describe("Lead Time e Cycle Time", () => {
  it("Lead Time = criação → conclusão em dias úteis; Cycle Time = início → conclusão", () => {
    const m = buildFlowMetrics(
      [t({ created_at_yt: "2026-05-01T09:00:00Z", started_at: "2026-05-04T09:00:00Z", resolved_at: "2026-05-08T18:00:00Z" })],
      { periodKey: "2026-05" },
    );
    expect(m.general.leadTime.avg).toBe(5); // sex 01 -> sex 08 = 5 dias úteis
    expect(m.general.cycleTime.avg).toBe(4); // seg 04 -> sex 08
  });

  it("usa a data de criação quando não há data de início do desenvolvimento", () => {
    const m = buildFlowMetrics(
      [t({ created_at_yt: "2026-05-04T09:00:00Z", started_at: null, resolved_at: "2026-05-08T18:00:00Z" })],
      { periodKey: "2026-05" },
    );
    expect(m.general.missingStart).toBe(1);
    expect(m.general.cycleTime.count).toBe(1);
    expect(m.general.cycleTime.avg).toBe(4);
  });

  it("itens sem conclusão ficam fora dos cálculos e contam como abertos", () => {
    const m = buildFlowMetrics(
      [t({ created_at_yt: "2026-05-04T09:00:00Z", resolved_at: null, status: "Em Desenvolvimento" })],
      { periodKey: "2026-05" },
    );
    expect(m.general.completed).toBe(0);
    expect(m.general.open).toBe(1);
    expect(m.general.leadTime.count).toBe(0);
  });

  it("itens sem data de criação ficam fora do Lead Time mas entram no Cycle Time", () => {
    const m = buildFlowMetrics(
      [t({ created_at_yt: null, started_at: "2026-05-04T09:00:00Z", resolved_at: "2026-05-08T18:00:00Z" })],
      { periodKey: "2026-05" },
    );
    expect(m.general.missingCreated).toBe(1);
    expect(m.general.leadTime.count).toBe(0);
    expect(m.general.cycleTime.count).toBe(1);
  });

  it("alteração retroativa de status (conclusão antes da criação) não gera valor negativo", () => {
    const m = buildFlowMetrics(
      [t({ created_at_yt: "2026-05-08T09:00:00Z", started_at: "2026-05-08T09:00:00Z", resolved_at: "2026-05-04T09:00:00Z" })],
      { periodKey: "2026-05" },
    );
    expect(m.general.leadTime.avg).toBe(0);
    expect(m.general.cycleTime.avg).toBe(0);
  });

  it("conta itens reabertos", () => {
    const m = buildFlowMetrics(
      [t({ task_code: "R-1", tags: ["Retorno para Desenvolvimento"] }), t({ task_code: "R-2" })],
      { periodKey: "2026-05" },
    );
    expect(m.general.reopened).toBe(1);
  });

  it("considera o item pelo mês de conclusão, independente da abertura", () => {
    const rows = [
      t({ task_code: "IN", created_at_yt: "2026-04-01T09:00:00Z", started_at: "2026-04-01T09:00:00Z", resolved_at: "2026-05-08T18:00:00Z" }),
      t({ task_code: "OUT", created_at_yt: "2026-05-04T09:00:00Z", started_at: "2026-05-04T09:00:00Z", resolved_at: "2026-06-01T18:00:00Z" }),
    ];
    expect(buildFlowMetrics(rows, { periodKey: "2026-05" }).general.completed).toBe(1);
    expect(buildFlowMetrics(rows, { periodKey: "year-2026" }).general.completed).toBe(2);
  });

  it("exclui épicos e a squad Qualidade", () => {
    const rows = [
      t({ task_code: "E", category: "Épico" }),
      t({ task_code: "Q", squad: "Qualidade" }),
      t({ task_code: "OK" }),
    ];
    const m = buildFlowMetrics(rows, { periodKey: "2026-05" });
    expect(m.general.completed).toBe(1);
  });
});

describe("separação de incidentes", () => {
  const rows = [
    t({ task_code: "D-1" }),
    t({ task_code: "SD-1", client: "PGE SP" }),
    t({ task_code: "I-1", category: "Incidente", created_at_yt: "2026-05-04T09:00:00Z", started_at: "2026-05-04T09:00:00Z", resolved_at: "2026-05-11T09:00:00Z" }),
    t({ task_code: "B-1", category: "Bug", client: "AGE MG" }),
    t({ task_code: "DL-1", tags: ["DeadLetter"] }),
  ];

  it("mantém incidentes fora dos indicadores gerais", () => {
    const m = buildFlowMetrics(rows, { periodKey: "2026-05" });
    expect(m.general.completed).toBe(2);
    expect(m.demands.completed).toBe(1);
    expect(m.onDemand.completed).toBe(1);
  });

  it("contabiliza incidentes em visão separada com estatísticas próprias", () => {
    const m = buildFlowMetrics(rows, { periodKey: "2026-05" });
    expect(m.incidents.completed).toBe(3);
    expect(m.incidents.leadTime.count).toBe(3);
    expect(m.incidents.leadTime.max).toBe(5); // I-1: seg 04 -> seg 11
    expect(m.incidents.leadTime.median).toBe(4);
  });

  it("incidentes não afetam média, mediana nem P85 gerais", () => {
    const withIncidents = buildFlowMetrics(rows, { periodKey: "2026-05" }).general;
    const withoutIncidents = buildFlowMetrics(rows.slice(0, 2), { periodKey: "2026-05" }).general;
    expect(withIncidents).toEqual(withoutIncidents);
  });
});

describe("comparação mensal", () => {
  const byPeriod: Record<string, FlowTask[]> = {
    "2026-03": [t({ task_code: "M3", created_at_yt: "2026-03-02T09:00:00Z", started_at: "2026-03-02T09:00:00Z", resolved_at: "2026-03-06T09:00:00Z" })],
    "2026-04": [],
    "2026-05": [
      t({ task_code: "M5-1" }),
      t({ task_code: "M5-2", category: "Incidente" }),
    ],
  };
  const periods = [
    { value: "2026-03", label: "Março" },
    { value: "2026-04", label: "Abril" },
    { value: "2026-05", label: "Maio" },
  ];

  it("compara até três meses e mantém meses sem registros", () => {
    const cmp = buildFlowComparison(byPeriod, periods);
    expect(cmp).toHaveLength(3);
    expect(cmp[1].metrics.general.completed).toBe(0);
    expect(cmp[1].metrics.general.leadTime.median).toBe(0);
  });

  it("limita a comparação a três períodos", () => {
    const cmp = buildFlowComparison(byPeriod, [...periods, { value: "2026-06", label: "Junho" }]);
    expect(cmp).toHaveLength(3);
  });

  it("gera série de gráfico por segmento e métrica", () => {
    const cmp = buildFlowComparison(byPeriod, periods);
    const geral = toComparisonChartData(cmp, "general", "lead");
    expect(geral.map(r => r.volume)).toEqual([1, 0, 1]);
    expect(geral[0]).toMatchObject({ label: "Março", media: 4, mediana: 4, p85: 4 });
    const inc = toComparisonChartData(cmp, "incidents", "cycle");
    expect(inc.map(r => r.volume)).toEqual([0, 0, 1]);
  });

  it("respeita filtro de squad na comparação", () => {
    const cmp = buildFlowComparison(byPeriod, periods, { squads: ["JRE"] });
    expect(cmp.every(c => c.metrics.general.completed === 0)).toBe(true);
  });
});

describe("histórico Sob Demanda", () => {
  const byPeriod: Record<string, FlowTask[]> = {
    "2026-04": [t({ task_code: "A", client: "PGE SP", created_at_yt: "2026-04-01T09:00:00Z", started_at: "2026-04-01T09:00:00Z", resolved_at: "2026-04-30T09:00:00Z", spent_minutes: 120 })],
    "2026-05": [
      t({ task_code: "B", client: "PGE SP", spent_minutes: 180 }),
      t({ task_code: "C", client: "AGE MG", spent_minutes: 60 }),
      t({ task_code: "D", client: "AGE MG", category: "Incidente", spent_minutes: 600 }),
      t({ task_code: "E", client: null, spent_minutes: 300 }),
      t({ task_code: "F", client: "AGE MG", resolved_at: null, created_at_yt: "2026-05-04T09:00:00Z" }),
    ],
  };
  const periods = [
    { value: "2026-05", label: "Maio" },
    { value: "2026-04", label: "Abril" },
  ];

  it("ordena cronologicamente e agrega volume, clientes e horas", () => {
    const h = buildOnDemandHistory(byPeriod, periods);
    expect(h.map(p => p.periodKey)).toEqual(["2026-04", "2026-05"]);
    expect(h[1]).toMatchObject({ completed: 2, open: 1, clients: 2, hours: 4 });
  });

  it("expõe indicadores de fluxo por mês, sem incidentes", () => {
    const h = buildOnDemandHistory(byPeriod, periods);
    expect(h[0].leadMedian).toBe(21); // 01/04 -> 30/04 em dias úteis
    expect(h[1].leadMedian).toBe(4);
    expect(h[1].cycleP85).toBe(4);
  });
});
