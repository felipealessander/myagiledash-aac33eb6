import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, AlertTriangle, Info, TrendingUp, TrendingDown, Minus, ListChecks } from "lucide-react";
import { useClientsData } from "@/hooks/useClientsData";
import { useClientHoursTrend } from "@/hooks/useClientHoursTrend";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, Cell, LineChart, Line, ReferenceLine,
} from "recharts";
import { ClientHoursComparison } from "./ClientHoursComparison";
import type { MonthOption } from "@/hooks/useDashboardData";


interface Props {
  selectedMonth: string;
  months: MonthOption[];
}

// Utilization band classification
type Band = "red-low" | "yellow-low" | "green" | "yellow-high" | "red-high" | "none";
function classifyUtilization(contracted: number, spent: number): Band {
  if (contracted === 0) return "none";
  const pct = (spent / contracted) * 100;
  if (pct < 70) return "red-low";
  if (pct < 90) return "yellow-low";
  if (pct <= 110) return "green";
  if (pct <= 120) return "yellow-high";
  return "red-high";
}
const BAND_COLOR: Record<Band, string> = {
  "green": "hsl(142 71% 45%)",
  "yellow-low": "hsl(38 92% 55%)",
  "yellow-high": "hsl(38 92% 55%)",
  "red-low": "hsl(0 72% 55%)",
  "red-high": "hsl(0 72% 55%)",
  "none": "hsl(var(--muted-foreground))",
};

// Tiny inline sparkline (no deps)
function Sparkline({ values, color = "hsl(var(--primary))", width = 80, height = 24 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={pts} />
      {values.map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return <circle key={i} cx={x} cy={y} r={1.8} fill={color} />;
      })}
    </svg>
  );
}

function monthShortLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export function ClientHoursWidget({ selectedMonth, months }: Props) {
  const { usage, loading, unmappedClients } = useClientsData(selectedMonth);
  const { points: trend, loading: trendLoading } = useClientHoursTrend(selectedMonth, 3);

  const data = useMemo(() => {
    return usage
      .filter(u => u.contractedHours > 0 || u.spentHours > 0)
      .sort((a, b) => b.contractedHours - a.contractedHours)
      .map(u => ({
        name: u.client.name,
        fullName: u.client.name,
        classification: u.client.classification,
        contracted: Math.round(u.contractedHours),
        spent: Math.round(u.spentHours),
        utilizationPct: u.utilizationPct,
        delta: Math.round(u.spentHours - u.contractedHours),
        band: classifyUtilization(u.contractedHours, u.spentHours),
      }));
  }, [usage]);

  const totals = useMemo(() => {
    return data.reduce((acc, d) => ({
      contracted: acc.contracted + d.contracted,
      spent: acc.spent + d.spent,
      unplanned: acc.unplanned + (d.contracted === 0 ? d.spent : 0),
      unplannedClients: acc.unplannedClients + (d.contracted === 0 && d.spent > 0 ? 1 : 0),
    }), { contracted: 0, spent: 0, unplanned: 0, unplannedClients: 0 });
  }, [data]);

  // Sparkline data from trend
  const trendContracted = trend.map(t => t.contracted);
  const trendSpent = trend.map(t => t.spent);
  const trendUtil = trend.map(t => t.utilizationPct);
  const trendUnplanned = trend.map(t =>
    Object.values(t.perClient).reduce((s, c) => s + (c.contracted === 0 ? c.spent : 0), 0)
  );

  // Variation vs previous month
  const variation = (arr: number[]) => {
    if (arr.length < 2) return null;
    const prev = arr[arr.length - 2];
    const curr = arr[arr.length - 1];
    if (prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };
  const utilVar = trendUtil.length >= 2 ? +(trendUtil[trendUtil.length - 1] - trendUtil[trendUtil.length - 2]).toFixed(1) : null;
  const spentVar = variation(trendSpent);
  const unplannedVar = variation(trendUnplanned);

  // Highlights (named lists)
  const highlights = useMemo(() => {
    const onTarget: typeof data = [];
    const idle: typeof data = [];
    const overBudget: typeof data = [];
    const noContract: typeof data = [];
    for (const d of data) {
      if (d.band === "green") onTarget.push(d);
      else if (d.band === "yellow-low" || d.band === "red-low") idle.push(d);
      else if (d.band === "yellow-high" || d.band === "red-high") overBudget.push(d);
      else if (d.band === "none" && d.spent > 0) noContract.push(d);
    }
    return { onTarget, idle, overBudget, noContract };
  }, [data]);

  // Ranking by utilization (only clients with contract)
  const ranking = useMemo(() => {
    return data
      .filter(d => d.contracted > 0)
      .slice()
      .sort((a, b) => b.utilizationPct - a.utilizationPct);
  }, [data]);

  // Trend chart data (combined)
  const trendChartData = trend.map(t => ({
    label: monthShortLabel(t.month),
    contracted: t.contracted,
    spent: t.spent,
    utilizationPct: t.utilizationPct,
  }));

  if (selectedMonth === "static" || !selectedMonth || selectedMonth.startsWith("year-")) {
    if (selectedMonth === "static") return null;
  }

  const selectedMonthLabel = months.find(m => m.value === selectedMonth)?.label || selectedMonth;

  const renderTrendArrow = (variation: number | null, invert = false) => {
    if (variation === null || variation === 0) return <Minus className="h-3 w-3" />;
    const isUp = variation > 0;
    const isGood = invert ? !isUp : isUp;
    const Icon = isUp ? TrendingUp : TrendingDown;
    return <Icon className={`h-3 w-3 ${isGood ? "text-success" : "text-destructive"}`} />;
  };

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
          <Briefcase className="h-4 w-4" />
          Sob Demanda — Horas por Cliente
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Quanto foi <strong>previsto</strong> (contratado) vs <strong>realizado</strong> por cliente • {selectedMonthLabel}
        </p>
      </div>

      <div className="space-y-4">
        {/* Context band */}
        <Card className="bg-muted/30">
          <CardContent className="p-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong className="text-foreground">O que é Sob Demanda?</strong> Clientes com horas contratadas mensalmente, executados pelas squads sob demanda.
              {" "}<strong className="text-foreground">Meta:</strong> utilização entre <span className="text-success font-semibold">90% e 110%</span> do contratado.
              {" "}Atenção a clientes <span className="text-warning font-semibold">ociosos (&lt;90%)</span> ou com <span className="text-destructive font-semibold">estouro (&gt;110%)</span>.
            </span>
          </CardContent>
        </Card>

        {/* Enriched KPI cards with sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Previsão do Mês</p>
                  <p className="text-2xl font-bold">{totals.contracted.toLocaleString()}h</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{data.length} clientes ativos</p>
                </div>
                <Sparkline values={trendContracted} color="hsl(217 91% 60%)" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Realizado no Período</p>
                  <p className="text-2xl font-bold text-primary">{totals.spent.toLocaleString()}h</p>
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    {renderTrendArrow(spentVar)}
                    {spentVar !== null ? `${spentVar > 0 ? "+" : ""}${spentVar}% vs mês anterior` : "—"}
                  </p>
                </div>
                <Sparkline values={trendSpent} color="hsl(var(--primary))" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Utilização Geral</p>
                  <p className={`text-2xl font-bold ${
                    totals.contracted > 0 && totals.spent / totals.contracted > 1.1 ? "text-destructive" :
                    totals.contracted > 0 && totals.spent / totals.contracted < 0.9 ? "text-warning" :
                    "text-success"
                  }`}>
                    {totals.contracted > 0 ? `${((totals.spent / totals.contracted) * 100).toFixed(0)}%` : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    {renderTrendArrow(utilVar)}
                    {utilVar !== null ? `${utilVar > 0 ? "+" : ""}${utilVar}pp vs mês anterior` : "—"}
                  </p>
                </div>
                <Sparkline values={trendUtil} color="hsl(142 71% 45%)" />
              </div>
            </CardContent>
          </Card>

          <Card className={totals.unplanned > 0 ? "border-warning/50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Trabalhado Não Previsto</p>
                  <p className={`text-2xl font-bold ${totals.unplanned > 0 ? "text-warning" : ""}`}>
                    {totals.unplanned.toLocaleString()}h
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {totals.unplannedClients > 0
                      ? `${totals.unplannedClients} cliente(s) sem contrato no mês`
                      : "Nenhum cliente fora do contrato"}
                  </p>
                </div>
                <Sparkline values={trendUnplanned} color="hsl(38 92% 55%)" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Highlights — named lists (style of the reports) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-success/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Dentro da meta (90–110%)</p>
              <p className="text-2xl font-bold text-success">{highlights.onTarget.length} cliente(s)</p>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2" title={highlights.onTarget.map(c => c.fullName).join(", ")}>
                {highlights.onTarget.map(c => c.fullName).join(", ") || "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-warning/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Ociosos (&lt;90%)</p>
              <p className="text-2xl font-bold text-warning">{highlights.idle.length} cliente(s)</p>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2" title={highlights.idle.map(c => `${c.fullName} (${c.utilizationPct.toFixed(0)}%)`).join(", ")}>
                {highlights.idle.map(c => `${c.fullName} (${c.utilizationPct.toFixed(0)}%)`).join(", ") || "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-destructive/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Acima do contrato (&gt;110%)</p>
              <p className="text-2xl font-bold text-destructive">{highlights.overBudget.length} cliente(s)</p>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2" title={highlights.overBudget.map(c => `${c.fullName} (${c.utilizationPct.toFixed(0)}%)`).join(", ")}>
                {highlights.overBudget.map(c => `${c.fullName} (${c.utilizationPct.toFixed(0)}%)`).join(", ") || "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Sem contrato (não previstos)</p>
              <p className="text-2xl font-bold text-muted-foreground">{highlights.noContract.length} cliente(s)</p>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2" title={highlights.noContract.map(c => `${c.fullName} (${c.spent}h)`).join(", ")}>
                {highlights.noContract.map(c => c.fullName).join(", ") || "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quarterly evolution — line (utilization) + bars (planned vs actual) side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Utilização (%) — últimos 3 meses</CardTitle>
            </CardHeader>
            <CardContent>
              {trendLoading || trendChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  {trendLoading ? "Carregando..." : "Sem dados de tendência."}
                </div>
              ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData} margin={{ left: 0, right: 20, top: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="%" domain={[0, (max: number) => Math.max(120, Math.ceil(max / 10) * 10)]} />
                      <ReferenceLine y={100} stroke="hsl(142 71% 45%)" strokeDasharray="4 4" label={{ value: "Meta 100%", fill: "hsl(142 71% 45%)", fontSize: 10, position: "right" }} />
                      <ReferenceLine y={90} stroke="hsl(38 92% 55%)" strokeDasharray="2 4" />
                      <ReferenceLine y={110} stroke="hsl(38 92% 55%)" strokeDasharray="2 4" />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--popover-foreground))" }}
                        formatter={(v: number) => [`${v}%`, "Utilização"]}
                      />
                      <Line type="monotone" dataKey="utilizationPct" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={{ r: 5, fill: "hsl(217 91% 60%)" }} label={{ position: "top", fontSize: 11, fill: "hsl(var(--foreground))", formatter: (v: number) => `${v}%` }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Volume (h) — Previsto vs Realizado</CardTitle>
            </CardHeader>
            <CardContent>
              {trendLoading || trendChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  {trendLoading ? "Carregando..." : "Sem dados de tendência."}
                </div>
              ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendChartData} margin={{ left: 0, right: 20, top: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="h" />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--popover-foreground))" }}
                        formatter={(v: number, name: string) => [`${v.toLocaleString()}h`, name === "contracted" ? "Previsto" : "Realizado"]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "12px" }}
                        formatter={(v) => <span style={{ color: "hsl(var(--foreground))" }}>{v === "contracted" ? "Previsto" : "Realizado"}</span>}
                      />
                      <Bar dataKey="contracted" fill="hsl(217 70% 70%)" />
                      <Bar dataKey="spent" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ranking by utilization (horizontal bars colored by band) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ranking por Utilização — {selectedMonthLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {ranking.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Nenhum cliente com contrato neste mês.</div>
            ) : (
              <div style={{ height: Math.max(280, ranking.length * 26) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ranking} layout="vertical" margin={{ left: 10, right: 50, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="%" domain={[0, (max: number) => Math.max(120, Math.ceil(max / 10) * 10)]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }} width={150} />
                    <ReferenceLine x={100} stroke="hsl(142 71% 45%)" strokeDasharray="4 4" />
                    <RechartsTooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--popover-foreground))" }}
                      formatter={(v: number, _n: string, p: any) => [`${v.toFixed(0)}% (${p.payload.spent}h / ${p.payload.contracted}h)`, "Utilização"]}
                      labelFormatter={(l) => l}
                    />
                    <Bar dataKey="utilizationPct" label={{ position: "right", fontSize: 10, fill: "hsl(var(--foreground))", formatter: (v: number) => `${v.toFixed(0)}%` }}>
                      {ranking.map((d, i) => (
                        <Cell key={i} fill={BAND_COLOR[d.band]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Original comparative chart (planned vs actual per client) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Previsto vs Realizado por Cliente — {selectedMonthLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
            ) : data.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Nenhum cliente ativo com horas neste mês.</div>
            ) : (
              <div style={{ height: Math.max(320, data.length * 28) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="h" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }} width={180} />
                    <RechartsTooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--popover-foreground))" }}
                      formatter={(v: number, name: string) => [`${v.toLocaleString()}h`, name === "contracted" ? "Previsto" : "Realizado"]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                      payload={[
                        { value: "Previsto (Contratado)", type: "square", color: "hsl(217 91% 70%)" },
                        { value: "Realizado", type: "square", color: "hsl(var(--primary))" },
                      ]}
                      formatter={(v) => <span style={{ color: "hsl(var(--foreground))" }}>{v}</span>}
                    />
                    <Bar dataKey="contracted" fill="hsl(217 91% 70%)" opacity={0.85} />
                    <Bar dataKey="spent">
                      {data.map((d, i) => (
                        <Cell key={i} fill={BAND_COLOR[d.band]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Multi-month comparison (manual selector) */}
        <ClientHoursComparison months={months} />

        {/* Detailed table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detalhamento por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border">
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 px-2">Cliente</th>
                    <th className="py-2 px-2 text-right">Previsão</th>
                    <th className="py-2 px-2 text-right">Realizado</th>
                    <th className="py-2 px-2 text-right">Δ</th>
                    <th className="py-2 px-2 text-right">Utilização</th>
                    <th className="py-2 px-2 text-right">Tarefas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{d.fullName}</td>
                      <td className="py-2 px-2 text-right font-mono">{d.contracted}h</td>
                      <td className="py-2 px-2 text-right font-mono">{d.spent}h</td>
                      <td className={`py-2 px-2 text-right font-mono ${d.delta > 0 ? "text-destructive" : d.delta < 0 ? "text-warning" : ""}`}>
                        {d.delta >= 0 ? "+" : ""}{d.delta}h
                      </td>
                      <td className="py-2 px-2 text-right font-mono" style={{ color: BAND_COLOR[d.band] }}>{d.utilizationPct.toFixed(0)}%</td>
                      <td className="py-2 px-2 text-right font-mono">{usage.find(u => u.client.name === d.fullName && u.client.classification === d.classification)?.taskCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Unmapped warning */}
        {unmappedClients.length > 0 && (
          <Card className="border-warning/50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-warning">{unmappedClients.length} tag(s) de cliente não mapeada(s) neste mês</p>
                <p className="text-muted-foreground mt-1">
                  {unmappedClients.slice(0, 5).map(u => `${u.alias} (${u.spentHours.toFixed(0)}h)`).join(", ")}
                  {unmappedClients.length > 5 && ` e mais ${unmappedClients.length - 5}...`}
                </p>
                <p className="text-muted-foreground mt-1">Vincule essas tags na <strong>Administração → Clientes</strong>.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
