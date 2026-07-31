import { describe, it, expect } from "vitest";
import {
  buildPresentationMetrics,
  computeCycleTime,
  computeDlq,
  computeMttr,
  computeTimeLogging,
  filterPresentationTasks,
  isDeadLetter,
  percentile,
  type PresentationTask,
} from "@/lib/presentationMetrics";

const t = (o: Partial<PresentationTask>): PresentationTask => ({
  task_code: "X-1",
  category: "Tarefa",
  squad: "Golden Gate",
  status: "Concluído",
  spent_minutes: 60,
  ...o,
});

describe("filterPresentationTasks", () => {
  it("removes archived tasks", () => {
    const tasks = [t({ task_code: "A" }), t({ task_code: "B", status: "Arquivado" })];
    expect(filterPresentationTasks(tasks).map(x => x.task_code)).toEqual(["A"]);
  });

  it("filters by selected squads and defaults to all when empty", () => {
    const tasks = [t({ squad: "JRE" }), t({ squad: "Code418" })];
    expect(filterPresentationTasks(tasks, ["JRE"])).toHaveLength(1);
    expect(filterPresentationTasks(tasks, [])).toHaveLength(2);
  });

  it("groups tasks without squad under 'Sem Squad'", () => {
    const m = buildPresentationMetrics([t({ squad: null })], { monthLabel: "Maio" });
    expect(m.squads).toEqual(["Sem Squad"]);
  });
});

describe("percentile", () => {
  it("uses nearest-rank on the sorted list", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.85)).toBe(9);
    expect(percentile([], 0.85)).toBe(0);
  });
});

describe("computeMttr", () => {
  it("measures created -> resolved in hours, discounting interruptions", () => {
    const tasks = [
      t({ category: "Incidente", created_at_yt: "2026-05-01T00:00:00Z", resolved_at: "2026-05-01T10:00:00Z" }),
      t({ category: "Incidente", created_at_yt: "2026-05-02T00:00:00Z", resolved_at: "2026-05-02T06:00:00Z", interrupted_minutes: 120 }),
    ];
    const r = computeMttr(tasks);
    expect(r.resolvedIncidents).toBe(2);
    expect(r.overall.avg).toBe(7); // (10 + 4) / 2
    expect(r.overall.p85).toBe(10);
  });

  it("counts unresolved incidents separately and ignores non-incidents", () => {
    const tasks = [
      t({ category: "Incidente", created_at_yt: "2026-05-01T00:00:00Z", resolved_at: null }),
      t({ category: "Bug", created_at_yt: "2026-05-01T00:00:00Z", resolved_at: "2026-05-05T00:00:00Z" }),
    ];
    const r = computeMttr(tasks);
    expect(r.openIncidents).toBe(1);
    expect(r.resolvedIncidents).toBe(0);
    expect(r.overall.count).toBe(0);
  });

  it("never returns negative durations", () => {
    const r = computeMttr([
      t({ category: "Incidente", created_at_yt: "2026-05-05T00:00:00Z", resolved_at: "2026-05-01T00:00:00Z" }),
    ]);
    expect(r.overall.avg).toBe(0);
  });

  it("counts DeadLetter incidents apart from the regular MTTR", () => {
    const r = computeMttr([
      t({ category: "Incidente", created_at_yt: "2026-05-01T00:00:00Z", resolved_at: "2026-05-01T10:00:00Z" }),
      t({ category: "Incidente", tags: ["DeadLetter"], created_at_yt: "2026-05-01T00:00:00Z", resolved_at: "2026-05-03T00:00:00Z" }),
      t({ category: "Incidente", tags: ["dead-letter"], created_at_yt: "2026-05-01T00:00:00Z", resolved_at: null }),
    ]);
    expect(r.resolvedIncidents).toBe(1);
    expect(r.overall.avg).toBe(10);
    expect(r.openIncidents).toBe(0);
    expect(r.resolvedDeadLetterIncidents).toBe(1);
    expect(r.deadLetter.avg).toBe(48);
    expect(r.openDeadLetterIncidents).toBe(1);
    expect(r.bySquad.every(s => s.count === 1)).toBe(true);
  });
});


describe("computeCycleTime", () => {
  it("measures started -> resolved in days", () => {
    const r = computeCycleTime([
      t({ started_at: "2026-05-01T00:00:00Z", resolved_at: "2026-05-03T00:00:00Z" }),
      t({ started_at: "2026-05-01T00:00:00Z", resolved_at: "2026-05-05T00:00:00Z" }),
    ]);
    expect(r.consideredTasks).toBe(2);
    expect(r.overall.avg).toBe(3);
  });

  it("excludes Épico and the Qualidade squad", () => {
    const r = computeCycleTime([
      t({ category: "Épico", started_at: "2026-05-01T00:00:00Z", resolved_at: "2026-05-30T00:00:00Z" }),
      t({ squad: "Qualidade", started_at: "2026-05-01T00:00:00Z", resolved_at: "2026-05-20T00:00:00Z" }),
      t({ started_at: "2026-05-01T00:00:00Z", resolved_at: "2026-05-02T00:00:00Z" }),
    ]);
    expect(r.consideredTasks).toBe(1);
    expect(r.overall.avg).toBe(1);
  });

  it("reports tasks skipped for missing dates", () => {
    const r = computeCycleTime([t({ started_at: null, resolved_at: "2026-05-02T00:00:00Z" })]);
    expect(r.skippedNoDates).toBe(1);
    expect(r.overall.count).toBe(0);
  });
});

