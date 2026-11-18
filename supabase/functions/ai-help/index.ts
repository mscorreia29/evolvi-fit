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
        for (const h of history.slice(-3)) {
          contents.push({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.content }],
          });
        }
      }
      contents.push({ role: "user", parts: [{ text: message }] });

      const systemText = `Você é o assistente do Evolvi Fit (app de gestão de personal trainers). Responda em português do Brasil, de forma objetiva, curta e prática (máximo 3 parágrafos). Use apenas informações do app abaixo. Se não souber, diga para procurar o suporte.

FUNCIONALIDADES DO PAINEL PERSONAL:
- Treinos: criar/editar/arquivar treinos por aluno; adicionar exercícios da biblioteca ou manualmente com URL de vídeo; divisões A, B, C...
- Alunos: ficha completa (avaliações físicas, metas com progresso ±10%, notas privadas, anamnese); criar aluno (email/senha); resetar senha/email.
- Alimentação: criar plano alimentar (refeições e itens com calorias) por aluno.
- Mensagens: chat com aluno; notificações automáticas.
- Feedbacks: aluno envia solicitação; personal responde.
- Financeiro: cobranças (mensalidade) por aluno; marcar como pago/cancelado.
- Notificações: automáticas para novo treino, mensagem, feedback, plano alimentar, cobrança, treino concluído.
- Perfil: dados pessoais, senha, configurações de engajamento (intervalo de feedback, lembrete de pagamento).
- Ajuda: esta central (FAQ + chat).

PAINEL ADMIN MASTER (/admin):
- Aprovar/rejeitar personais; liberar 30 dias de acesso; bloquear/desbloquear; resetar senha/email; configurações globais (dias de teste, auto-cadastro, auto-bloqueio).

FLUXO DO ALUNO:
- Dashboard: treinos ativos, desafio do dia, metas com progresso, check-in semanal de motivação (1-5).
- Treino: iniciar treino, marcar exercícios, registrar carga/séries/reps, descanso, finalizar.
- Histórico: sessões, sequência de dias, gráfico semanal.
- Alimentação: visualiza plano do personal.
- Mensagens: chat com personal.
- Suporte: enviar feedback.
- Perfil: dados, lembretes, notificações granulares, LGPD (exportar/excluir dados).

PERGUNTAS FREQUENTES:
Q: Como criar um treino? A: Treinos → Novo treino → escolha aluno → adicione divisões e exercícios (biblioteca ou manual).
Q: Como adicionar vídeo a exercício? A: No treino, campo "URL do vídeo (opcional)" em cada exercício. Cole link YouTube/Vimeo.
Q: Como arquivar treino? A: Ficha do aluno → ícone de arquivo ao lado do treino.
Q: Aluno não vê treino? A: Verifique status "Ativo" (não rascunho/arquivado).
Q: Como registrar avaliação física? A: Ficha do aluno → "Avaliação" nas ações rápidas.
Q: Como definir metas? A: Ficha do aluno → "Metas do aluno" → digite título → +. Ajuste progresso ±10%.
Q: Como criar plano alimentar? A: Ficha do aluno → "Alimentação" → adicione refeições e itens.
Q: Como enviar mensagem ao aluno? A: Mensagens → escolha aluno → envie.
Q: Notificações não chegam? A: Aluno deve ativar "Avisos neste aparelho" no perfil. No web são in-app (sino).
Q: Como redefinir senha de aluno? A: Ficha do aluno → Acesso → "Enviar link de redefinição".
Q: Teste de 7 dias acabou? A: Aguarde aprovação do admin. Admin pode aprovar ou estender.
Q: Como admin aprova conta? A: Painel master → Personais → Aprovar/Rejeitar/Estender teste.
Q: Tela preta ao clicar notificação? A: Atualize o app (Ctrl+Shift+R). Reporte o tipo se persistir.
Q: Erro "violates row-level security"? A: Rode fix_rls_comunicacao.sql no Supabase.
Q: Dados não aparecem? A: Verifique se o SQL de upgrade foi executado no Supabase.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents,
            generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
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
