import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isArchived, isIncident, isDeadLetter, isBug, isDoneStatus } from "@/lib/taskRules";

export interface IncidentListTask {
  task_code: string;
  title: string | null;
  category: string | null;
  squad: string | null;
  assignee: string | null;
  status: string | null;
  client: string | null;
  created_at_yt: string | null;
  resolved_at: string | null;
  spent_minutes: number | null;
  tags: string[] | null;
}

interface Props {
  tasks: IncidentListTask[];
  selectedSquads?: string[];
  pageSize?: number;
}

type Kind = "todos" | "incidente" | "bug" | "dlq";

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export function IncidentsList({ tasks, selectedSquads = [], pageSize = 10 }: Props) {
  const [kind, setKind] = useState<Kind>("todos");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const map = new Map<string, IncidentListTask>();
    for (const t of tasks) {
      if (isArchived(t)) continue;
      if (!(isIncident(t) || isBug(t) || isDeadLetter(t))) continue;
      if (selectedSquads.length > 0 && !selectedSquads.includes(t.squad || "Sem Squad")) continue;
      if (!map.has(t.task_code)) map.set(t.task_code, t);
    }
    let list = Array.from(map.values());
    if (kind === "incidente") list = list.filter(t => isIncident(t) && !isDeadLetter(t));
    if (kind === "bug") list = list.filter(t => isBug(t) && !isDeadLetter(t));
    if (kind === "dlq") list = list.filter(isDeadLetter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        [t.task_code, t.title, t.squad, t.client, t.assignee]
          .some(v => (v || "").toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => {
      const da = a.created_at_yt ? new Date(a.created_at_yt).getTime() : 0;
      const db = b.created_at_yt ? new Date(b.created_at_yt).getTime() : 0;
      return db - da;
    });
  }, [tasks, selectedSquads, kind, query]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages - 1);
  const visible = rows.slice(current * pageSize, current * pageSize + pageSize);

  const kinds: { key: Kind; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "incidente", label: "Incidentes" },
    { key: "bug", label: "Bugs" },
    { key: "dlq", label: "DLQ" },
  ];

  return (
    <div className="gradient-card rounded-lg border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ListFilter className="h-3.5 w-3.5" />
            Cards do período
          </h3>
          <p className="text-xs text-muted-foreground">
            {rows.length} card(s) — incidentes, bugs e DeadLetter (arquivados excluídos)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {kinds.map(k => (
              <button
                key={k.key}
                onClick={() => { setKind(k.key); setPage(0); }}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium border transition-colors ${
                  kind === k.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(0); }}
            placeholder="Buscar card, squad, cliente…"
            className="h-8 w-52 text-xs"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Nenhum card no período com os filtros atuais.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left font-medium py-2 pr-3">Card</th>
                  <th className="text-left font-medium py-2 pr-3">Título</th>
                  <th className="text-left font-medium py-2 pr-3">Squad</th>
                  <th className="text-left font-medium py-2 pr-3">Cliente</th>
                  <th className="text-left font-medium py-2 pr-3">Status</th>
                  <th className="text-left font-medium py-2 pr-3">Criado</th>
                  <th className="text-left font-medium py-2 pr-3">Concluído</th>
                  <th className="text-right font-medium py-2">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(t => (
                  <tr key={t.task_code} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <a
                        href={`https://youtrack.attus.ai/issue/${t.task_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-semibold text-primary inline-flex items-center gap-1"
                      >
                        {t.task_code}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="py-2 pr-3 max-w-[280px] truncate">{t.title || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{t.squad || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{t.client || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className={isDoneStatus(t.status) ? "text-success" : "text-warning"}>
                        {t.status || "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground font-mono">{fmtDate(t.created_at_yt)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground font-mono">{fmtDate(t.resolved_at)}</td>
                    <td className="py-2 text-right font-mono">{((t.spent_minutes || 0) / 60).toFixed(1)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3">
            <p className="text-[10px] text-muted-foreground">
              Página {current + 1} de {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={current === 0} onClick={() => setPage(current - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={current >= totalPages - 1} onClick={() => setPage(current + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
