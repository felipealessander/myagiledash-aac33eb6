import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface DrillDownTask {
  task_code: string;
  title: string | null;
  category: string | null;
  squad: string | null;
  status: string | null;
  client?: string | null;
  created_at_yt?: string | null;
  resolved_at?: string | null;
  spent_minutes?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  tasks: DrillDownTask[];
  pageSize?: number;
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

/**
 * Painel de rastreabilidade: lista paginada dos cards que compõem um valor.
 * A soma das horas exibidas corresponde ao total do indicador de origem.
 */
export function DrillDownSheet({ open, onOpenChange, title, subtitle, tasks, pageSize = 10 }: Props) {
  const [page, setPage] = useState(0);

  const totalHours = useMemo(
    () => tasks.reduce((s, t) => s + (t.spent_minutes || 0) / 60, 0),
    [tasks],
  );

  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const current = Math.min(page, totalPages - 1);
  const visible = tasks.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPage(0); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </DialogHeader>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span><strong className="text-foreground font-mono">{tasks.length}</strong> card(s)</span>
          <span><strong className="text-foreground font-mono">{totalHours.toFixed(1)}h</strong> apontadas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 text-left">Card</th>
                <th className="py-2 pr-3 text-left">Título</th>
                <th className="py-2 pr-3 text-left">Squad</th>
                <th className="py-2 pr-3 text-left">Tipo</th>
                <th className="py-2 pr-3 text-left">Status</th>
                <th className="py-2 pr-3 text-left">Aberto</th>
                <th className="py-2 pr-3 text-left">Fechado</th>
                <th className="py-2 text-right">Horas</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(t => (
                <tr key={t.task_code} className="border-b border-border/50">
                  <td className="py-2 pr-3">
                    <a
                      href={`https://youtrack.attus.ai/issue/${t.task_code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {t.task_code}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="py-2 pr-3 max-w-[260px] truncate">{t.title || "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{t.squad || "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{t.category || "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{t.status || "—"}</td>
                  <td className="py-2 pr-3 font-mono text-muted-foreground">{fmtDate(t.created_at_yt)}</td>
                  <td className="py-2 pr-3 font-mono text-muted-foreground">{fmtDate(t.resolved_at)}</td>
                  <td className="py-2 text-right font-mono">{((t.spent_minutes || 0) / 60).toFixed(1)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Nenhum card encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Página {current + 1} de {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={current === 0} onClick={() => setPage(current - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={current >= totalPages - 1} onClick={() => setPage(current + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
