// Supabase Edge Function: ai-help
// Deploy: supabase functions deploy ai-help --use-api --yes
// Secret: supabase secrets set GEMINI_API_KEY=AIza... --yes
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, history } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          reply:
            "O chat com IA não está configurado (falta a chave GEMINI_API_KEY no Supabase). Use a aba FAQ ou entre em contato com o suporte.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contents = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        contents.push({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }],
        });
      }
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: "Você é o assistente do Evolvi Fit, um app de gestão de personal trainers. Responda em português do Brasil, de forma objetiva e prática, ajudando o personal a usar o painel: criar treinos, gerenciar alunos, alimentação, notificações, pagamentos, conta e acesso. Se não souber, oriente a procurar o suporte. Máximo 4 parágrafos curtos.",
              },
            ],
          },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini error:", errText);
      let detail = errText;
      try { detail = JSON.parse(errText)?.error?.message ?? errText; } catch {}
      return new Response(
        JSON.stringify({ reply: "Erro ao contatar a IA. Tente novamente em instantes." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await res.json();
    const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "Sem resposta.";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ reply: "Erro inesperado. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
