const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const mealSystemPrompt = [
  'Você é um nutricionista experiente e cria planos alimentares simples, seguros e realistas em português do Brasil.',
  'Responda APENAS com JSON no formato: {"title":"Plano alimentar personalizado","notes":"Orientações gerais","meals":[{"name":"Café da manhã","time":"07:30","notes":"Escolha 1 opção desta refeição.","items":[{"name":"Ovos mexidos com pão integral e mamão","quantity":"1 porção","calories":320}]}]}.',
  'Cada item de "items" deve ser uma OPÇÃO COMPLETA de refeição ou prato, com nome que descreva a combinação. Nunca liste alimentos soltos como opções separadas.',
  'Gere exatamente 5 refeições, cada uma com exatamente 6 opções completas diferentes e intercambiáveis. As calorias devem ser da opção inteira.',
  'Use obrigatoriamente os alimentos que a pessoa mais gosta e adapte as opções à rotina alimentar informada na ficha.',
  'Em todas as refeições, preencha notes exatamente com "Escolha 1 opção desta refeição."',
  'Respeite objetivo, restrições, lesões, idade, peso, altura e preferências informadas.',
  'Não prescreva medicamentos, suplementos obrigatórios ou dietas radicais. Em caso de dúvida, priorize alimentos naturais e oriente procurar um profissional presencial.',
].join(' ');

type Settings = {
  id: number;
  enabled: boolean;
  provider: 'gemini' | 'openai';
  api_key: string | null;
  generation_interval_days: number;
  allow_manual_regeneration: boolean;
  model: string | null;
};

type Profile = {
  is_autonomous: boolean;
  full_name: string | null;
  ai_meal_last_generated_at: string | null;
  ai_meal_generation_count: number;
  ai_meal_regeneration_unlocked: boolean;
  ai_meal_favorite_foods: string | null;
  ai_meal_routine: string | null;
};

type MealItem = {
  id: string;
  name: string;
  quantity: string;
  calories: number | null;
};

type Meal = {
  id: string;
  name: string;
  time: string;
  notes: string;
  items: MealItem[];
};

type MealPlan = {
  title: string;
  notes: string;
  meals: Meal[];
};