describe("computeTimeLogging", () => {
  it("computes the share of tasks with logged hours", () => {
    const r = computeTimeLogging([
      t({ spent_minutes: 120 }),
      t({ spent_minutes: 0 }),
      t({ spent_minutes: null }),
      t({ spent_minutes: 60 }),
    ]);
    expect(r.totalTasks).toBe(4);
    expect(r.tasksWithHours).toBe(2);
    expect(r.tasksWithoutHours).toBe(2);
    expect(r.overallPct).toBe(50);
    expect(r.totalSpentHours).toBe(3);
  });

  it("breaks down per squad", () => {
    const r = computeTimeLogging([
      t({ squad: "JRE", spent_minutes: 60 }),
      t({ squad: "JRE", spent_minutes: 0 }),
      t({ squad: "Code418", spent_minutes: 60 }),
    ]);
    expect(r.bySquad[0]).toMatchObject({ squad: "Code418", pct: 100 });
    expect(r.bySquad.find(s => s.squad === "JRE")?.pct).toBe(50);
  });

  it("returns zeros for an empty list", () => {
    const r = computeTimeLogging([]);
    expect(r.overallPct).toBe(0);
    expect(r.bySquad).toEqual([]);
  });
});

describe("DLQ", () => {
  it("detects DeadLetter by tag or by YouTrack type", () => {
    expect(isDeadLetter(t({ tags: ["DeadLetter"] }))).toBe(true);
    expect(isDeadLetter(t({ tags: ["dead letter"] }))).toBe(true);
    expect(isDeadLetter(t({ category: "Dead-Letter" }))).toBe(true);
    expect(isDeadLetter(t({ tags: ["urgente"], category: "Bug" }))).toBe(false);
  });

  it("computes volume, effort and share", () => {
    const r = computeDlq([
      t({ tags: ["DeadLetter"], spent_minutes: 120, client: "PGE SP" }),
      t({ category: "DeadLetter", spent_minutes: 60, client: "PGE SP" }),
      t({ spent_minutes: 180 }),
    ]);
    expect(r.count).toBe(2);
    expect(r.hours).toBe(3);
    expect(r.sharePct).toBe(66.7);
    expect(r.hoursSharePct).toBe(50);
    expect(r.byClient[0]).toEqual({ key: "PGE SP", count: 2, hours: 3 });
  });
});

describe("buildPresentationMetrics", () => {
  it("applies archived exclusion and squad filter to every metric", () => {
    const tasks = [
      t({ squad: "JRE", category: "Incidente", created_at_yt: "2026-05-01T00:00:00Z", resolved_at: "2026-05-01T04:00:00Z" }),
      t({ squad: "JRE", started_at: "2026-05-01T00:00:00Z", resolved_at: "2026-05-03T00:00:00Z", tags: ["DeadLetter"] }),
      t({ squad: "Code418", spent_minutes: 999 }),
      t({ squad: "JRE", status: "Arquivado", spent_minutes: 500, tags: ["DeadLetter"] }),
    ];
    const m = buildPresentationMetrics(tasks, { monthLabel: "Maio 2026", selectedSquads: ["JRE"] });
    expect(m.taskCount).toBe(2);
    expect(m.squads).toEqual(["JRE"]);
    expect(m.mttr.overall.avg).toBe(4);
    expect(m.cycleTime.overall.avg).toBe(2);
    expect(m.dlq.count).toBe(1);
    expect(m.timeLogging.overallPct).toBe(100);
  });
});

describe("period filter (concluídos no mês)", () => {
  const base = { status: "Done", squad: "A", spent_minutes: 60 };
  const tasks = [
    { ...base, task_code: "IN", created_at_yt: "2026-04-20T10:00:00Z", started_at: "2026-04-20T10:00:00Z", resolved_at: "2026-05-10T10:00:00Z" },
    { ...base, task_code: "OUT", created_at_yt: "2026-05-02T10:00:00Z", started_at: "2026-05-02T10:00:00Z", resolved_at: "2026-06-02T10:00:00Z" },
    { ...base, task_code: "OPEN", created_at_yt: "2026-05-03T10:00:00Z", started_at: "2026-05-03T10:00:00Z", resolved_at: null },
  ];

  it("keeps only tasks resolved inside the month, regardless of creation", () => {
    const m = buildPresentationMetrics(tasks, { monthLabel: "Maio", periodKey: "2026-05" });
    expect(m.taskCount).toBe(1);
    expect(m.cycleTime.consideredTasks).toBe(1);
  });

  it("supports year view", () => {
    const m = buildPresentationMetrics(tasks, { monthLabel: "2026", periodKey: "year-2026" });
    expect(m.taskCount).toBe(2);
  });
});
