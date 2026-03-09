import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Loader2, Cloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const YEARS = Array.from({ length: 5 }, (_, i) => {
  const y = new Date().getFullYear() - 2 + i;
  return { value: String(y), label: String(y) };
});

interface YouTrackSyncDialogProps {
  onImported: () => void;
}

export function YouTrackSyncDialog({ onImported }: YouTrackSyncDialogProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [project, setProject] = useState("ATT");
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("");
  const { toast } = useToast();

  const buildUrl = (params: Record<string, string>) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const base = `https://${projectId}.supabase.co/functions/v1/youtrack`;
    const qs = new URLSearchParams(params).toString();
    return `${base}?${qs}`;
  };

  const handleSync = async () => {
    if (!month || !year) {
      toast({ title: "Selecione mês e ano", variant: "destructive" });
      return;
    }

    setSyncing(true);
    setProgress(5);
    setPhaseLabel("Buscando tarefas no YouTrack...");

    try {
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      const dateFrom = `${year}-${month}-01`;
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      const dateTo = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

      // Step 1: Fetch issues (using "work date" filter to capture all issues with time in period)
      const issuesUrl = buildUrl({ project, dateFrom, dateTo });
      const issuesRes = await fetch(issuesUrl);
      if (!issuesRes.ok) {
        const err = await issuesRes.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${issuesRes.status}`);
      }

      const { tasks } = await issuesRes.json();
      if (!tasks || tasks.length === 0) {
        toast({ title: "Nenhuma tarefa encontrada no período", variant: "destructive" });
        setSyncing(false);
        setProgress(0);
        setPhaseLabel("");
        return;
      }

      setProgress(20);
      setPhaseLabel(`${tasks.length} tarefas encontradas. Buscando horas do período...`);

      // Step 2: Fetch period-specific work items
      let spentByIssue: Record<string, number> = {};
      try {
        const wiUrl = buildUrl({ project, dateFrom, dateTo, mode: "workitems" });
        const wiRes = await fetch(wiUrl);
        if (wiRes.ok) {
          const wiData = await wiRes.json();
          spentByIssue = wiData.spentByIssue || {};
          setPhaseLabel(`Horas do período obtidas. Buscando dados de cycle time...`);
        }
      } catch {
        // Non-fatal: fall back to cumulative spent_minutes from issues
      }

      setProgress(35);

      // Step 3: Fetch activities in batches for cycle time
      const activityBatchSize = 20;
      const startedAtMap: Record<string, string> = {};
      const qaReturnsMap: Record<string, number> = {};
      const issueIdsWithYtId = tasks.filter((t: any) => t.id);
      const totalActBatches = Math.ceil(issueIdsWithYtId.length / activityBatchSize);

      for (let i = 0; i < issueIdsWithYtId.length; i += activityBatchSize) {
        const batchIdx = Math.floor(i / activityBatchSize);
        const batchProgress = 35 + Math.round((batchIdx / Math.max(totalActBatches, 1)) * 20);
        setProgress(batchProgress);
        setPhaseLabel(`Buscando cycle time (lote ${batchIdx + 1}/${totalActBatches})...`);

        const batchIds = issueIdsWithYtId.slice(i, i + activityBatchSize).map((t: any) => t.taskCode || t.id);
        try {
          const actUrl = buildUrl({ mode: "activities" });
          const actRes = await fetch(actUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issueIds: batchIds }),
          });

          if (actRes.ok) {
            const { startedAt } = await actRes.json();
            if (startedAt) Object.assign(startedAtMap, startedAt);
          }
        } catch {
          // Non-fatal: continue without cycle time for this batch
        }
      }

      setProgress(55);
      setPhaseLabel("Salvando no banco de dados...");

      // Step 4: Save to database
      const monthKey = `${year}-${month}`;
      const monthLabel = `${MONTHS.find(m => m.value === month)?.label} ${year}`;

      const { data: report, error: reportError } = await supabase
        .from("sprint_reports")
        .upsert({ month: monthKey, label: monthLabel }, { onConflict: "month" })
        .select("id")
        .single();

      if (reportError) throw reportError;

      setProgress(60);
      await supabase.from("report_tasks").delete().eq("report_id", report.id);

      setProgress(65);

      const dbBatchSize = 100;
      const totalDbBatches = Math.ceil(tasks.length / dbBatchSize);

      for (let i = 0; i < tasks.length; i += dbBatchSize) {
        const batchIdx = Math.floor(i / dbBatchSize);
        const batchProgress = 65 + Math.round((batchIdx / totalDbBatches) * 30);
        setProgress(batchProgress);
        setPhaseLabel(`Salvando lote ${batchIdx + 1}/${totalDbBatches} (${Math.min(i + dbBatchSize, tasks.length)}/${tasks.length})...`);

        const batch = tasks.slice(i, i + dbBatchSize).map((t: any) => {
          // Use period-specific hours from work items if available, otherwise fall back to cumulative
          const periodSpent = spentByIssue[t.taskCode];
          const spentMinutes = periodSpent !== undefined ? periodSpent : t.spentMinutes;

          return {
            report_id: report.id,
            task_code: t.taskCode,
            title: t.title,
            category: t.category,
            billing_status: t.billingStatus,
            squad: t.squad,
            assignee: t.assignee,
            estimated_minutes: t.estimatedMinutes,
            spent_minutes: spentMinutes,
            status: t.status,
            created_at_yt: t.createdAt,
            resolved_at: t.resolvedAt,
            started_at: startedAtMap[t.taskCode] || startedAtMap[t.id] || (spentMinutes > 0 ? t.createdAt : null),
            tags: t.tags || [],
            corrections_count: t.correctionsCount || 0,
          };
        });

        const { error } = await supabase.from("report_tasks").insert(batch);
        if (error) throw error;

        await new Promise((r) => setTimeout(r, 50));
      }

      setProgress(100);
      setPhaseLabel("Sincronização concluída!");

      const squads = new Set(tasks.map((t: any) => t.squad));
      toast({
        title: "Sincronização concluída!",
        description: `${tasks.length} tarefas importadas para ${monthLabel} (${squads.size} squads)`,
      });

      setTimeout(() => {
        setOpen(false);
        setMonth("");
        setProgress(0);
        setPhaseLabel("");
        onImported();
      }, 800);
    } catch (err: any) {
      console.error("YouTrack sync error:", err);
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
      setProgress(0);
      setPhaseLabel("");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!syncing) setOpen(v); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Cloud className="h-3.5 w-3.5" />
          Sincronizar YouTrack
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Sincronizar com YouTrack
          </DialogTitle>
          <DialogDescription>
            Importar tarefas do YouTrack para o período selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Mês</Label>
              <Select value={month} onValueChange={setMonth} disabled={syncing}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Ano</Label>
              <Select value={year} onValueChange={setYear} disabled={syncing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => (
                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Projeto YouTrack</Label>
            <Input value={project} onChange={e => setProject(e.target.value)} placeholder="ATT" disabled={syncing} />
            <p className="text-[10px] text-muted-foreground">ShortName do projeto (prefixo das issues)</p>
          </div>

          {progress > 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{phaseLabel}</span>
                <span className="font-mono font-semibold text-primary">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Button onClick={handleSync} disabled={syncing} className="w-full gap-2">
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Sincronizar Dados
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
