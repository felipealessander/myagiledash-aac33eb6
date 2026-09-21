import { describe, it, expect } from "vitest";
import {
  buildMttr,
  buildMttrBySquad,
  buildMttrTrend,
  resolutionDays,
  selectMttrTasks,
  type MttrTask,
} from "@/lib/mttr";

const t = (over: Partial<MttrTask> & { task_code: string }): MttrTask => ({
  category: "Incidente",
  squad: "Golden Gate",
  status: "Concluida",
  created_at_yt: "2026-03-01T00:00:00Z",
  resolved_at: "2026-03-03T00:00:00Z",
  ...over,
});

describe("resolutionDays", () => {
  it("mede dias corridos com uma casa decimal", () => {
    expect(resolutionDays("2026-03-01T00:00:00Z", "2026-03-03T12:00:00Z")).toBe(2.5);
  });
  it("nunca retorna negativo", () => {
    expect(resolutionDays("2026-03-05T00:00:00Z", "2026-03-01T00:00:00Z")).toBe(0);
  });
  it("retorna null sem alguma das datas", () => {
    expect(resolutionDays(null, "2026-03-01T00:00:00Z")).toBeNull();
    expect(resolutionDays("2026-03-01T00:00:00Z", null)).toBeNull();
  });
});

describe("seleção de incidentes", () => {
  it("aceita os tipos legados Bug, Defeito e Erro script", () => {
    const tasks = [
      t({ task_code: "A-1", category: "Bug" }),
      t({ task_code: "A-2", category: "Defeito" }),
      t({ task_code: "A-3", category: "Erro script" }),
      t({ task_code: "A-4", category: "Incidente" }),
    ];
    expect(selectMttrTasks(tasks)).toHaveLength(4);
  });

  it("ignora tarefas comuns, épicos e arquivados", () => {
    const tasks = [
      t({ task_code: "B-1", category: "Tarefa" }),
      t({ task_code: "B-2", category: "Épico" }),
      t({ task_code: "B-3", category: "Incidente", status: "Arquivado" }),
    ];
    expect(selectMttrTasks(tasks)).toHaveLength(0);
  });

  it("separa DeadLetter do MTTR principal", () => {
    const tasks = [t({ task_code: "C-1", category: "Deadletter" })];
    expect(selectMttrTasks(tasks)).toHaveLength(0);
    expect(selectMttrTasks(tasks, { includeDeadletters: true })).toHaveLength(1);
  });

  it("deduplica o mesmo card importado em meses diferentes", () => {
    const tasks = [
      t({ task_code: "D-1", status: "Em desenvolvimento", resolved_at: null }),
      t({ task_code: "D-1" }),
    ];
    expect(selectMttrTasks(tasks)).toHaveLength(1);
  });
});

describe("buildMttr", () => {
  const tasks = [
    t({ task_code: "E-1", created_at_yt: "2026-03-01T00:00:00Z", resolved_at: "2026-03-02T00:00:00Z" }), // 1
    t({ task_code: "E-2", created_at_yt: "2026-03-01T00:00:00Z", resolved_at: "2026-03-04T00:00:00Z" }), // 3
    t({ task_code: "E-3", created_at_yt: "2026-03-01T00:00:00Z", resolved_at: "2026-03-09T00:00:00Z" }), // 8
    t({ task_code: "E-4", squad: "JRE", created_at_yt: "2026-02-01T00:00:00Z", resolved_at: "2026-02-03T00:00:00Z" }),
  ];

  it("calcula média, mediana e p85 do mês de conclusão", () => {
    const r = buildMttr(tasks, { periodKey: "2026-03" });
    expect(r.count).toBe(3);
    expect(r.avg).toBe(4);
    expect(r.median).toBe(3);
    expect(r.p85).toBe(8);
    expect(r.min).toBe(1);
    expect(r.max).toBe(8);
  });

  it("usa o mês de conclusão mesmo quando o incidente abriu antes", () => {
    const r = buildMttr(
      [t({ task_code: "F-1", created_at_yt: "2026-02-20T00:00:00Z", resolved_at: "2026-03-02T00:00:00Z" })],
      { periodKey: "2026-03" },
    );
    expect(r.count).toBe(1);
    expect(r.avg).toBe(10);
  });

  it("sinaliza incidentes sem data de abertura em vez de somar zero", () => {
    const r = buildMttr([t({ task_code: "G-1", created_at_yt: null })], { periodKey: "2026-03" });
    expect(r.count).toBe(0);
    expect(r.missingCreated).toBe(1);
  });

  it("filtra por squad", () => {
    expect(buildMttr(tasks, { squads: ["JRE"] }).count).toBe(1);
  });

  it("retorna zeros sem dados", () => {
    const r = buildMttr([], { periodKey: "2026-03" });
    expect(r).toMatchObject({ count: 0, avg: 0, median: 0, p85: 0 });
    expect(r.items).toEqual([]);
  });

  it("detalha os cards do período ordenados do mais lento ao mais rápido", () => {
    const r = buildMttr(tasks, { periodKey: "2026-03" });
    expect(r.items.map(i => i.code)).toEqual(["E-3", "E-2", "E-1"]);
    expect(r.items).toHaveLength(r.count);
  });

  it("série mensal cobre apenas meses com incidentes resolvidos", () => {
    const trend = buildMttrTrend(tasks);
    expect(trend.map(p => p.month)).toEqual(["2026-02", "2026-03"]);
    expect(trend[1].avg).toBe(4);
    expect(trend[0].label).toBe("Fev/26");
  });

  it("MTTR por squad ordena do pior para o melhor", () => {
    const bySquad = buildMttrBySquad(tasks);
    expect(bySquad[0].squad).toBe("Golden Gate");
    expect(bySquad.find(s => s.squad === "JRE")!.avg).toBe(2);
  });
});
