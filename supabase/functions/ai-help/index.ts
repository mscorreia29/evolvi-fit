// Supabase Edge Function: ai-help
// Deploy: supabase functions deploy ai-help
// Secret: supabase secrets set OPENAI_API_KEY=sk-...
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

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          reply:
            "O chat com IA não está configurado (falta a chave OPENAI_API_KEY no Supabase). Use a aba FAQ ou entre em contato com o suporte.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const messages = [
      {
        role: "system",
        content:
          "Você é o assistente do Evolvi Fit, um app de gestão de personal trainers. Responda em português do Brasil, de forma objetiva e prática, ajudando o personal a usar o painel: criar treinos, gerenciar alunos, alimentação, notificações, pagamentos, conta e acesso. Se não souber, oriente a procurar o suporte. Máximo 4 parágrafos curtos.",
      },
      ...(Array.isArray(history) ? history.slice(-6) : []),
      { role: "user", content: message },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.4,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI error:", errText);
      return new Response(
        JSON.stringify({ reply: "Erro ao contatar a IA. Tente novamente em instantes." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content?.trim() ?? "Sem resposta.";
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
