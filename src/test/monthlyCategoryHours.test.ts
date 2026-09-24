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
    expect(result.outrosHours).toBe(1);
    expect(totalCategoryHours(result)).toBe(1);
  });

  it("mantém ajustes negativos para reconciliar com o total realizado", () => {
    const result = sumMonthlyCategoryHours([{ category: "Tarefa", spent_minutes: -60 }]);
    expect(totalCategoryHours(result)).toBe(-1);
  });
});