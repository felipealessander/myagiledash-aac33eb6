import { describe, it, expect } from "vitest";
import {
  computeClientUsage,
  taskMonthBucket,
  buildAliasMap,
  type ClientLite,
  type TaskLite,
  type MonthlyHoursLite,
} from "@/lib/clientUsage";

const pgesp: ClientLite = {
  id: "c-pgesp",
  name: "PGE SP",
  active: true,
  aliases: ["PGE SP", "PGESP", "PGE SP (Novo)", "PGESPNOVO"],
};

const otherClient: ClientLite = {
  id: "c-other",
  name: "Outro",
  active: true,
  aliases: ["OUTRO"],
};

const inactiveClient: ClientLite = {
  id: "c-inactive",
  name: "Antigo",
  active: false,
  aliases: ["ANTIGO"],
};

const hours: MonthlyHoursLite[] = [
  { client_id: "c-pgesp", month: "2026-03", contracted_hours: 1400 },
  { client_id: "c-other", month: "2026-03", contracted_hours: 100 },
];

describe("taskMonthBucket", () => {
  it("uses resolved_at when present (UTC bucket)", () => {
    expect(
      taskMonthBucket({ client: "X", spent_minutes: 60, status: null, resolved_at: "2026-03-15T10:00:00Z", created_at_yt: "2025-01-01T00:00:00Z" })
    ).toBe("2026-03");
  });
  it("falls back to created_at_yt when resolved_at is null", () => {
    expect(
      taskMonthBucket({ client: "X", spent_minutes: 60, status: null, resolved_at: null, created_at_yt: "2026-03-31T23:00:00Z" })
    ).toBe("2026-03");
  });
  it("returns null when neither date is available", () => {
    expect(
      taskMonthBucket({ client: "X", spent_minutes: 60, status: null, resolved_at: null, created_at_yt: null })
    ).toBeNull();
  });
});

describe("buildAliasMap", () => {
  it("indexes aliases case-insensitively and skips inactive clients", () => {
    const map = buildAliasMap([pgesp, inactiveClient]);
    expect(map.get("PGE SP")?.id).toBe("c-pgesp");
    expect(map.get("PGESP")?.id).toBe("c-pgesp");
    expect(map.get("PGESPNOVO")?.id).toBe("c-pgesp");
    expect(map.get("ANTIGO")).toBeUndefined();
  });
});

describe("computeClientUsage", () => {
  const baseTask = (overrides: Partial<TaskLite>): TaskLite => ({
    client: "PGESP",
    spent_minutes: 60,
    status: "Resolvido",
    resolved_at: "2026-03-10T12:00:00Z",
    created_at_yt: "2026-03-01T00:00:00Z",
    ...overrides,
  });

  it("sums spent hours for matched client in the selected month", () => {
    const tasks: TaskLite[] = [
      baseTask({ spent_minutes: 60 }),
      baseTask({ spent_minutes: 30, client: "PGE SP" }),
      baseTask({ spent_minutes: 45, client: "PGE SP (Novo)" }),
    ];
    const { usage } = computeClientUsage("2026-03", [pgesp], tasks, hours);
    const row = usage.find(u => u.clientId === "c-pgesp")!;
    expect(row.spentHours).toBe(2.3); // (60+30+45)/60 = 2.25 -> rounded 2.3
    expect(row.contractedHours).toBe(1400);
    expect(row.taskCount).toBe(3);
  });

  it("excludes 'arquivado' tasks", () => {
    const tasks: TaskLite[] = [
      baseTask({ spent_minutes: 600, status: "Arquivado" }),
      baseTask({ spent_minutes: 60, status: "Concluído" }),
    ];
    const { usage } = computeClientUsage("2026-03", [pgesp], tasks, hours);
    const row = usage.find(u => u.clientId === "c-pgesp")!;
    expect(row.spentHours).toBe(1);
    expect(row.taskCount).toBe(1);
  });

  it("ignores tasks outside the selected month", () => {
    const tasks: TaskLite[] = [
      baseTask({ resolved_at: "2026-02-28T23:59:00Z", spent_minutes: 999 }),
      baseTask({ resolved_at: "2026-04-01T00:00:00Z", spent_minutes: 999 }),
      baseTask({ spent_minutes: 60 }),
    ];
    const { usage } = computeClientUsage("2026-03", [pgesp], tasks, hours);
    expect(usage.find(u => u.clientId === "c-pgesp")!.spentHours).toBe(1);
  });

  it("uses created_at_yt when resolved_at is null", () => {
    const tasks: TaskLite[] = [
      baseTask({ resolved_at: null, created_at_yt: "2026-03-20T10:00:00Z", spent_minutes: 120 }),
    ];
    const { usage } = computeClientUsage("2026-03", [pgesp], tasks, hours);
    expect(usage.find(u => u.clientId === "c-pgesp")!.spentHours).toBe(2);
  });

  it("computes utilization percentage", () => {
    const tasks: TaskLite[] = Array.from({ length: 10 }, () =>
      baseTask({ spent_minutes: 60 * 70 }) // 70h each * 10 = 700h
    );
    const { usage } = computeClientUsage("2026-03", [pgesp], tasks, hours);
    const row = usage.find(u => u.clientId === "c-pgesp")!;
    expect(row.spentHours).toBe(700);
    expect(row.utilizationPct).toBe(50); // 700/1400 = 50%
  });

  it("groups unmapped client tags separately", () => {
    const tasks: TaskLite[] = [
      baseTask({ client: "DESCONHECIDO", spent_minutes: 120 }),
      baseTask({ client: "DESCONHECIDO", spent_minutes: 60 }),
    ];
    const { usage, unmapped } = computeClientUsage("2026-03", [pgesp, otherClient], tasks, hours);
    expect(usage.find(u => u.clientId === "c-pgesp")!.spentHours).toBe(0);
    expect(unmapped).toHaveLength(1);
    expect(unmapped[0]).toEqual({ alias: "DESCONHECIDO", spentHours: 3, taskCount: 2 });
  });

  it("matches PGE SP and PGE SP (Novo) into the same consolidated client", () => {
    const tasks: TaskLite[] = [
      baseTask({ client: "PGE SP", spent_minutes: 60 * 400 }),
      baseTask({ client: "PGE SP (Novo)", spent_minutes: 60 * 467 }),
      baseTask({ client: "PGESP", spent_minutes: 60 * 0.18 }),
    ];
    const { usage, unmapped } = computeClientUsage("2026-03", [pgesp], tasks, hours);
    const row = usage.find(u => u.clientId === "c-pgesp")!;
    expect(unmapped).toHaveLength(0);
    // 400 + 467 + 0.18 = 867.18
    expect(row.spentHours).toBeCloseTo(867.2, 1);
    expect(row.taskCount).toBe(3);
  });
});
