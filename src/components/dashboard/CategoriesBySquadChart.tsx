import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Layers } from "lucide-react";
import type { TeamData } from "@/data/dashboardData";

interface Props {
  teams: TeamData[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Tarefa": "hsl(210, 100%, 56%)",
  "Bug": "hsl(0, 84%, 60%)",
  "Incidente": "hsl(38, 92%, 50%)",
  "Melhoria": "hsl(160, 84%, 39%)",
  "Épico": "hsl(280, 67%, 56%)",
  "DeadLetter": "hsl(330, 80%, 55%)",
  "Outros": "hsl(190, 90%, 50%)",
};

export function CategoriesBySquadChart({ teams }: Props) {
  if (teams.length === 0) {
    return (
      <Card className="animate-fade-in">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Distribuição de Categorias por Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-8">Selecione 2 ou mais times para comparar.</p>
        </CardContent>
      </Card>
    );
  }

  // Build set of all categories present
  const categorySet = new Set<string>();
  teams.forEach(t => t.categories.forEach(c => categorySet.add(c.name)));
  const categories = Array.from(categorySet);

  const data = teams.map(t => {
    const row: Record<string, string | number> = { squad: t.name };
    for (const cat of categories) {
      const c = t.categories.find(x => x.name === cat);
      row[cat] = Math.round(c?.spentHours || 0);
    }
    return row;
  });

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          Distribuição de Categorias por Time (horas)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="squad" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="h" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "11px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number, name: string) => [`${value}h`, name]}
            />
            <Legend wrapperStyle={{ fontSize: "10px" }} />
            {categories.map(cat => (
              <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat] || "hsl(var(--muted-foreground))"} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
