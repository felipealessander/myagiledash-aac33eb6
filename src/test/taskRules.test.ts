import { describe, it, expect } from "vitest";
import {
  isArchivedStatus,
  isArchived,
  isDoneStatus,
  isDeadLetter,
  isBug,
  isIncident,
  isEpic,
  isQualidadeSquad,
  round1,
} from "@/lib/taskRules";

describe("taskRules — regras canônicas compartilhadas", () => {
  it("detecta arquivados por conteúdo do status (não só igualdade exata)", () => {
    expect(isArchivedStatus("Arquivado")).toBe(true);
    expect(isArchivedStatus(" arquivado ")).toBe(true);
    expect(isArchivedStatus("Arquivado (duplicado)")).toBe(true);
    expect(isArchivedStatus("Concluído")).toBe(false);
    expect(isArchivedStatus(null)).toBe(false);
    expect(isArchived({ status: "ARQUIVADO" })).toBe(true);
  });

  it("reconhece status concluído nas variações usadas no YouTrack", () => {
    for (const s of ["Concluído", "concluido", "Done", "Delivery"]) {
      expect(isDoneStatus(s)).toBe(true);
    }
    expect(isDoneStatus("Em Desenvolvimento")).toBe(false);
  });

  it("identifica DeadLetter por tag ou por tipo, com variações de grafia", () => {
    expect(isDeadLetter({ tags: ["DeadLetter"] })).toBe(true);
    expect(isDeadLetter({ tags: ["dead letter"] })).toBe(true);
    expect(isDeadLetter({ category: "Dead-Letter" })).toBe(true);
    expect(isDeadLetter({ category: "Tarefa", tags: [] })).toBe(false);
  });

  it("classifica bug, incidente e épico por tipo", () => {
    expect(isBug({ category: "Bug" })).toBe(true);
    expect(isBug({ category: "Bugs" })).toBe(true);
    expect(isIncident({ category: "incidente" })).toBe(true);
    expect(isIncident({ category: "Incidentes" })).toBe(true);
    expect(isEpic({ category: "Épico" })).toBe(true);
    expect(isEpic({ category: "epic" })).toBe(true);
    expect(isEpic({ category: "Tarefa" })).toBe(false);
  });

  it("identifica a squad Qualidade", () => {
    expect(isQualidadeSquad("Qualidade")).toBe(true);
    expect(isQualidadeSquad(" qualidade ")).toBe(true);
    expect(isQualidadeSquad("Golden Gate")).toBe(false);
  });

  it("arredonda com uma casa decimal", () => {
    expect(round1(3.14159)).toBe(3.1);
    expect(round1(2.05)).toBe(2.1);
  });
});
