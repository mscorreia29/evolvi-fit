const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Settings = {
  id: number;
  enabled: boolean;
  provider: 'gemini' | 'openai';
  api_key: string | null;
  prompt_base: string;
  generation_interval_days: number;
  allow_manual_regeneration: boolean;
  model: string | null;
};

type Profile = {
  is_autonomous: boolean;
  ai_last_generated_at: string | null;
  ai_generation_count: number;
  ai_regeneration_unlocked: boolean;
};

type ExercisePlan = {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string | null;
};

type DayPlan = {
  label: string;
  exercises: ExercisePlan[];
};

type WorkoutPlan = {
  name: string;
  days: DayPlan[];
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

function parsePlan(payload: any): WorkoutPlan {
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
  const rawDays = Array.isArray(parsed?.days) ? parsed.days : [];

  const days = rawDays.slice(0, 7).map((day: any, dayIndex: number) => {
    const rawExercises = Array.isArray(day?.exercises) ? day.exercises : [];
    const exercises = rawExercises.slice(0, 12).map((exercise: any) => ({
      name: String(exercise?.name ?? 'Exercício').slice(0, 120),
      sets: Math.min(12, Math.max(1, Number(exercise?.sets) || 3)),
      reps: String(exercise?.reps ?? '10-12').slice(0, 40),
      rest_seconds: Math.min(600, Math.max(0, Number(exercise?.rest_seconds) || 60)),
      notes: exercise?.notes ? String(exercise.notes).slice(0, 300) : null,
    }));
    return {
      label: String(day?.label ?? String.fromCharCode(65 + dayIndex)).slice(0, 4),
      exercises,
    };
  });

  if (!days.length || days.every((day: DayPlan) => day.exercises.length === 0)) {
    throw new Error('A IA não retornou exercícios válidos.');
  }

  return {
    name: String(parsed?.name ?? 'Treino gerado por IA').slice(0, 80),
    days,
  };
}

async function callProvider(settings: Settings, prompt: string) {
  const key = settings.api_key?.trim() || Deno.env.get('AI_API_KEY')?.trim();
  if (!key) {
    throw new Error('Chave de IA não configurada no painel Admin Master.');
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
          { role: 'system', content: settings.prompt_base },
          { role: 'user', content: prompt },
        ],
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `OpenAI ${response.status}`);
    }
    return payload;
  }

  const model = settings.model?.trim() || 'gemini-2.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: settings.prompt_base }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
    },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Gemini ${response.status}`);
  }
  return payload;
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

    const settingsRows = (await rest('ai_settings?id=eq.1&select=*')) as Settings[];
    const settings = settingsRows?.[0];
    if (!settings?.enabled) {
      return json({ error: 'O cadastro com IA está desativado no momento.' }, 403);
    }

    const profileRows = (await rest(
      `profiles?id=eq.${encodeURIComponent(user.id)}&select=is_autonomous,ai_last_generated_at,ai_generation_count,ai_regeneration_unlocked`,
    )) as Profile[];
    const profile = profileRows?.[0];
    if (!profile?.is_autonomous) {
      return json({ error: 'Este recurso é exclusivo para alunos autônomos.' }, 403);
    }

    const lastGenerated = profile.ai_last_generated_at
      ? new Date(profile.ai_last_generated_at).getTime()
      : 0;
    const intervalMs = settings.generation_interval_days * 24 * 60 * 60 * 1000;
    const withinInterval = lastGenerated > 0 && Date.now() - lastGenerated < intervalMs;
    if (
      withinInterval &&
      !profile.ai_regeneration_unlocked &&
      !settings.allow_manual_regeneration
    ) {
      const days = Math.max(
        1,
        Math.ceil((intervalMs - (Date.now() - lastGenerated)) / (24 * 60 * 60 * 1000)),
      );
      return json(
        { error: `Você já gerou um treino recentemente. Aguarde ${days} dia(s) ou peça uma liberação ao administrador.` },
        429,
      );
    }

    const payload = await req.json();
    const anamnesis = {
      objective: String(payload?.objective ?? ''),
      level: String(payload?.level ?? ''),
      days_per_week: Number(payload?.days_per_week) || 3,
      session_minutes: Number(payload?.session_minutes) || 50,
      location: String(payload?.location ?? ''),
      restrictions: String(payload?.restrictions ?? ''),
      injuries: String(payload?.injuries ?? ''),
      age: Number(payload?.age) || null,
      weight_kg: Number(payload?.weight_kg) || null,
      height_cm: Number(payload?.height_cm) || null,
      notes: String(payload?.notes ?? ''),
    };

    if (!anamnesis.objective || !anamnesis.level || !anamnesis.location) {
      return json({ error: 'Preencha objetivo, nível e local de treino.' }, 400);
    }

    const prompt = [
      'Gere um plano de treino personalizado com base nos dados abaixo.',
      'Use somente exercícios seguros e adequados ao histórico informado.',
      `Dias por semana: ${anamnesis.days_per_week}.`,
      `Duração por sessão: ${anamnesis.session_minutes} minutos.`,
      JSON.stringify(anamnesis, null, 2),
    ].join('\n');

    const aiPayload = await callProvider(settings, prompt);
    const plan = parsePlan(aiPayload);

    const workouts = (await rest('workouts', {
      method: 'POST',
      body: JSON.stringify({
        coach_id: user.id,
        student_id: user.id,
        name: plan.name,
        status: 'active',
        generated_by_ai: true,
      }),
    })) as { id: string }[];
    const workoutId = workouts?.[0]?.id;
    if (!workoutId) {
      throw new Error('Não foi possível salvar o treino gerado.');
    }

    for (let dayIndex = 0; dayIndex < plan.days.length; dayIndex += 1) {
      const day = plan.days[dayIndex];
      const days = (await rest('workout_days', {
        method: 'POST',
        body: JSON.stringify({
          workout_id: workoutId,
          label: day.label,
          order_index: dayIndex,
        }),
      })) as { id: string }[];
      const dayId = days?.[0]?.id;
      if (!dayId) continue;

      for (let exerciseIndex = 0; exerciseIndex < day.exercises.length; exerciseIndex += 1) {
        const exercise = day.exercises[exerciseIndex];
        await rest('workout_exercises', {
          method: 'POST',
          body: JSON.stringify({
            workout_day_id: dayId,
            exercise_id: null,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            rest_seconds: exercise.rest_seconds,
            notes: exercise.notes,
            order_index: exerciseIndex,
          }),
        });
      }
    }

    await rest(`profiles?id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ai_last_generated_at: new Date().toISOString(),
        ai_generation_count: (profile.ai_generation_count ?? 0) + 1,
        ai_regeneration_unlocked: false,
      }),
    });

    return json({ workoutId, name: plan.name, days: plan.days.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao gerar o treino.';
    return json({ error: message }, 500);
  }
});
