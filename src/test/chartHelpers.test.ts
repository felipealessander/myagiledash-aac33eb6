import { describe, it, expect } from "vitest";
import { linearTrend, variation, withTrend, splitBySufficiency, hasSufficientData, buildTrendMask } from "@/lib/chartHelpers";

describe("chartHelpers — linha de tendência", () => {
  it("retorna vazio sem dados", () => {
    expect(linearTrend([])).toEqual([]);
  });

  it("mantém o valor único quando há um só mês", () => {
    expect(linearTrend([7])).toEqual([7]);
  });

  it("acompanha crescimento linear exato", () => {
    expect(linearTrend([10, 20, 30, 40])).toEqual([10, 20, 30, 40]);
  });

  it("suaviza uma série com ruído sem alterar os valores reais", () => {
    const values = [10, 30, 20, 40, 30, 50];
    const trend = linearTrend(values);
    expect(trend).toHaveLength(values.length);
    expect(trend[trend.length - 1]).toBeGreaterThan(trend[0]); // tendência de alta
    expect(values).toEqual([10, 30, 20, 40, 30, 50]); // não muta a entrada
  });

  it("é estável para série constante", () => {
    expect(linearTrend([5, 5, 5])).toEqual([5, 5, 5]);
  });

  it("detecta tendência de queda", () => {
    const t = linearTrend([50, 40, 35, 20]);
    expect(t[3]).toBeLessThan(t[0]);
  });
});

describe("chartHelpers — variação", () => {
  it("calcula variação absoluta e percentual", () => {
    expect(variation(50, 60)).toEqual({ abs: 10, pct: 20 });
  });

  it("retorna percentual nulo quando o mês anterior é zero", () => {
    expect(variation(0, 12)).toEqual({ abs: 12, pct: null });
  });

  it("suporta variação negativa", () => {
    expect(variation(80, 60)).toEqual({ abs: -20, pct: -25 });
  });
});

describe("chartHelpers — série mensal com tendência", () => {
  const rows = [
    { month: "2026-01", label: "Janeiro 2026", count: 10 },
    { month: "2026-02", label: "Fevereiro 2026", count: 0 },
    { month: "2026-03", label: "Março 2026", count: 20 },
  ];

  it("mantém os meses sem registros visíveis com valor zero", () => {
    const out = withTrend(rows, "count");
    expect(out).toHaveLength(3);
    expect(out[1].count).toBe(0);
  });

  it("não calcula variação para o primeiro mês", () => {
    const out = withTrend(rows, "count");
    expect(out[0].deltaPct).toBeNull();
  });

  it("calcula a variação mês a mês", () => {
    const out = withTrend(rows, "count");
    expect(out[1].deltaAbs).toBe(-10);
    expect(out[2].deltaAbs).toBe(20);
    expect(out[2].deltaPct).toBeNull(); // mês anterior zerado
  });

  it("preserva os valores reais junto da tendência", () => {
    const out = withTrend(rows, "count");
    expect(out.map(r => r.count)).toEqual([10, 0, 20]);
    expect(out.every(r => typeof r.trend === "number")).toBe(true);
  });
});

describe("chartHelpers — dados insuficientes", () => {
  const squads = [
    { squad: "Code418", count: 61, median: 12 },
    { squad: "Golden Gate", count: 43, median: 4 },
    { squad: "Code402", count: 0, median: 0 },
  ];

  it("mantém squads com amostra e separa as sem dados", () => {
    const { withData, insufficient } = splitBySufficiency(squads);
    expect(withData.map(s => s.squad)).toEqual(["Code418", "Golden Gate"]);
    expect(insufficient.map(s => s.squad)).toEqual(["Code402"]);
  });

  it("Code418 nunca é tratada como insuficiente quando possui cards válidos", () => {
    const { insufficient } = splitBySufficiency(squads);
    expect(insufficient.some(s => s.squad === "Code418")).toBe(false);
  });

  it("aplica a mesma regra para todas as squads", () => {
    const { withData } = splitBySufficiency([
      { squad: "A", count: 1 },
      { squad: "B", count: 1 },
      { squad: "C", count: 0 },
    ]);
    expect(withData).toHaveLength(2);
  });

  it("respeita amostra mínima customizada", () => {
    expect(hasSufficientData(2, 3)).toBe(false);
    expect(hasSufficientData(3, 3)).toBe(true);
  });

  it("lida com lista vazia", () => {
    expect(splitBySufficiency([])).toEqual({ withData: [], insufficient: [] });
  });
});

describe("linearTrend com máscara de períodos sem dados", () => {
  it("mantém inclinação positiva ignorando meses zerados", () => {
    const values = [10, 20, 30, 0];
    const mask = [true, true, true, false];
    const trend = linearTrend(values, mask);
    expect(trend[3]).toBeGreaterThan(trend[0]);
  });

  it("sem máscara, o zero final derruba a tendência", () => {
    const trend = linearTrend([10, 20, 30, 0]);
    expect(trend[3]).toBeLessThan(trend[0]);
  });
});

describe("buildTrendMask — períodos comparáveis", () => {
  const NOW = new Date("2026-08-03T00:00:00Z");

  it("exclui o mês corrente (parcial) e mantém a inclinação real de alta", () => {
    const values = [10, 20, 30, 2]; // último = mês corrente, ainda em curso
    const months = ["2026-05", "2026-06", "2026-07", "2026-08"];
    const mask = buildTrendMask(values, months, { now: NOW });
    expect(mask).toEqual([true, true, true, false]);
    const trend = linearTrend(values, mask);
    expect(trend[3]).toBeGreaterThan(trend[0]);
  });

  it("exclui meses sem dados sem inverter a tendência", () => {
    const values = [0, 5, 10, 15];
    const months = ["2026-01", "2026-02", "2026-03", "2026-04"];
    const mask = buildTrendMask(values, months, { now: NOW });
    expect(mask).toEqual([false, true, true, true]);
    const trend = linearTrend(values, mask);
    expect(trend[3]).toBeGreaterThan(trend[1]);
  });

  it("usa hasData quando informado (zero legítimo continua fora)", () => {
    const values = [4, 0, 6];
    const mask = buildTrendMask(values, ["2026-01", "2026-02", "2026-03"], {
      hasData: [true, true, true],
      now: NOW,
    });
    expect(mask).toEqual([true, true, true]);
  });

  it("volta a considerar todos os meses com dados quando sobrariam menos de 2 pontos", () => {
    const values = [0, 8];
    const mask = buildTrendMask(values, ["2026-07", "2026-08"], { now: NOW });
    expect(mask).toBeUndefined();
  });
});
