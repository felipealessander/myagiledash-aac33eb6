import { describe, it, expect } from "vitest";
import {
  monthShortLabel,
  isConsecutive,
  describePeriod,
  absoluteDelta,
  percentDelta,
  alignMonths,
  buildComparison,
  summarizeSeries,
  hasEnoughData,
} from "@/lib/monthComparison";

describe("monthShortLabel", () => {
  it("formata mês no padrão pt-BR curto", () => {
    expect(monthShortLabel("2026-05")).toBe("Mai/26");
    expect(monthShortLabel("2025-12")).toBe("Dez/25");
  });
  it("retorna a entrada quando inválida", () => {
    expect(monthShortLabel("abc")).toBe("abc");
    expect(monthShortLabel("2026-13")).toBe("2026-13");
  });
});

describe("isConsecutive", () => {
  it("detecta meses consecutivos, inclusive virada de ano", () => {
    expect(isConsecutive(["2026-01", "2026-02", "2026-03"])).toBe(true);
    expect(isConsecutive(["2025-12", "2026-01"])).toBe(true);
  });
  it("rejeita lacunas e listas pequenas", () => {
    expect(isConsecutive(["2026-01", "2026-03"])).toBe(false);
    expect(isConsecutive(["2026-01"])).toBe(false);
  });
});

describe("describePeriod", () => {
  const yearMonths = ["2026-01", "2026-02", "2026-03"];

  it("seleção vazia = consolidado do ano", () => {
    const p = describePeriod([], "2026", yearMonths);
    expect(p.kind).toBe("year");
    expect(p.months).toEqual(yearMonths);
  });
  it("um mês = single", () => {
    expect(describePeriod(["2026-02"], "2026", yearMonths).kind).toBe("single");
  });
  it("todos os meses do ano = year", () => {
    expect(describePeriod(yearMonths, "2026", yearMonths).kind).toBe("year");
  });
  it("meses consecutivos = range", () => {
    const p = describePeriod(["2026-01", "2026-02"], "2026", [...yearMonths, "2026-04"]);
    expect(p.kind).toBe("range");
    expect(p.label).toBe("Jan/26 → Fev/26");
  });
  it("meses esparsos = multi", () => {
    const p = describePeriod(["2026-01", "2026-03"], "2026", [...yearMonths, "2026-04"]);
    expect(p.kind).toBe("multi");
  });
});

describe("deltas", () => {
  it("delta absoluto arredonda 1 casa", () => {
    expect(absoluteDelta(10.26, 8)).toBe(2.3);
  });
  it("delta percentual", () => {
    expect(percentDelta(120, 100)).toBe(20);
    expect(percentDelta(80, 100)).toBe(-20);
  });
  it("base zero não é representável", () => {
    expect(percentDelta(10, 0)).toBeNull();
  });
});

describe("alignMonths / buildComparison", () => {
  const months = ["2026-01", "2026-02", "2026-03"];

  it("preenche meses sem dados com 0 e hasData=false", () => {
    const rows = alignMonths([{ month: "2026-01", value: 5 }], months);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ value: 5, hasData: true });
    expect(rows[1]).toMatchObject({ value: 0, hasData: false });
  });

  it("primeiro mês não tem variação", () => {
    const rows = buildComparison(
      [{ month: "2026-01", value: 10 }, { month: "2026-02", value: 15 }],
      months,
    );
    expect(rows[0].delta).toBeNull();
    expect(rows[1].delta).toBe(5);
    expect(rows[1].deltaPct).toBe(50);
  });
});

describe("summarizeSeries", () => {
  it("média considera apenas meses com dados", () => {
    const rows = alignMonths(
      [{ month: "2026-01", value: 10 }, { month: "2026-03", value: 20 }],
      ["2026-01", "2026-02", "2026-03"],
    );
    expect(summarizeSeries(rows)).toEqual({ total: 30, avg: 15, withData: 2 });
  });
  it("série vazia não divide por zero", () => {
    expect(summarizeSeries([])).toEqual({ total: 0, avg: 0, withData: 0 });
  });
});

describe("hasEnoughData", () => {
  it("exige amostra mínima de 3", () => {
    expect(hasEnoughData(2)).toBe(false);
    expect(hasEnoughData(3)).toBe(true);
  });
});
