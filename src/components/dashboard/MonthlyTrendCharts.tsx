import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Area, AreaChart,
} from "recharts";
import type { MonthlyTrendPoint } from "@/hooks/useDashboardData";

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

function shortLabel(label: string) {
  // "Março 2026" -> "Mar"
  return label.slice(0, 3);
}

export function MonthlyTrendCharts({ data }: Props) {
  const chartData = data.map(d => ({ ...d, shortLabel: shortLabel(d.label) }));

  return (
    <div className="space-y-4">
      {/* Tasks by Category */}
      <div className="gradient-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold mb-1">Entregas por Tipo (Mensal)</h3>
        <p className="text-xs text-muted-foreground mb-4">Evolução mensal de tarefas entregues por categoria</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="shortLabel" tick={axisTickStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210, 20%, 92%)" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="tarefas" name="Tarefa" stackId="a" fill="hsl(210, 100%, 56%)" />
              <Bar dataKey="melhorias" name="Melhoria" stackId="a" fill="hsl(160, 84%, 39%)" />
              <Bar dataKey="incidentes" name="Incidente" stackId="a" fill="hsl(0, 72%, 51%)" />
              <Bar dataKey="bugs" name="Bug" stackId="a" fill="hsl(38, 92%, 50%)" />
              <Bar dataKey="deadLetters" name="DeadLetter" stackId="a" fill="hsl(280, 67%, 56%)" />
              <Bar dataKey="epicos" name="Épico" stackId="a" fill="hsl(180, 60%, 45%)" />
              <Bar dataKey="outros" name="Outros" stackId="a" fill="hsl(215, 15%, 52%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hours: Estimated vs Spent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        {/* Lead Time & Cycle Time trends */}
        <div className="gradient-card rounded-lg border border-border p-5">
          <h3 className="text-sm font-semibold mb-1">Lead Time & Cycle Time</h3>
          <p className="text-xs text-muted-foreground mb-4">Evolução mensal da previsibilidade (dias)</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="shortLabel" tick={axisTickStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
                <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} unit="d" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${v}d`, name === "leadTimeAvg" ? "Lead Time" : "Cycle Time"]} />
                <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => v === "leadTimeAvg" ? "Lead Time" : "Cycle Time"} />
                <Line dataKey="leadTimeAvg" stroke="hsl(210, 100%, 56%)" strokeWidth={2} dot={{ r: 4 }} />
                <Line dataKey="cycleTimeAvg" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Throughput & Rework */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="gradient-card rounded-lg border border-border p-5">
          <h3 className="text-sm font-semibold mb-1">Throughput Mensal</h3>
          <p className="text-xs text-muted-foreground mb-4">Tarefas resolvidas por mês</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="shortLabel" tick={axisTickStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
                <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Resolvidas"]} />
                <Bar dataKey="throughput" name="Resolvidas" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
              </BarChart>
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
                <Area dataKey="reworkRate" fill="hsl(0, 72%, 51%)" fillOpacity={0.15} stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 4 }} name="Retrabalho %" />
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
