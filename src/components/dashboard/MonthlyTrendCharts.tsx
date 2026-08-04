import {
  LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Area, AreaChart,
} from "recharts";
import type { MonthlyTrendPoint } from "@/hooks/useDashboardData";
import { linearTrend } from "@/lib/chartHelpers";

interface Props {
  data: MonthlyTrendPoint[];
}

const tooltipStyle = {
  background: "hsl(225, 22%, 11%)",
  border: "1px solid hsl(225, 15%, 18%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(210, 20%, 92%)",
};
const axisTickStyle = { fill: "hsl(215, 15%, 52%)", fontSize: 10 };
const gridStroke = "hsl(225, 15%, 18%)";

const DELIVERY_KEYS = ["tarefas", "melhorias", "incidentes", "deadLetters", "epicos", "outros"] as const;

function shortLabel(label: string) {
  // "Março 2026" -> "Mar"
  return label.slice(0, 3);
}

export function MonthlyTrendCharts({ data }: Props) {
  const totals = data.map(d =>
    DELIVERY_KEYS.reduce((s, k) => s + (Number((d as unknown as Record<string, number>)[k]) || 0), 0),
  );
  const deliveryMask = totals.map(t => t !== 0);
  const deliveryTrend = linearTrend(totals, deliveryMask.some(Boolean) ? deliveryMask : undefined);

  const chartData = data.map((d, i) => ({
    ...d,
    shortLabel: shortLabel(d.label),
    totalEntregas: totals[i],
    tendencia: deliveryTrend[i],
  }));


  return (
    <div className="space-y-4">
      {/* Tasks by Category */}
      <div className="gradient-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold mb-1">Entregas por Tipo (Mensal)</h3>
        <p className="text-xs text-muted-foreground mb-4">Evolução mensal de tarefas entregues por categoria (mês = data de fechamento) · linha tracejada = tendência geral</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="shortLabel" interval={0} tick={axisTickStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210, 20%, 92%)" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="tarefas" name="Tarefa" stackId="a" fill="hsl(210, 100%, 56%)" />
              <Bar dataKey="melhorias" name="Melhoria" stackId="a" fill="hsl(160, 84%, 39%)" />
              <Bar dataKey="incidentes" name="Incidente" stackId="a" fill="hsl(0, 84%, 65%)" />
              <Bar dataKey="deadLetters" name="DeadLetter" stackId="a" fill="hsl(280, 80%, 72%)" />
              <Bar dataKey="epicos" name="Épico" stackId="a" fill="hsl(180, 60%, 45%)" />
              <Bar dataKey="outros" name="Outros" stackId="a" fill="hsl(215, 15%, 52%)" />
              <Line type="monotone" dataKey="tendencia" name="Tendência" stroke="hsl(45, 100%, 62%)" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </ComposedChart>

          </ResponsiveContainer>
        </div>
      </div>

      {/* Hours: Estimated vs Spent */}
      <div className="gradient-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold mb-1">Horas Estimadas vs Realizadas</h3>
        <p className="text-xs text-muted-foreground mb-4">Evolução mensal de esforço</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="shortLabel" tick={axisTickStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} unit="h" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${v}h`, name === "totalEstimatedHours" ? "Estimado" : "Realizado"]} />
              <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => v === "totalEstimatedHours" ? "Estimado" : "Realizado"} />
              <Area dataKey="totalEstimatedHours" fill="hsl(210, 100%, 56%)" fillOpacity={0.15} stroke="hsl(210, 100%, 56%)" strokeDasharray="5 5" />
              <Line dataKey="totalSpentHours" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Throughput & Rework */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="gradient-card rounded-lg border border-border p-5">
          <h3 className="text-sm font-semibold mb-1">Throughput vs WIP Mensal</h3>
          <p className="text-xs text-muted-foreground mb-4">Tarefas resolvidas no mês (barras) e trabalho em andamento — itens não concluídos, sem incidentes e sem squad Qualidade (linha)</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="shortLabel" tick={axisTickStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
                <YAxis yAxisId="left" tick={axisTickStyle} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={axisTickStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210, 20%, 92%)" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar yAxisId="left" dataKey="throughput" name="Resolvidas" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                <Line yAxisId="right" type="monotone" dataKey="wip" name="WIP" stroke="hsl(280, 80%, 72%)" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>


        <div className="gradient-card rounded-lg border border-border p-5">
          <h3 className="text-sm font-semibold mb-1">Taxa de Retrabalho</h3>
          <p className="text-xs text-muted-foreground mb-4">Percentual de tarefas com correções por mês</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="shortLabel" tick={axisTickStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
                <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "Retrabalho"]} />
                <Area dataKey="reworkRate" fill="hsl(0, 84%, 65%)" fillOpacity={0.15} stroke="hsl(0, 84%, 65%)" strokeWidth={2} dot={{ r: 4 }} name="Retrabalho %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CFD - Cumulative Flow Diagram */}
      <div className="gradient-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold mb-1">CFD – Diagrama de Fluxo Acumulativo</h3>
        <p className="text-xs text-muted-foreground mb-4">Quantidade acumulada de tarefas por fase do Kanban — a distância vertical entre as bandas representa o WIP de cada etapa</p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="shortLabel" tick={axisTickStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210, 20%, 92%)" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Area dataKey="cfdBacklog" name="Backlog" stackId="cfd" fill="hsl(215, 15%, 52%)" fillOpacity={0.55} stroke="hsl(215, 15%, 52%)" strokeWidth={1.5} />
              <Area dataKey="cfdDev" name="Desenvolvimento" stackId="cfd" fill="hsl(210, 100%, 56%)" fillOpacity={0.75} stroke="hsl(210, 100%, 56%)" strokeWidth={1.5} />
              <Area dataKey="cfdQA" name="Validação / QA" stackId="cfd" fill="hsl(38, 92%, 50%)" fillOpacity={0.75} stroke="hsl(38, 92%, 50%)" strokeWidth={1.5} />
              <Area dataKey="cfdDone" name="Concluído" stackId="cfd" fill="hsl(160, 84%, 39%)" fillOpacity={0.75} stroke="hsl(160, 84%, 39%)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
