import { useEffect, useState } from "react";
import { Cloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function LastSyncBadge() {
  const [lastSync, setLastSync] = useState<string | null>(null);

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

    // Listen for realtime changes
    const channel = supabase
      .channel("sync-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "sprint_reports" }, () => {
        fetchLastSync();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!lastSync) return null;

  const timeAgo = formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: ptBR });

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground" title={`Última sincronização: ${new Date(lastSync).toLocaleString("pt-BR")}`}>
      <Cloud className="h-3 w-3" />
      <span>Sync {timeAgo}</span>
    </div>
  );
}
