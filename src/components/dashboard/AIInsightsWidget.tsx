import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Loader2, RefreshCw, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getSafeErrorMessage } from "@/lib/safeError";
import { useUserRole } from "@/hooks/useUserRole";

interface AIInsightsWidgetProps {
  scope: "global" | "team";
  monthLabel: string;
  teamName?: string;
  metrics: Record<string, unknown>;
  previousMetrics?: Record<string, unknown> | null;
  /** When true, render a slim/compact variant (used inside TeamCard) */
  compact?: boolean;
  className?: string;
}

export function AIInsightsWidget({
  scope,
  monthLabel,
  teamName,
  metrics,
  previousMetrics,
  compact = false,
  className,
}: AIInsightsWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string>("");
  const [error, setError] = useState<string>("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "ai-insights",
        {
          body: {
            scope,
            monthLabel,
            teamName,
            metrics,
            previousMetrics: previousMetrics ?? null,
          },
        }
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setInsight(data?.insight ?? "");
    } catch (e) {
      setError(getSafeErrorMessage(e) || "Falha ao gerar insights");
    } finally {
      setLoading(false);
    }
  };

  const hasContent = insight.length > 0;
  const title =
    scope === "team"
      ? `Insights IA · ${teamName ?? ""}`
      : "Insights de IA — Visão Geral";

  if (compact) {
    return (
      <div className={cn("mt-3 pt-3 border-t border-border/50", className)}>
        {!hasContent && !loading && !error && (
          <Button
            variant="ghost"
            size="sm"
            onClick={generate}
            className="h-7 w-full justify-start gap-1.5 text-[10px] text-muted-foreground hover:text-primary"
          >
            <Sparkles className="h-3 w-3" />
            Gerar insights da IA
          </Button>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground py-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Analisando métricas...
          </div>
        )}
        {error && (
          <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}
        {hasContent && (
          <div className="space-y-2">
            <div className="prose prose-invert prose-xs max-w-none text-[11px] leading-relaxed
              prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-2 prose-headings:mb-1
              prose-h2:text-[11px] prose-h2:uppercase prose-h2:tracking-wider prose-h2:text-muted-foreground
              prose-p:my-1 prose-p:text-foreground/90
              prose-ul:my-1 prose-ul:pl-4 prose-li:my-0.5 prose-li:text-foreground/90
              prose-strong:text-foreground prose-strong:font-semibold">
              <ReactMarkdown>{insight}</ReactMarkdown>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={generate}
              disabled={loading}
              className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-primary"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              Regerar
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-5",
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary/15 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-[10px] text-muted-foreground">
              Análise automatizada via Lovable AI · {monthLabel}
            </p>
          </div>
        </div>
        {(hasContent || error) && (
          <Button
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={loading}
            className="h-7 gap-1.5 text-xs"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Regerar
          </Button>
        )}
      </div>

      {!hasContent && !loading && !error && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs text-muted-foreground">
            Gere uma análise da IA com diagnóstico, riscos, comparação com o mês
            anterior e ações recomendadas.
          </p>
          <Button
            size="sm"
            onClick={generate}
            className="gap-1.5 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Gerar insights
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Analisando métricas e gerando insights...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Não foi possível gerar a análise</p>
            <p className="text-destructive/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {hasContent && (
        <div className="prose prose-invert prose-sm max-w-none
          prose-headings:text-foreground prose-headings:font-semibold
          prose-h2:text-xs prose-h2:uppercase prose-h2:tracking-wider prose-h2:text-muted-foreground prose-h2:mt-4 prose-h2:mb-2
          prose-p:text-foreground/90 prose-p:my-1.5 prose-p:text-xs
          prose-ul:my-2 prose-li:my-0.5 prose-li:text-foreground/90 prose-li:text-xs
          prose-strong:text-foreground prose-strong:font-semibold">
          <ReactMarkdown>{insight}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
