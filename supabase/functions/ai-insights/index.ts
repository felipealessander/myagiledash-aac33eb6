// AI Insights edge function - uses user's OpenAI API key to analyze metrics
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InsightRequest {
  scope: "global" | "team";
  monthLabel: string;
  teamName?: string;
  metrics: Record<string, unknown>;
  previousMetrics?: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require an authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = (await req.json()) as InsightRequest;
    if (!body || !body.scope || !body.metrics) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scopeLabel =
      body.scope === "team"
        ? `time/squad **${body.teamName ?? "(sem nome)"}**`
        : "panorama **geral** (todos os squads)";

    const systemPrompt = `Você é um Engenheiro de Performance e Tech Lead sênior, especialista em métricas ágeis (Lead Time, Cycle Time, Throughput, WIP, Retrabalho, SLO, Estimativa vs Realizado, Faturamento). Você analisa dados objetivos de squads de desenvolvimento e gera insights diretos, em português do Brasil, sem enrolação.

REGRAS:
- Seja específico e quantitativo (cite números das métricas).
- Não invente dados que não estão no payload.
- Tom executivo, profissional, direto. Nada de "talvez", "pode ser que".
- Use markdown (cabeçalhos ##, listas com -, **negrito** em pontos críticos).
- Máximo ~400 palavras no total.

ESTRUTURA OBRIGATÓRIA da resposta (nessa ordem):

## 📊 Diagnóstico
2-4 bullets resumindo o estado atual dos KPIs principais.

## ⚠️ Pontos de Atenção
2-4 bullets com riscos, gargalos, métricas piorando ou fora do esperado.

## 📈 Comparação com Mês Anterior
${body.previousMetrics ? "Compare com as métricas do mês anterior (delta, tendência: melhorou/piorou)." : "Dados do mês anterior não disponíveis — escreva apenas: *Sem dados do mês anterior para comparação.*"}

## 🎯 Ações Recomendadas
3-5 ações práticas, priorizadas, que impactariam diretamente os indicadores.`;

    const userPrompt = `Análise solicitada para: ${scopeLabel}
Mês de referência: **${body.monthLabel}**

### Métricas atuais
\`\`\`json
${JSON.stringify(body.metrics, null, 2)}
\`\`\`

${body.previousMetrics ? `### Métricas do mês anterior\n\`\`\`json\n${JSON.stringify(body.previousMetrics, null, 2)}\n\`\`\`` : ""}

Gere a análise agora.`;

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      let errorMsg = "Falha ao gerar insights";
      if (response.status === 401) errorMsg = "Token OpenAI inválido ou expirado";
      if (response.status === 429) errorMsg = "Limite de requisições da OpenAI atingido";
      if (response.status === 402) errorMsg = "Créditos da OpenAI insuficientes";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ insight: content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-insights error:", e);
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
