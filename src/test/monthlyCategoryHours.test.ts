import { describe, expect, it } from "vitest";
import { sumMonthlyCategoryHours, totalCategoryHours } from "@/lib/monthlyCategoryHours";

describe("horas mensais por categoria", () => {
  it("converte minutos em horas e reconcilia com o total realizado", () => {
    const result = sumMonthlyCategoryHours([
      { category: "Tarefa", spent_minutes: 90, status: "Concluído" },
      { category: "Melhoria", spent_minutes: 30, status: "Concluído" },
      { category: "Épico", spent_minutes: 120, status: "Concluído" },
    ]);

    expect(result.tarefasHours).toBe(1.5);
    expect(result.melhoriasHours).toBe(0.5);
    expect(result.epicosHours).toBe(2);
    expect(totalCategoryHours(result)).toBe(4);
  });

  it("consolida tipos legados em Incidente sem duplicar DeadLetter", () => {
    const result = sumMonthlyCategoryHours([
      { category: "Bug", spent_minutes: 60 },
      { category: "Defeito", spent_minutes: 60 },
      { category: "Erro script", spent_minutes: 60 },
      { category: "Bug", tags: ["dead letter"], spent_minutes: 120 },
    ]);

    expect(result.incidentesHours).toBe(3);
    expect(result.deadLettersHours).toBe(2);
    expect(totalCategoryHours(result)).toBe(5);
  });

  it("exclui arquivados e mantém tipos não mapeados em Outros", () => {
    const result = sumMonthlyCategoryHours([
      { category: "Tarefa", spent_minutes: 600, status: "Arquivado" },
      { category: "Infraestrutura", spent_minutes: 45, status: "Concluído" },
      { category: null, spent_minutes: 15, status: "Concluído" },
    ]);

    expect(result.tarefasHours).toBe(0);
    expect(result.infraestruturaHours).toBe(0.75);
    expect(result.outrosHours).toBe(0.25);
    expect(totalCategoryHours(result)).toBe(1);
  });

  it("mantém ajustes negativos para reconciliar com o total realizado", () => {
    const result = sumMonthlyCategoryHours([{ category: "Tarefa", spent_minutes: -60 }]);
    expect(totalCategoryHours(result)).toBe(-1);
  });

  it("separa Atendimento, Planejamento, Auxílio técnico e Orientação", () => {
    const r = sumMonthlyCategoryHours([
      { category: "Atendimento", spent_minutes: 60 },
      { category: "Planejamento", spent_minutes: 120 },
      { category: "Auxílio técnico", spent_minutes: 180 },
      { category: "Orientação", spent_minutes: 240 },
    ]);
    expect(r.atendimentoHours).toBe(1);
    expect(r.planejamentoHours).toBe(2);
    expect(r.auxilioTecnicoHours).toBe(3);
    expect(r.orientacaoHours).toBe(4);
    expect(r.outrosHours).toBe(0);
    expect(totalCategoryHours(r)).toBe(10);
  });
});