const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Supabase REST ${response.status}`);
  }
  return text ? JSON.parse(text) : null;
}

function extractContent(payload: any) {
  const geminiText = payload?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text ?? '')
    .join('');
  const openAiText = payload?.choices?.[0]?.message?.content;
  const value = geminiText || openAiText || '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parsePlan(payload: any): MealPlan {
  const raw = extractContent(payload);
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(cleaned);

  const meals = (Array.isArray(parsed?.meals) ? parsed.meals : [])
    .slice(0, 8)
    .map((meal: any, mealIndex: number) => {
      const items = (Array.isArray(meal?.items) ? meal.items : [])
        .slice(0, 12)
        .map((item: any, itemIndex: number) => {
          const calories = Number(item?.calories);
          return {
            id: `item-${mealIndex + 1}-${itemIndex + 1}`,
            name: String(item?.name ?? 'Alimento').slice(0, 120),
            quantity: String(item?.quantity ?? '').slice(0, 60),
            calories: Number.isFinite(calories) ? Math.max(0, Math.round(calories)) : null,
          };
        })
        .filter((item: MealItem) => item.name);

      return {
        id: `meal-${mealIndex + 1}`,
        name: String(meal?.name ?? `Refeição ${mealIndex + 1}`).slice(0, 80),
        time: String(meal?.time ?? '').slice(0, 20),
        notes: String(meal?.notes ?? '').slice(0, 300),
        items,
      };
    })
    .filter((meal: Meal) => meal.items.length > 0);

  if (!meals.length) {
    throw new Error('A IA não retornou um plano alimentar válido.');
  }

  return {
    title: String(parsed?.title ?? 'Plano alimentar IA').slice(0, 80),
    notes: String(parsed?.notes ?? '').slice(0, 1000),
    meals,
  };
}

async function callProvider(settings: Settings, prompt: string) {
  const providerSecret = settings.provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
  const key =
    settings.api_key?.trim() ||
    Deno.env.get('AI_API_KEY')?.trim() ||
    Deno.env.get(providerSecret)?.trim();
  if (!key) {
    throw new Error('Chave de IA não configurada no painel Admin Master ou nas secrets do Supabase.');
  }

  if (settings.provider === 'openai') {
    const model = settings.model?.trim() || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: mealSystemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `OpenAI ${response.status}`);
    }
    return payload;
  }

  const configuredModel = settings.model?.trim() || 'gemini-3.1-flash-lite';
  const models = [...new Set([configuredModel, 'gemini-3.1-flash-lite'])];
  let lastError: Error | null = null;

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: mealSystemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: 'application/json',
          },
        }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;

    lastError = new Error(payload?.error?.message ?? `Gemini ${response.status}`);
    if (response.status !== 404 && response.status !== 503) throw lastError;
  }

  throw lastError ?? new Error('Gemini indisponível.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json({}, 200);
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  try {
    if (!supabaseUrl || !serviceKey || !anonKey) {
      throw new Error('Supabase não configurado na Edge Function.');
    }

    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return json({ error: 'Sessão inválida.' }, 401);
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
    if (!userResponse.ok) {
      return json({ error: 'Sessão inválida.' }, 401);
    }
    const user = (await userResponse.json()) as { id: string };
    if (!user?.id) {
      return json({ error: 'Sessão inválida.' }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const favoriteFoods = String(payload?.favorite_foods ?? '').trim().slice(0, 1000);
    const mealRoutine = String(payload?.meal_routine ?? '').trim().slice(0, 1000);
    const hasNewPreferences = Boolean(favoriteFoods || mealRoutine);

    const settingsRows = (await rest('ai_settings?id=eq.1&select=*')) as Settings[];
    const settings = settingsRows?.[0];
    if (!settings?.enabled) {
      return json({ error: 'O cadastro com IA está desativado no momento.' }, 403);
    }

    const profileRows = (await rest(
      `profiles?id=eq.${encodeURIComponent(user.id)}&select=is_autonomous,full_name,ai_meal_last_generated_at,ai_meal_generation_count,ai_meal_regeneration_unlocked,ai_meal_favorite_foods,ai_meal_routine`,
    )) as Profile[];
    const profile = profileRows?.[0];
    if (!profile?.is_autonomous) {
      return json({ error: 'Este recurso é exclusivo para alunos autônomos.' }, 403);
    }

    const lastGenerated = profile.ai_meal_last_generated_at
      ? new Date(profile.ai_meal_last_generated_at).getTime()
      : 0;
    const intervalMs = settings.generation_interval_days * 24 * 60 * 60 * 1000;
    const withinInterval = lastGenerated > 0 && Date.now() - lastGenerated < intervalMs;
    if (
      withinInterval &&
      !hasNewPreferences &&
      !profile.ai_meal_regeneration_unlocked &&
      !settings.allow_manual_regeneration
    ) {
      const days = Math.max(
        1,
        Math.ceil((intervalMs - (Date.now() - lastGenerated)) / (24 * 60 * 60 * 1000)),
      );
      return json(
        { error: `Você já gerou um plano alimentar recentemente. Aguarde ${days} dia(s).` },
        429,
      );
    }

    const [anamnesisRows, assessmentRows] = await Promise.all([
      rest(
        `anamnesis?student_id=eq.${encodeURIComponent(user.id)}&select=data,created_at&order=created_at.desc&limit=1`,
      ),
      rest(
        `physical_assessments?student_id=eq.${encodeURIComponent(user.id)}&select=weight_kg,height_cm,measurements,created_at&order=created_at.desc&limit=1`,
      ),
    ]);
    const anamnesis = (anamnesisRows?.[0]?.data ?? {}) as Record<string, unknown>;
    const assessment = (assessmentRows?.[0] ?? {}) as Record<string, unknown>;
    const measurements = (assessment.measurements ?? {}) as Record<string, unknown>;

    const context = {
      full_name: profile.full_name ?? anamnesis.full_name ?? null,
      objective: anamnesis.objective ?? null,
      level: anamnesis.level ?? null,
      restrictions: anamnesis.restrictions ?? null,
      injuries: anamnesis.injuries ?? null,
      age: anamnesis.age ?? measurements.age ?? null,
      weight_kg: assessment.weight_kg ?? anamnesis.weight_kg ?? null,
      height_cm: assessment.height_cm ?? anamnesis.height_cm ?? null,
      location: anamnesis.location ?? null,
      favorite_foods:
        favoriteFoods || profile.ai_meal_favorite_foods || anamnesis.favorite_foods || null,
      meal_routine: mealRoutine || profile.ai_meal_routine || anamnesis.meal_routine || null,
      notes: String(payload?.notes ?? payload?.preferences ?? anamnesis.notes ?? '').slice(0, 500),
    };

    const prompt = [
      'Crie um plano alimentar personalizado com base nestes dados:',
      JSON.stringify(context, null, 2),
    ].join('\n');

    const aiPayload = await callProvider(settings, prompt);
    const plan = parsePlan(aiPayload);
    const now = new Date().toISOString();
    const existing = (await rest(
      `meal_plans?coach_id=eq.${encodeURIComponent(user.id)}&student_id=eq.${encodeURIComponent(user.id)}&select=id`,
    )) as { id: string }[];

    let mealPlanId: string | undefined;
    if (existing?.[0]?.id) {
      const updated = (await rest(`meal_plans?id=eq.${encodeURIComponent(existing[0].id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: plan.title,
          notes: plan.notes,
          ai_generated: true,
          meals: plan.meals,
          updated_at: now,
        }),
      })) as { id: string }[];
      mealPlanId = updated?.[0]?.id ?? existing[0].id;
    } else {
      const created = (await rest('meal_plans', {
        method: 'POST',
        body: JSON.stringify({
          coach_id: user.id,
          student_id: user.id,
          title: plan.title,
          notes: plan.notes,
          ai_generated: true,
          meals: plan.meals,
          updated_at: now,
        }),
      })) as { id: string }[];
      mealPlanId = created?.[0]?.id;
    }

    if (!mealPlanId) {
      throw new Error('Não foi possível salvar o plano alimentar gerado.');
    }

    await rest(`profiles?id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ai_meal_last_generated_at: now,
        ai_meal_generation_count: (profile.ai_meal_generation_count ?? 0) + 1,
        ai_meal_regeneration_unlocked: false,
        ...(favoriteFoods ? { ai_meal_favorite_foods: favoriteFoods } : {}),
        ...(mealRoutine ? { ai_meal_routine: mealRoutine } : {}),
      }),
    });

    return json({ mealPlanId, title: plan.title, mealsCount: plan.meals.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao gerar o plano alimentar.';
    return json({ error: message }, 500);
  }
});
