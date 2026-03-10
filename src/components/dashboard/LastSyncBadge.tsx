import { useEffect, useState } from "react";
import { Cloud, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function getNextCronRun() {
  const now = new Date();
  const next = new Date(now);
  const currentHour = now.getUTCHours();
  const nextSlot = Math.ceil((currentHour + 1) / 6) * 6;
  if (nextSlot >= 24) {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
  } else {
    next.setUTCHours(nextSlot, 0, 0, 0);
  }
  return next;
}

export function LastSyncBadge() {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const fetchLastSync = async () => {
    const { data } = await supabase
      .from("report_tasks")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data?.created_at) {
      setLastSync(data.created_at);
    }
  };

  useEffect(() => {
    fetchLastSync();

    const channel = supabase
      .channel("sync-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "report_tasks" }, () => {
        fetchLastSync();
      })
      .subscribe();

    // Update "time ago" every minute
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (!lastSync) return null;

  const timeAgo = formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: ptBR });
  const nextRun = getNextCronRun();
  const timeToNext = formatDistanceToNow(nextRun, { locale: ptBR });

  return (
    <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1" title={`Última sincronização: ${new Date(lastSync).toLocaleString("pt-BR")}`}>
        <Cloud className="h-3 w-3" />
        <span>Sync {timeAgo}</span>
      </div>
      <span className="text-border">|</span>
      <div className="flex items-center gap-1" title={`Próxima sincronização: ${nextRun.toLocaleString("pt-BR")}`}>
        <Clock className="h-3 w-3" />
        <span>Próxima em {timeToNext}</span>
      </div>
    </div>
  );
}
