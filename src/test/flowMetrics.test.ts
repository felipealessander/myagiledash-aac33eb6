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

/* ────────── inclusão opcional de Bugs e DeadLetters ────────── */

describe("inclusão de Bugs e DeadLetters", () => {
  const regular = t({ task_code: "R-1" });
  const bug = t({ task_code: "B-1", category: "Bug" });
  const dl = t({ task_code: "D-1", category: "Tarefa", tags: ["DeadLetter"] });
  const both = t({ task_code: "BD-1", category: "Bug", tags: ["dead-letter"] });
  const incident = t({ task_code: "I-1", category: "Incidente" });
  const all = [regular, bug, dl, both, incident];

  it("por padrão considera somente demandas regulares", () => {
    const m = buildFlowMetrics(all, { periodKey: "2026-05" });
    expect(m.inclusion).toEqual({ bugs: false, deadletters: false });
    expect(m.general.completed).toBe(1);
    expect(m.general.items.map(i => i.code)).toEqual(["R-1"]);
  });

  it("inclui Bugs e Incidentes quando a opção de Bug está ativa", () => {
    const m = buildFlowMetrics(all, { periodKey: "2026-05", inclusion: { bugs: true } });
    expect(m.general.completed).toBe(3);
    expect(m.general.items.map(i => i.code).sort()).toEqual(["B-1", "I-1", "R-1"]); // BD-1 conta como DeadLetter
    expect(m.general.byType.bug).toBe(1);
    expect(m.general.byType.incident).toBe(1);
  });

  it("inclui somente DeadLetters quando a opção de DLQ está ativa", () => {
    const m = buildFlowMetrics(all, { periodKey: "2026-05", inclusion: { deadletters: true } });
    expect(m.general.items.map(i => i.code).sort()).toEqual(["BD-1", "D-1", "R-1"]);
    expect(m.general.byType.deadletter).toBe(2);
  });

  it("inclui Bugs e DeadLetters juntos sem duplicar card com dupla classificação", () => {
    const m = buildFlowMetrics(all, { periodKey: "2026-05", inclusion: { bugs: true, deadletters: true } });
    expect(m.general.completed).toBe(5);
    expect(m.general.items.filter(i => i.code === "BD-1")).toHaveLength(1);
    expect(m.general.byType.deadletter).toBe(2); // DeadLetter tem precedência de rótulo
    expect(m.general.byType.bug).toBe(1);
  });

  it("mantém incidentes fora dos gerais quando a opção de Bug está desligada", () => {
    for (const inc of [{}, { deadletters: true }]) {
      const m = buildFlowMetrics(all, { periodKey: "2026-05", inclusion: inc });
      expect(m.general.items.some(i => i.code === "I-1")).toBe(false);
      expect(m.general.byType.incident).toBe(0);
      expect(m.incidents.completed).toBe(4); // Incidente + Bug + DL + ambos
    }
  });

  it("recalcula médias, medianas e percentis ao ativar as opções", () => {
    const tasks = [
      t({ task_code: "R-1", created_at_yt: "2026-05-04T09:00:00Z", started_at: "2026-05-04T09:00:00Z", resolved_at: "2026-05-05T09:00:00Z" }),
      t({ task_code: "B-1", category: "Bug", created_at_yt: "2026-05-04T09:00:00Z", started_at: "2026-05-04T09:00:00Z", resolved_at: "2026-05-15T09:00:00Z" }),
    ];
    const off = buildFlowMetrics(tasks, { periodKey: "2026-05" });
    const on = buildFlowMetrics(tasks, { periodKey: "2026-05", inclusion: { bugs: true } });
    expect(off.general.leadTime.avg).toBe(1);
    expect(on.general.leadTime.avg).toBe(5); // (1 + 9) / 2
    expect(on.general.leadTime.p85).toBe(9);
  });

  it("usa a data de fechamento para itens abertos em meses anteriores", () => {
    const oldBug = t({ task_code: "B-OLD", category: "Bug", created_at_yt: "2026-03-02T09:00:00Z", started_at: "2026-04-01T09:00:00Z", resolved_at: "2026-05-08T09:00:00Z" });
    const oldDl = t({ task_code: "D-OLD", tags: ["DeadLetter"], created_at_yt: "2026-02-02T09:00:00Z", started_at: "2026-04-01T09:00:00Z", resolved_at: "2026-05-08T09:00:00Z" });
    const m = buildFlowMetrics([oldBug, oldDl], { periodKey: "2026-05", inclusion: { bugs: true, deadletters: true } });
    expect(m.general.completed).toBe(2);
    expect(buildFlowMetrics([oldBug, oldDl], { periodKey: "2026-05" }).general.completed).toBe(0);
  });

  it("combina com filtros de squad e cliente", () => {
    const tasks = [
      t({ task_code: "B-JRE", category: "Bug", squad: "JRE", client: "PGE SP" }),
      t({ task_code: "B-CODE", category: "Bug", squad: "Code418", client: "AGE MG" }),
      t({ task_code: "R-JRE", squad: "JRE", client: "PGE SP" }),
    ];
    const m = buildFlowMetrics(tasks, { periodKey: "2026-05", squads: ["JRE"], clients: ["PGE SP"], inclusion: { bugs: true } });
    expect(m.general.completed).toBe(2);
    expect(m.onDemand.completed).toBe(2);
    expect(m.demands.completed).toBe(0);
  });

  it("aplica a mesma configuração aos três meses comparados", () => {
    const byPeriod = {
      "2026-03": [t({ task_code: "B-3", category: "Bug", created_at_yt: "2026-03-02T09:00:00Z", started_at: "2026-03-02T09:00:00Z", resolved_at: "2026-03-03T09:00:00Z" })],
      "2026-04": [t({ task_code: "R-4", created_at_yt: "2026-04-01T09:00:00Z", started_at: "2026-04-01T09:00:00Z", resolved_at: "2026-04-02T09:00:00Z" })],
      "2026-05": [t({ task_code: "D-5", tags: ["DeadLetter"] })],
    };
    const periods = [
      { value: "2026-03", label: "Mar" },
      { value: "2026-04", label: "Abr" },
      { value: "2026-05", label: "Mai" },
    ];
    const off = buildFlowComparison(byPeriod, periods);
    expect(off.map(c => c.metrics.general.completed)).toEqual([0, 1, 0]);

    const on = buildFlowComparison(byPeriod, periods, { inclusion: { bugs: true, deadletters: true } });
    expect(on.map(c => c.metrics.general.completed)).toEqual([1, 1, 1]);
    expect(on.every(c => c.metrics.inclusion.bugs && c.metrics.inclusion.deadletters)).toBe(true);
    expect(toComparisonChartData(on, "general", "lead").map(r => r.volume)).toEqual([1, 1, 1]);
  });

  it("mantém card, gráfico e detalhamento consistentes", () => {
    const m = buildFlowMetrics(all, { periodKey: "2026-05", inclusion: { bugs: true } });
    const seg = m.general;
    expect(seg.items).toHaveLength(seg.completed);
    expect(seg.bySquad.reduce((s, x) => s + x.count, 0)).toBe(seg.completed);
    expect(Object.values(seg.byType).reduce((s, x) => s + x, 0)).toBe(seg.completed);
  });

  it("reflete a inclusão no histórico Sob Demanda", () => {
    const byPeriod = {
      "2026-05": [
        t({ task_code: "R-1", client: "PGE SP" }),
        t({ task_code: "D-1", client: "PGE SP", tags: ["DeadLetter"], spent_minutes: 120 }),
      ],
    };
    const periods = [{ value: "2026-05", label: "Mai" }];
    expect(buildOnDemandHistory(byPeriod, periods)[0]).toMatchObject({ completed: 1, hours: 1 });
    expect(buildOnDemandHistory(byPeriod, periods, { inclusion: { deadletters: true } })[0]).toMatchObject({ completed: 2, hours: 3 });
  });
});

