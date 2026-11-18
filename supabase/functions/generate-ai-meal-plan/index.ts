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
  'Use obrigatoriamente os alimentos que a pessoa mais gosta. Quando a ficha trouxer preferências por refeição (café, lanche, almoço, jantar e frutas), respeite cada uma na refeição correspondente e adapte o restante à rotina informada.',
  'Em todas as refeições, preencha notes exatamente com "Escolha 1 opção desta refeição."',
  'Respeite objetivo, restrições, lesões, idade, peso, altura e preferências informadas.',
  'Quando o contexto informar meta calórica diária, distribua as calorias das opções de modo que cada refeição fique próxima de meta/5 kcal e nunca ultrapasse a meta diária ao escolher 1 opção por refeição.',
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
  role: string;
  is_autonomous: boolean;
  full_name: string | null;
  ai_meal_last_generated_at: string | null;
  ai_meal_generation_count: number;
  ai_meal_regeneration_unlocked: boolean;
  ai_meal_favorite_foods: string | null;
  ai_meal_routine: string | null;
  ai_meal_preferences: Record<string, unknown> | null;
};

type MealPreferences = {
  breakfast: string;
  snack: string;
  lunch: string;
  dinner: string;
  fruits: string;
  routine: string;
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

type CalorieGoal = 'lose' | 'gain' | 'maintain';

type CalorieCalculation = {
  bmr: number;
  burn: number;
  target: number;
  goal: CalorieGoal;
  adjustment: number;
  activityFactor: number;
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

function isRetryableGeminiError(status: number, message: string) {
  const text = message.toLowerCase();
  return (
    status === 404 ||
    status === 429 ||
    status === 500 ||
    status === 503 ||
    /high demand|overload|capacity|temporarily unavailable|rate limit|resource exhausted|unavailable/i.test(
      text,
    )
  );
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

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateCalories(context: Record<string, unknown>): CalorieCalculation | null {
  const age = finiteNumber(context.age);
  const weight = finiteNumber(context.weight_kg);
  const height = finiteNumber(context.height_cm);
  if (
    age === null ||
    weight === null ||
    height === null ||
    age < 12 ||
    age > 100 ||
    weight < 30 ||
    weight > 300 ||
    height < 100 ||
    height > 250
  ) {
    return null;
  }

  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age - 78);
  const days = finiteNumber(context.days_per_week) ?? 0;
  const minutes = finiteNumber(context.session_minutes) ?? 0;
  const level = String(context.level ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  let activityFactor = 1.2;
  if (days >= 6) activityFactor = 1.725;
  else if (days >= 4) activityFactor = 1.6;
  else if (days >= 2) activityFactor = 1.45;
  else if (days >= 1) activityFactor = 1.375;

  if (minutes >= 75) activityFactor += 0.075;
  else if (minutes >= 60) activityFactor += 0.05;
  if (/avancad|experiente/.test(level)) activityFactor += 0.05;
  activityFactor = Math.min(1.9, Math.max(1.2, activityFactor));

  const burn = Math.round(bmr * activityFactor);
  const objective = String(context.objective ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  let goal: CalorieGoal = 'maintain';
  let adjustment = 0;
  if (/emagre|perder|secar|reduz|deficit/.test(objective)) {
    goal = 'lose';
    adjustment = -500;
  } else if (/ganhar|hipertrofi|mass[aa] muscular|aumentar/.test(objective)) {
    goal = 'gain';
    adjustment = 300;
  }

  const target = Math.max(Math.round(burn + adjustment), Math.round(bmr * 1.1), 1400);
  return { bmr, burn, target, goal, adjustment, activityFactor };
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

async function callOpenAi(systemPrompt: string, prompt: string, key: string, model: string) {
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.error?.message ?? `OpenAI ${response.status}`));
  }
  return payload;
}

async function callGemini(
  systemPrompt: string,
  prompt: string,
  key: string,
  configuredModel: string,
) {
  const models = [...new Set([configuredModel, 'gemini-3.5-flash-lite', 'gemini-3.8-flash'])];
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
          systemInstruction: { parts: [{ text: systemPrompt }] },
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

    const message = String(payload?.error?.message ?? `Gemini ${response.status}`);
    lastError = new Error(message);
    if (!isRetryableGeminiError(response.status, message)) throw lastError;
  }

  throw lastError ?? new Error('Gemini indisponível.');
}

async function callProvider(settings: Settings, prompt: string) {
  const isGemini = settings.provider === 'gemini';
  const providerSecret = isGemini ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
  const key =
    settings.api_key?.trim() ||
    Deno.env.get('AI_API_KEY')?.trim() ||
    Deno.env.get(providerSecret)?.trim();
  if (!key) {
    throw new Error('Chave de IA não configurada no painel Admin Master ou nas secrets do Supabase.');
  }

  if (isGemini) {
    try {
      return await callGemini(
        mealSystemPrompt,
        prompt,
        key,
        settings.model?.trim() || 'gemini-3.5-flash-lite',
      );
    } catch (geminiError) {
      const openAiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
      if (openAiKey) {
        try {
          return await callOpenAi(mealSystemPrompt, prompt, openAiKey, 'gpt-4o-mini');
        } catch (openAiError) {
          throw new Error(
            `Gemini: ${geminiError instanceof Error ? geminiError.message : 'falhou'}. OpenAI: ${
              openAiError instanceof Error ? openAiError.message : 'falhou'
            }.`,
          );
        }
      }
      throw geminiError;
    }
  }

  try {
    return await callOpenAi(
      mealSystemPrompt,
      prompt,
      key,
      settings.model?.trim() || 'gpt-4o-mini',
    );
  } catch (openAiError) {
    const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (geminiKey) {
      try {
        return await callGemini(mealSystemPrompt, prompt, geminiKey, 'gemini-3.5-flash-lite');
      } catch (geminiError) {
        throw new Error(
          `OpenAI: ${openAiError instanceof Error ? openAiError.message : 'falhou'}. Gemini: ${
            geminiError instanceof Error ? geminiError.message : 'falhou'
          }.`,
        );
      }
    }
    throw openAiError;
  }
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
    const rawPreferences =
      payload?.meal_preferences && typeof payload.meal_preferences === 'object'
        ? payload.meal_preferences
        : {};
    const mealPreferences: MealPreferences = {
      breakfast: String(rawPreferences.breakfast ?? '').trim().slice(0, 300),
      snack: String(rawPreferences.snack ?? '').trim().slice(0, 300),
      lunch: String(rawPreferences.lunch ?? '').trim().slice(0, 300),
      dinner: String(rawPreferences.dinner ?? '').trim().slice(0, 300),
      fruits: String(rawPreferences.fruits ?? '').trim().slice(0, 300),
      routine: mealRoutine,
    };
    const hasStructuredPreferences = Object.values(mealPreferences).some(Boolean);
    const hasNewPreferences = Boolean(favoriteFoods || mealRoutine || hasStructuredPreferences);

    const settingsRows = (await rest('ai_settings?id=eq.1&select=*')) as Settings[];
    const settings = settingsRows?.[0];
    if (!settings?.enabled) {
      return json({ error: 'O cadastro com IA está desativado no momento.' }, 403);
    }

    const profileRows = (await rest(
      `profiles?id=eq.${encodeURIComponent(user.id)}&select=role,is_autonomous,full_name,ai_meal_last_generated_at,ai_meal_generation_count,ai_meal_regeneration_unlocked,ai_meal_favorite_foods,ai_meal_routine,ai_meal_preferences`,
    )) as Profile[];
    const profile = profileRows?.[0];
    if (profile?.role !== 'aluno') {
      return json({ error: 'Este recurso é exclusivo para alunos.' }, 403);
    }

    const coachRows = profile.is_autonomous
      ? []
      : ((await rest(
          `coach_students?student_id=eq.${encodeURIComponent(user.id)}&select=coach_id&limit=1`,
        )) as { coach_id: string }[]);
    const coachId = profile.is_autonomous ? user.id : coachRows?.[0]?.coach_id || user.id;

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
      days_per_week: anamnesis.days_per_week ?? measurements.days_per_week ?? null,
      session_minutes: anamnesis.session_minutes ?? measurements.session_minutes ?? null,
      restrictions: anamnesis.restrictions ?? null,
      injuries: anamnesis.injuries ?? null,
      age: anamnesis.age ?? measurements.age ?? null,
      weight_kg: assessment.weight_kg ?? anamnesis.weight_kg ?? null,
      height_cm: assessment.height_cm ?? anamnesis.height_cm ?? null,
      location: anamnesis.location ?? null,
      favorite_foods:
        favoriteFoods || profile.ai_meal_favorite_foods || anamnesis.favorite_foods || null,
      meal_routine: mealRoutine || profile.ai_meal_routine || anamnesis.meal_routine || null,
      meal_preferences: hasStructuredPreferences
        ? mealPreferences
        : profile.ai_meal_preferences ?? null,
      notes: String(payload?.notes ?? payload?.preferences ?? anamnesis.notes ?? '').slice(0, 500),
    };

    const calories = calculateCalories(context);
    const goalLabels: Record<CalorieGoal, string> = {
      lose: 'emagrecer',
      gain: 'ganhar massa',
      maintain: 'manter peso',
    };
    const prompt = [
      'Crie um plano alimentar personalizado com base nestes dados:',
      JSON.stringify(
        {
          ...context,
          calorie_target: calories
            ? {
                gasto_diario_kcal: calories.burn,
                meta_diaria_kcal: calories.target,
                objetivo: goalLabels[calories.goal],
                ajuste_kcal: calories.adjustment,
              }
            : null,
        },
        null,
        2,
      ),
    ].join('\n');

    const aiPayload = await callProvider(settings, prompt);
    const plan = parsePlan(aiPayload);
    const now = new Date().toISOString();
    const existingRows = (await rest(
      `meal_plans?student_id=eq.${encodeURIComponent(user.id)}&select=id,coach_id&order=updated_at.desc`,
    )) as { id: string; coach_id: string }[];
    const existing = existingRows?.find((row) => row.coach_id === coachId) ?? existingRows?.[0];

    let mealPlanId: string | undefined;
    if (existing?.id) {
      const updated = (await rest(`meal_plans?id=eq.${encodeURIComponent(existing.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: plan.title,
          notes: plan.notes,
          ai_generated: true,
          daily_burn_kcal: calories?.burn ?? null,
          daily_target_kcal: calories?.target ?? null,
          calorie_goal: calories?.goal ?? null,
          meals: plan.meals,
          updated_at: now,
        }),
      })) as { id: string }[];
      mealPlanId = updated?.[0]?.id ?? existing.id;
    } else {
      const created = (await rest('meal_plans', {
        method: 'POST',
        body: JSON.stringify({
          coach_id: coachId,
          student_id: user.id,
          title: plan.title,
          notes: plan.notes,
          ai_generated: true,
          daily_burn_kcal: calories?.burn ?? null,
          daily_target_kcal: calories?.target ?? null,
          calorie_goal: calories?.goal ?? null,
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
        ...(hasStructuredPreferences ? { ai_meal_preferences: mealPreferences } : {}),
      }),
    });

    return json({
      mealPlanId,
      title: plan.title,
      mealsCount: plan.meals.length,
      calories: calories
        ? {
            burn: calories.burn,
            target: calories.target,
            goal: calories.goal,
            adjustment: calories.adjustment,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao gerar o plano alimentar.';
    return json({ error: message }, 500);
  }
});
