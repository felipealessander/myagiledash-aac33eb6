import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, CalendarRange, Clock, Gauge, Info, Users } from "lucide-react";
import type { MonthOption } from "@/hooks/useDashboardData";
import { useFlowTasks } from "@/hooks/useFlowTasks";
import {
  buildFlowComparison,
  buildOnDemandHistory,
  toComparisonChartData,
  type FlowMetricKind,
} from "@/lib/flowMetrics";

type SegmentKey = "general" | "onDemand" | "incidents";

const SEGMENT_LABEL: Record<SegmentKey, string> = {
  general: "Indicadores Gerais",
  onDemand: "Sob Demanda",
  incidents: "Incidentes",
};

const TYPE_LABEL: Record<string, string> = {
  regular: "Demanda regular",
  bug: "Bug",
  deadletter: "DeadLetter",
  incident: "Incidente",
};


const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "11px",
  color: "hsl(var(--foreground))",
};

interface Props {
  months: MonthOption[];
  selectedMonth: string;
  selectedSquads: string[];
}

function MetricComparisonChart({
  title,
  icon: Icon,
  data,
}: {
  title: string;
  icon: typeof Clock;
  data: { label: string; media: number; mediana: number; p85: number; volume: number }[];
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h4 className="text-xs font-semibold flex items-center gap-2 mb-3">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {title} <span className="text-muted-foreground font-normal">(dias úteis)</span>
      </h4>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} />
          <Legend wrapperStyle={{ fontSize: "10px" }} />
          <Bar yAxisId="left" dataKey="mediana" name="Mediana" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="media" name="Média" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="p85" name="P85" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="volume" name="Itens concluídos" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FlowMetricsWidget({ months, selectedMonth, selectedSquads }: Props) {
  const monthOnly = useMemo(() => months.filter(m => !m.value.startsWith("year-")), [months]);

  const defaultSelection = useMemo(() => {
    const sorted = monthOnly.map(m => m.value).sort().reverse();
    const anchor = selectedMonth.startsWith("year-") ? sorted[0] : selectedMonth;
    const idx = Math.max(0, sorted.indexOf(anchor));
    return sorted.slice(idx, idx + 3);
  }, [monthOnly, selectedMonth]);

  const [manualSelection, setManualSelection] = useState<string[] | null>(null);
  const selection = manualSelection ?? defaultSelection;

  const historyValues = useMemo(() => monthOnly.map(m => m.value).sort(), [monthOnly]);
  const neededValues = useMemo(
    () => Array.from(new Set([...selection, ...historyValues])),
    [selection, historyValues],
  );
  const { tasksByPeriod, loading } = useFlowTasks(months, neededValues);

  const periods = useMemo(
    () =>
      selection
        .slice()
        .sort()
        .map(v => ({ value: v, label: monthOnly.find(m => m.value === v)?.label || v })),
    [selection, monthOnly],
  );

  const [includeBugs, setIncludeBugs] = useState(false);
  const [includeDeadletters, setIncludeDeadletters] = useState(false);
  const inclusion = useMemo(
    () => ({ bugs: includeBugs, deadletters: includeDeadletters }),
    [includeBugs, includeDeadletters],
  );

  const includedTypesLabel = useMemo(() => {
    const parts = ["Demandas regulares"];
    if (includeBugs) parts.push("Bugs");
    if (includeDeadletters) parts.push("DeadLetters");
    return parts.join(" + ");
  }, [includeBugs, includeDeadletters]);

  const comparison = useMemo(
    () => buildFlowComparison(tasksByPeriod, periods, { squads: selectedSquads, inclusion }),
    [tasksByPeriod, periods, selectedSquads, inclusion],
  );

  const history = useMemo(
    () =>
      buildOnDemandHistory(
        tasksByPeriod,
        historyValues.map(v => ({ value: v, label: monthOnly.find(m => m.value === v)?.label || v })),
        { squads: selectedSquads, inclusion },
      ),
    [tasksByPeriod, historyValues, monthOnly, selectedSquads, inclusion],
  );

  const toggleMonth = (value: string) => {
    const current = selection;
    if (current.includes(value)) {
      const next = current.filter(v => v !== value);
      setManualSelection(next.length > 0 ? next : current);
      return;
    }
    if (current.length >= 3) return;
    setManualSelection([...current, value]);
  };

  const segmentHint = (segment: SegmentKey) => {
    if (segment === "incidents")
      return "Incidente, Bug e DeadLetter — visão separada e sempre completa, independente das opções de inclusão acima.";
    const base =
      segment === "general"
        ? "Itens concluídos no mês (data de fechamento)."
        : "Itens com cliente vinculado concluídos no mês (data de fechamento).";
    return `${base} Participando do cálculo: ${includedTypesLabel}. Incidentes nunca entram.`;
  };

  const renderSegment = (segment: SegmentKey) => {
    const chart = (metric: FlowMetricKind) => toComparisonChartData(comparison, segment, metric);
    const latest = comparison[comparison.length - 1]?.metrics[segment];

    return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {segmentHint(segment)}
        </p>


        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Concluídos no mês", value: latest?.completed ?? 0 },
            { label: "Em aberto", value: latest?.open ?? 0 },
            { label: "Reabertos / retorno", value: latest?.reopened ?? 0 },
            { label: "Sem data de início", value: latest?.missingStart ?? 0 },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-semibold">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MetricComparisonChart title="Lead Time — Criação → Conclusão" icon={Clock} data={chart("lead")} />
          <MetricComparisonChart title="Cycle Time — Início do Dev → Conclusão" icon={Gauge} data={chart("cycle")} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 font-medium">Mês</th>
                <th className="text-right py-2 font-medium">Itens</th>
                <th className="text-right py-2 font-medium">Lead mediana</th>
                <th className="text-right py-2 font-medium">Lead P85</th>
                <th className="text-right py-2 font-medium">Cycle mediana</th>
                <th className="text-right py-2 font-medium">Cycle P85</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map(c => {
                const seg = c.metrics[segment];
                return (
                  <tr key={c.periodKey} className="border-b border-border/50">
                    <td className="py-2">{c.label}</td>
                    <td className="py-2 text-right">{seg.completed}</td>
                    <td className="py-2 text-right">{seg.leadTime.median}d</td>
                    <td className="py-2 text-right">{seg.leadTime.p85}d</td>
                    <td className="py-2 text-right">{seg.cycleTime.median}d</td>
                    <td className="py-2 text-right">{seg.cycleTime.p85}d</td>
                  </tr>
                );
              })}
              {comparison.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">Selecione ao menos um mês.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {latest && latest.bySquad.length > 0 && (
          <div className="rounded-lg border border-border p-4">
            <h4 className="text-xs font-semibold flex items-center gap-2 mb-3">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              Por squad — {comparison[comparison.length - 1]?.label}
            </h4>
            <ResponsiveContainer width="100%" height={Math.max(180, latest.bySquad.length * 34)}>
              <BarChart data={latest.bySquad} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="squad" width={90} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Bar dataKey="leadMedian" name="Lead (mediana)" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="cycleMedian" name="Cycle (mediana)" fill="hsl(var(--info))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Indicadores de Fluxo — Lead Time & Cycle Time
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Dias úteis, considerando o mês de conclusão. Incidentes têm visão própria.
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-2">
                <CalendarRange className="h-3.5 w-3.5" />
                Comparar meses ({selection.length}/3)
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2 max-h-72 overflow-y-auto">
              <p className="text-[11px] text-muted-foreground px-1 pb-2">Selecione até 3 meses</p>
              {monthOnly.map(m => {
                const checked = selection.includes(m.value);
                return (
                  <label
                    key={m.value}
                    className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted cursor-pointer text-xs"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!checked && selection.length >= 3}
                      onCheckedChange={() => toggleMonth(m.value)}
                    />
                    {m.label}
                  </label>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-2">
          {periods.map(p => (
            <Badge key={p.value} variant="secondary" className="text-[10px]">{p.label}</Badge>
          ))}
          {selectedSquads.length > 0 && (
            <Badge variant="outline" className="text-[10px]">Squads: {selectedSquads.join(", ")}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Carregando indicadores…</p>
        ) : (
          <Tabs defaultValue="general">
            <TabsList className="h-8">
              {(Object.keys(SEGMENT_LABEL) as SegmentKey[]).map(k => (
                <TabsTrigger key={k} value={k} className="text-xs">{SEGMENT_LABEL[k]}</TabsTrigger>
              ))}
              <TabsTrigger value="history" className="text-xs">Histórico Sob Demanda</TabsTrigger>
            </TabsList>

            {(Object.keys(SEGMENT_LABEL) as SegmentKey[]).map(k => (
              <TabsContent key={k} value={k} className="mt-4">
                {renderSegment(k)}
              </TabsContent>
            ))}

            <TabsContent value="history" className="mt-4 space-y-4">
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Evolução mês a mês dos itens com cliente vinculado (Sob Demanda), com volume, horas apontadas e indicadores de fluxo.
              </p>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Sem meses disponíveis.</p>
              ) : (
                <>
                  <div className="rounded-lg border border-border p-4">
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={history} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} />
                        <Legend wrapperStyle={{ fontSize: "10px" }} />
                        <Bar yAxisId="left" dataKey="completed" name="Concluídos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="open" name="Em aberto" fill="hsl(var(--muted-foreground) / 0.5)" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="leadMedian" name="Lead (mediana)" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="right" type="monotone" dataKey="cycleMedian" name="Cycle (mediana)" stroke="hsl(var(--info))" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left py-2 font-medium">Mês</th>
                          <th className="text-right py-2 font-medium">Concluídos</th>
                          <th className="text-right py-2 font-medium">Em aberto</th>
                          <th className="text-right py-2 font-medium">Clientes</th>
                          <th className="text-right py-2 font-medium">Horas</th>
                          <th className="text-right py-2 font-medium">Lead P85</th>
                          <th className="text-right py-2 font-medium">Cycle P85</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(h => (
                          <tr key={h.periodKey} className="border-b border-border/50">
                            <td className="py-2">{h.label}</td>
                            <td className="py-2 text-right">{h.completed}</td>
                            <td className="py-2 text-right">{h.open}</td>
                            <td className="py-2 text-right">{h.clients}</td>
                            <td className="py-2 text-right">{h.hours.toFixed(1)}h</td>
                            <td className="py-2 text-right">{h.leadP85}d</td>
                            <td className="py-2 text-right">{h.cycleP85}d</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
