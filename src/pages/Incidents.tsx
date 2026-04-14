import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, Shield, Loader2, LogOut, BarChart3, AlertCircle, CalendarClock, TrendingDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useIncidentsData, PeriodFilter } from "@/hooks/useIncidentsData";
import { IncidentKpiCard } from "@/components/dashboard/IncidentKpiCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import { cn } from "@/lib/utils";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

const Incidents = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { approved, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const {
    loading, openIncidents, sloExpiring, sloOverdue, promisedExpiring, promisedOverdue,
    bySquad, trend, period, setPeriod, totalIncidents,
    isDueNextBusinessDay, isOverdue,
  } = useIncidentsData();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!authLoading && !roleLoading && user && !approved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <Shield className="h-12 w-12 text-warning mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Acesso Pendente</h2>
          <Button variant="outline" onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }

  const periodButtons: { value: PeriodFilter; label: string }[] = [
    { value: "1m", label: "Mês Atual" },
    { value: "3m", label: "3 Meses" },
    { value: "6m", label: "6 Meses" },
    { value: "1y", label: "1 Ano" },
  ];

  const DeadlineTable = ({ title, icon: Icon, tasks, dateField, iconColor }: {
    title: string;
    icon: any;
    tasks: any[];
    dateField: "slo_date" | "promised_date";
    iconColor: string;
  }) => (
    <Card className="gradient-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className={cn("h-4 w-4", iconColor)} />
          {title}
          <Badge variant="outline" className="ml-auto text-xs">{tasks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nenhum incidente com prazo próximo</p>
        ) : (
          <div className="max-h-[400px] overflow-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[90px]">Código</TableHead>
                  <TableHead className="text-xs">Título</TableHead>
                  <TableHead className="text-xs w-[100px]">Squad</TableHead>
                  <TableHead className="text-xs w-[100px]">Responsável</TableHead>
                  <TableHead className="text-xs w-[60px]">Prazo</TableHead>
                  <TableHead className="text-xs w-[80px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map(t => {
                  const dateVal = t[dateField] as string;
                  const days = daysUntil(dateVal);
                  const overdue = isOverdue(dateVal);
                  const nextDay = isDueNextBusinessDay(dateVal);
                  const urgent = overdue || nextDay;

                  return (
                    <TableRow key={t.task_code} className={cn(urgent && "bg-destructive/5")}>
                      <TableCell className="text-xs font-mono font-medium truncate">
                        <a href={`https://youtrack.attus.ai/issue/${t.task_code}`} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">{t.task_code}</a>
                      </TableCell>
                      <TableCell className="text-xs truncate">{t.title || "—"}</TableCell>
                      <TableCell className="text-xs truncate">{t.squad || "—"}</TableCell>
                      <TableCell className="text-xs truncate">{t.assignee || "—"}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "text-xs font-semibold font-mono whitespace-nowrap",
                          overdue ? "text-destructive" : nextDay ? "text-destructive" : days <= 2 ? "text-warning" : "text-foreground"
                        )}>
                          {overdue ? `${Math.abs(days)}d atrás` : days === 0 ? "Hoje" : `${days}d`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={urgent ? "destructive" : "outline"} className="text-[10px] whitespace-nowrap">
                          {overdue ? "ATRASADO" : nextDay ? "URGENTE" : t.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 pl-10">
            <div className="h-8 w-8 rounded-lg bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Painel de Incidentes</h1>
              <p className="text-xs text-muted-foreground">Monitoramento de prazos e evolução</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {periodButtons.map(p => (
              <Button
                key={p.value}
                variant={period === p.value ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs ml-2">
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <main className="container mx-auto px-4 py-6 space-y-8">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <IncidentKpiCard title="Total de Incidentes" value={totalIncidents} subtitle="Todos os registros" icon={AlertTriangle} variant="default" delay={0} />
            <IncidentKpiCard title="Incidentes Abertos" value={openIncidents.length} subtitle="Aguardando resolução" icon={AlertCircle} variant="destructive" delay={50} incidents={openIncidents} />
            <IncidentKpiCard title="SLO Vencendo" value={sloExpiring.length} subtitle="Próximos 5 dias úteis" icon={Clock} variant="warning" delay={100} incidents={sloExpiring} />
            <IncidentKpiCard title="SLO Atrasados" value={sloOverdue.length} subtitle="Prazo já expirado" icon={AlertTriangle} variant="destructive" delay={150} incidents={sloOverdue} />
            <IncidentKpiCard title="Prometida Vencendo" value={promisedExpiring.length} subtitle="Próximos 5 dias úteis" icon={CalendarClock} variant="info" delay={200} incidents={promisedExpiring} />
            <IncidentKpiCard title="Prometida Atrasada" value={promisedOverdue.length} subtitle="Prazo já expirado" icon={CalendarClock} variant="destructive" delay={250} incidents={promisedOverdue} />
          </div>

          {/* Deadline tables */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <Clock className="h-4 w-4" />
              Prazos Próximos (5 dias úteis)
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DeadlineTable
                title="Vencendo SLO"
                icon={Clock}
                tasks={[...sloOverdue, ...sloExpiring]}
                dateField="slo_date"
                iconColor="text-warning"
              />
              <DeadlineTable
                title="Vencendo Data Prometida"
                icon={CalendarClock}
                tasks={[...promisedOverdue, ...promisedExpiring]}
                dateField="promised_date"
                iconColor="text-info"
              />
            </div>
          </section>

          {/* By Squad */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Visão por Time
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {bySquad.map(sq => (
                <Card key={sq.squad} className="gradient-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">{sq.squad}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-mono font-semibold">{sq.total}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Abertos</span>
                      <span className="font-mono font-semibold text-destructive">{sq.open}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">SLO em risco</span>
                      <span className={cn("font-mono font-semibold", sq.sloExpiring.length > 0 ? "text-warning" : "text-muted-foreground")}>
                        {sq.sloExpiring.length}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Data prometida em risco</span>
                      <span className={cn("font-mono font-semibold", sq.promisedExpiring.length > 0 ? "text-info" : "text-muted-foreground")}>
                        {sq.promisedExpiring.length}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Evolution chart */}
          {trend.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <TrendingDown className="h-4 w-4" />
                Evolução de Incidentes
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="gradient-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Criados vs Resolvidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trend} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Bar dataKey="created" name="Criados" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="resolved" name="Resolvidos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="gradient-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Incidentes em Aberto (Acumulado)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                          />
                          <Line dataKey="open" name="Em Aberto" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          )}
        </main>
      )}
    </div>
  );
};

export default Incidents;