/* ───────── Auditoria: rastreabilidade e inconsistências ───────── */

describe("auditoria dos indicadores de fluxo", () => {
  const base = (over: Partial<FlowTask>): FlowTask => ({
    task_code: "X-1",
    category: "Tarefa",
    squad: "Golden Gate",
    status: "Concluído",
    created_at_yt: "2026-05-04T10:00:00Z",
    started_at: "2026-05-05T10:00:00Z",
    resolved_at: "2026-05-08T10:00:00Z",
    ...over,
  });

  it("detalhamento tem a mesma quantidade de linhas do total do indicador", () => {
    const tasks = [base({ task_code: "A-1" }), base({ task_code: "A-2" }), base({ task_code: "A-3", resolved_at: null })];
    const m = buildFlowMetrics(tasks, { periodKey: "2026-05" });
    expect(m.general.items.length).toBe(m.general.completed);
    expect(m.general.completed).toBe(2);
  });

  it("expõe datas, flags e motivo de inclusão em cada card", () => {
    const m = buildFlowMetrics([base({ task_code: "A-9", client: "PGE SP" })], { periodKey: "2026-05" });
    const item = m.general.items[0];
    expect(item.createdAt).toBe("2026-05-04T10:00:00Z");
    expect(item.startedAt).toBe("2026-05-05T10:00:00Z");
    expect(item.resolvedAt).toBe("2026-05-08T10:00:00Z");
    expect(item.isBug).toBe(false);
    expect(item.isDeadletter).toBe(false);
    expect(item.isIncident).toBe(false);
    expect(item.inclusionReason).toContain("Sob Demanda");
  });

  it("marca flags corretas para bug e deadletter incluídos", () => {
    const tasks = [
      base({ task_code: "B-1", category: "Bug" }),
      base({ task_code: "D-1", category: "Tarefa", tags: ["DeadLetter"] }),
    ];
    const m = buildFlowMetrics(tasks, { periodKey: "2026-05", inclusion: { bugs: true, deadletters: true } });
    expect(m.general.items.find(i => i.code === "B-1")!.isBug).toBe(true);
    expect(m.general.items.find(i => i.code === "D-1")!.isDeadletter).toBe(true);
  });

  it("sinaliza fechamento anterior à abertura sem gerar valor negativo", () => {
    const t = base({ task_code: "I-1", created_at_yt: "2026-05-20T10:00:00Z", resolved_at: "2026-05-10T10:00:00Z", started_at: null });
    const m = buildFlowMetrics([t], { periodKey: "2026-05" });
    expect(m.general.items[0].lead).toBe(0);
    expect(m.general.issues.some(i => i.kind === "resolved_before_created")).toBe(true);
  });

  it("sinaliza concluído sem data de início e sem squad", () => {
    const t = base({ task_code: "I-2", started_at: null, squad: null });
    const m = buildFlowMetrics([t], { periodKey: "2026-05" });
    const kinds = m.general.issues.map(i => i.kind);
    expect(kinds).toContain("resolved_without_started");
    expect(kinds).toContain("missing_squad");
    expect(m.general.missingStart).toBe(1);
  });

  it("card concluído sem data de abertura fica fora do Lead Time", () => {
    const t = base({ task_code: "I-3", created_at_yt: null });
    const m = buildFlowMetrics([t], { periodKey: "2026-05" });
    expect(m.general.items[0].lead).toBeNull();
    expect(m.general.leadTime.count).toBe(0);
    expect(m.general.missingCreated).toBe(1);
  });

  it("computeVariation protege divisão por zero e calcula percentual", () => {
    expect(computeVariation(5, 0)).toEqual({ abs: 5, pct: null });
    expect(computeVariation(6, 4)).toEqual({ abs: 2, pct: 50 });
    expect(computeVariation(3, 6)).toEqual({ abs: -3, pct: -50 });
  });

  it("período sem registros retorna zeros, não erro", () => {
    const m = buildFlowMetrics([base({ task_code: "Z-1" })], { periodKey: "2026-01" });
    expect(m.general.completed).toBe(0);
    expect(m.general.leadTime).toEqual({ count: 0, avg: 0, median: 0, p85: 0, min: 0, max: 0 });
    expect(m.general.items).toHaveLength(0);
  });
});
