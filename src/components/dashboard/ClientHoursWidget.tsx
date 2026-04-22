import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, AlertTriangle } from "lucide-react";
import { useClientsData } from "@/hooks/useClientsData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Cell } from "recharts";

interface Props {
  selectedMonth: string;
}

export function ClientHoursWidget({ selectedMonth }: Props) {
  const { usage, loading, unmappedClients } = useClientsData(selectedMonth);

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
      }));
  }, [usage]);

  const totals = useMemo(() => {
    return data.reduce((acc, d) => ({
      contracted: acc.contracted + d.contracted,
      spent: acc.spent + d.spent,
    }), { contracted: 0, spent: 0 });
  }, [data]);

  if (selectedMonth === "static" || !selectedMonth) {
    return null;
  }

  return (
    <section>
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
        <Briefcase className="h-4 w-4" />
        Horas por Cliente — Previsão vs Realizado (Sob Demanda)
      </h2>
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Previsão do Mês (Contratado)</p>
              <p className="text-2xl font-bold">{totals.contracted.toLocaleString()}h</p>
              <p className="text-[10px] text-muted-foreground mt-1">{data.length} clientes ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Realizado no Período</p>
              <p className="text-2xl font-bold text-primary">{totals.spent.toLocaleString()}h</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {totals.contracted > 0 ? `${((totals.spent / totals.contracted) * 100).toFixed(0)}% da previsão` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Saldo (Realizado − Previsto)</p>
              <p className={`text-2xl font-bold ${totals.spent > totals.contracted ? "text-destructive" : "text-success"}`}>
                {totals.spent - totals.contracted >= 0 ? "+" : ""}{(totals.spent - totals.contracted).toLocaleString()}h
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{totals.spent > totals.contracted ? "Acima do previsto" : "Dentro do previsto"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Comparative chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Previsão (Contratado) vs Realizado por Cliente</CardTitle>
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
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--popover-foreground))", padding: "8px 12px", boxShadow: "0 4px 12px hsl(var(--background) / 0.4)" }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: "4px" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))", padding: "2px 0" }}
                      formatter={(v: number, name: string) => [`${v.toLocaleString()}h`, name === "contracted" ? "Previsão" : "Realizado"]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "hsl(0 0% 98%)" }} formatter={v => <span style={{ color: "hsl(0 0% 98%)" }}>{v === "contracted" ? "Contratado" : "Realizado"}</span>} />
                    <Bar dataKey="contracted" fill="hsl(217 91% 70%)" opacity={0.85} />
                    <Bar dataKey="spent">
                      {data.map((d, i) => (
                        <Cell key={i} fill={d.spent > d.contracted ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

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
                    <th className="py-2 px-2">Classificação</th>
                    <th className="py-2 px-2 text-right">Contratado</th>
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
                      <td className="py-2 px-2"><Badge variant="secondary" className="text-[10px]">{d.classification}</Badge></td>
                      <td className="py-2 px-2 text-right font-mono">{d.contracted}h</td>
                      <td className="py-2 px-2 text-right font-mono">{d.spent}h</td>
                      <td className={`py-2 px-2 text-right font-mono ${d.delta > 0 ? "text-destructive" : d.delta < 0 ? "text-warning" : ""}`}>
                        {d.delta >= 0 ? "+" : ""}{d.delta}h
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{d.utilizationPct.toFixed(0)}%</td>
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
