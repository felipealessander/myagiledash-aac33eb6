import { cn } from "@/lib/utils";
import type { CategoryName } from "@/data/dashboardData";

const categoryColors: Record<string, string> = {
  "Atendimento": "bg-info/15 text-info",
  "Auxílio técnico": "bg-primary/15 text-primary",
  "Erro script": "bg-destructive/15 text-destructive",
  "Incidente": "bg-warning/15 text-warning",
  "Melhoria": "bg-team-nan/15 text-team-nan",
  "Tarefa": "bg-team-code418/15 text-team-code418",
  "Épico": "bg-team-tesseract/15 text-team-tesseract",
};

interface TaskTableProps {
  categoryTotals: { name: CategoryName; hours: number; count: number }[];
}

export function TaskTable({ categoryTotals }: TaskTableProps) {
  const totalHours = categoryTotals.reduce((s, c) => s + c.hours, 0);
  const totalCount = categoryTotals.reduce((s, c) => s + c.count, 0);

  return (
    <div className="gradient-card rounded-lg border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "500ms" }}>
      <h3 className="text-sm font-semibold mb-1">Resumo por Categoria</h3>
      <p className="text-xs text-muted-foreground mb-4">Detalhamento de horas e tarefas por tipo</p>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground uppercase tracking-wider">Categoria</th>
              <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground uppercase tracking-wider">Tarefas</th>
              <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground uppercase tracking-wider">Horas</th>
              <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground uppercase tracking-wider">% Total</th>
            </tr>
          </thead>
          <tbody>
            {[...categoryTotals]
              .sort((a, b) => b.hours - a.hours)
              .map((cat) => (
                <tr key={cat.name} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", categoryColors[cat.name] || "bg-muted text-muted-foreground")}>
                      {cat.name}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{cat.count}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{cat.hours.toFixed(0)}h</td>
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    {totalHours > 0 ? ((cat.hours / totalHours) * 100).toFixed(1) : "0"}%
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30 font-semibold">
              <td className="py-2.5 px-3">Total</td>
              <td className="py-2.5 px-3 text-right font-mono">{totalCount}</td>
              <td className="py-2.5 px-3 text-right font-mono">{totalHours.toFixed(0)}h</td>
              <td className="py-2.5 px-3 text-right font-mono">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
