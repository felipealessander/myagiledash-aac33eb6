import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, LabelList,
} from "recharts";
import { ChevronLeft, ChevronRight, Timer, Gauge, Clock, PackageX, Presentation } from "lucide-react";
import { buildPresentationMetrics, type PresentationTask } from "@/lib/presentationMetrics";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: PresentationTask[];
  monthLabel: string;
  selectedSquads: string[];
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};
const axisTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const grid = "hsl(var(--border))";

function StatCard({
  label, value, hint, tone = "default",
}: { label: string; value: string; hint?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneClass =
    tone === "good" ? "border-l-[hsl(160,84%,39%)]"
      : tone === "warn" ? "border-l-[hsl(38,92%,50%)]"
        : tone === "bad" ? "border-l-destructive"
          : "border-l-primary";
  return (
    <div className={`rounded-lg border border-border border-l-4 ${toneClass} bg-card p-4`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function SlideShell({
  icon: Icon, title, subtitle, children,
}: { icon: any; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground text-center py-12">{text}</p>;
}

export function PresentationModal({ open, onOpenChange, tasks, monthLabel, selectedSquads }: Props) {
  const [slide, setSlide] = useState(0);

  const metrics = useMemo(
    () => buildPresentationMetrics(tasks, { monthLabel, selectedSquads }),
    [tasks, monthLabel, selectedSquads],
  );

  useEffect(() => { if (open) setSlide(0); }, [open]);

  const { mttr, cycleTime, timeLogging, dlq } = metrics;

  const loggingTone = timeLogging.overallPct >= 90 ? "good" : timeLogging.overallPct >= 75 ? "warn" : "bad";
  const loggingColor = (pct: number) =>
    pct >= 90 ? "hsl(160, 84%, 39%)" : pct >= 75 ? "hsl(38, 92%, 50%)" : "hsl(0, 72%, 51%)";

  const slides = [
    {
      key: "capa",
      node: (
        <div className="flex flex-col items-center justify-center h-full text-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Presentation className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Resultados do Período</h1>
          <p className="text-lg text-muted-foreground">{monthLabel}</p>
          <p className="text-xs text-muted-foreground max-w-lg">
            {selectedSquads.length > 0
              ? `Times: ${metrics.squads.join(", ")}`
              : `Todos os times (${metrics.squads.length})`} · {metrics.taskCount} atividades consideradas
            (itens arquivados excluídos)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl mt-4">
            <StatCard label="MTTR (mediana)" value={`${mttr.overall.median}h`} hint={`${mttr.resolvedIncidents} incidentes`} />
            <StatCard label="Cycle Time (mediana)" value={`${cycleTime.overall.median}d`} hint={`${cycleTime.consideredTasks} entregas`} />
            <StatCard label="Apontamento" value={`${timeLogging.overallPct}%`} hint={`${timeLogging.totalSpentHours}h lançadas`} tone={loggingTone} />
            <StatCard label="DLQ" value={`${dlq.count}`} hint={`${dlq.hours}h · ${dlq.sharePct}% do volume`} tone={dlq.sharePct > 10 ? "bad" : "default"} />
          </div>
        </div>
      ),
    },
    {
      key: "mttr",
      node: (
        <SlideShell icon={Timer} title="MTTR — Tempo Médio de Resolução" subtitle="Incidentes: abertura → resolução, descontando tempo interrompido (horas). DeadLetter contabilizado à parte.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Mediana" value={`${mttr.overall.median}h`} />
            <StatCard label="Média" value={`${mttr.overall.avg}h`} />
            <StatCard label="P85" value={`${mttr.overall.p85}h`} tone="warn" />
            <StatCard label="Em aberto" value={`${mttr.openIncidents}`} hint="Sem data de resolução" tone={mttr.openIncidents > 0 ? "bad" : "good"} />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold mb-3">DeadLetter (DLQ) — contabilizado à parte</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="MTTR DLQ (mediana)" value={`${mttr.deadLetter.median}h`} />
              <StatCard label="Média DLQ" value={`${mttr.deadLetter.avg}h`} />
              <StatCard label="Resolvidos DLQ" value={`${mttr.resolvedDeadLetterIncidents}`} />
              <StatCard label="Em aberto DLQ" value={`${mttr.openDeadLetterIncidents}`} tone={mttr.openDeadLetterIncidents > 0 ? "bad" : "good"} />
            </div>
          </div>
          {mttr.bySquad.length === 0 ? (
            <EmptyState text="Nenhum incidente resolvido no período selecionado." />
          ) : (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold mb-3">MTTR por time (horas) — sem DeadLetter</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mttr.bySquad} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis dataKey="key" tick={axisTick} />
                  <YAxis tick={axisTick} unit="h" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v}h`, n]} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="median" name="Mediana" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="p85" name="P85" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SlideShell>

      ),
    },
    {
      key: "cycle",
      node: (
        <SlideShell icon={Gauge} title="Cycle Time" subtitle="Início do desenvolvimento → conclusão, descontando tempo interrompido (dias). Épicos e squad Qualidade fora.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Mediana" value={`${cycleTime.overall.median}d`} />
            <StatCard label="Média" value={`${cycleTime.overall.avg}d`} />
            <StatCard label="P85" value={`${cycleTime.overall.p85}d`} tone="warn" />
            <StatCard label="Entregas" value={`${cycleTime.consideredTasks}`} hint={`${cycleTime.skippedNoDates} sem datas`} />
          </div>
          {cycleTime.bySquad.length === 0 ? (
            <EmptyState text="Nenhuma entrega com data de início e conclusão no período." />
          ) : (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold mb-3">Cycle Time por time (dias)</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={cycleTime.bySquad} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis dataKey="key" tick={axisTick} />
                  <YAxis tick={axisTick} unit="d" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v}d`, n]} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="median" name="Mediana" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="p85" name="P85" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SlideShell>
      ),
    },
    {
      key: "apontamento",
      node: (
        <SlideShell icon={Clock} title="% de Apontamento de Horas" subtitle="Percentual de atividades com horas lançadas no YouTrack">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Aderência" value={`${timeLogging.overallPct}%`} tone={loggingTone as any} />
            <StatCard label="Com apontamento" value={`${timeLogging.tasksWithHours}`} tone="good" />
            <StatCard label="Sem apontamento" value={`${timeLogging.tasksWithoutHours}`} tone="bad" />
            <StatCard label="Horas lançadas" value={`${timeLogging.totalSpentHours}h`} />
          </div>
          {timeLogging.bySquad.length === 0 ? (
            <EmptyState text="Sem atividades no período selecionado." />
          ) : (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold mb-3">Aderência por time (meta: 90%)</p>
              <ResponsiveContainer width="100%" height={Math.max(220, timeLogging.bySquad.length * 38)}>
                <BarChart data={timeLogging.bySquad} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={axisTick} />
                  <YAxis type="category" dataKey="squad" width={120} tick={axisTick} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, _n, p: any) => [`${v}% (${p.payload.withHours}/${p.payload.total})`, "Apontamento"]}
                  />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                    {timeLogging.bySquad.map(row => (
                      <Cell key={row.squad} fill={loggingColor(row.pct)} />
                    ))}
                    <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SlideShell>
      ),
    },
    {
      key: "dlq",
      node: (
        <SlideShell icon={PackageX} title="DLQ — DeadLetter" subtitle="Itens identificados por tag ou tipo DeadLetter no YouTrack">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Itens DLQ" value={`${dlq.count}`} tone={dlq.count > 0 ? "warn" : "good"} />
            <StatCard label="Horas em DLQ" value={`${dlq.hours}h`} />
            <StatCard label="% do volume" value={`${dlq.sharePct}%`} tone={dlq.sharePct > 10 ? "bad" : "default"} />
            <StatCard label="% do esforço" value={`${dlq.hoursSharePct}%`} tone={dlq.hoursSharePct > 10 ? "bad" : "default"} />
          </div>
          {dlq.count === 0 ? (
            <EmptyState text="Nenhum item DeadLetter no período — ótimo resultado." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold mb-3">DLQ por time</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dlq.bySquad} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                    <XAxis dataKey="key" tick={axisTick} />
                    <YAxis tick={axisTick} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="count" name="Itens" fill="hsl(280, 67%, 56%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="hours" name="Horas" fill="hsl(280, 67%, 76%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold mb-3">DLQ por cliente</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dlq.byClient.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                    <XAxis type="number" tick={axisTick} allowDecimals={false} />
                    <YAxis type="category" dataKey="key" width={120} tick={axisTick} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Itens" fill="hsl(280, 67%, 56%)" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
                <p className="text-xs font-semibold mb-3">
                  Cards DeadLetter no mês ({dlq.items.length})
                </p>
                <div className="max-h-[240px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card">
                      <tr className="text-muted-foreground text-left">
                        <th className="py-1 pr-2 font-medium">Card</th>
                        <th className="py-1 pr-2 font-medium">Título</th>
                        <th className="py-1 pr-2 font-medium">Time</th>
                        <th className="py-1 pr-2 font-medium">Cliente</th>
                        <th className="py-1 pr-2 font-medium">Status</th>
                        <th className="py-1 pr-2 font-medium">Identificado por</th>
                        <th className="py-1 text-right font-medium">Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dlq.items.map(item => (
                        <tr key={item.taskCode} className="border-t border-border/50">
                          <td className="py-1 pr-2 font-mono">{item.taskCode}</td>
                          <td className="py-1 pr-2 max-w-[260px] truncate" title={item.title}>{item.title}</td>
                          <td className="py-1 pr-2">{item.squad}</td>
                          <td className="py-1 pr-2">{item.client}</td>
                          <td className="py-1 pr-2">{item.status}</td>
                          <td className="py-1 pr-2">
                            <span className="rounded bg-muted px-1.5 py-0.5" title={item.matchedValue}>
                              {item.matchedBy}
                            </span>
                          </td>
                          <td className="py-1 text-right tabular-nums">{item.hours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </SlideShell>
      ),
    },
  ];

  const total = slides.length;
  const go = (delta: number) => setSlide(s => Math.min(total - 1, Math.max(0, s + delta)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl w-[95vw] h-[88vh] p-0 gap-0 flex flex-col"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        <div className="flex-1 min-h-0 p-8 pb-4">{slides[slide].node}</div>
        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.key}
                aria-label={`Ir para slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/40"}`}
              />
            ))}
            <span className="text-[11px] text-muted-foreground ml-3">{slide + 1} / {total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={slide === 0} className="gap-1">
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </Button>
            <Button size="sm" onClick={() => go(1)} disabled={slide === total - 1} className="gap-1">
              Próximo <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
