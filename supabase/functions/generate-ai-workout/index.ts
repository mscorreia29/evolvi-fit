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

type WorkoutBlock = {
  name: string;
  day: DayPlan;
};

type WorkoutPlan = {
  name: string;
  blocks: WorkoutBlock[];
};

type LibraryExercise = {
  id: string;
  name: string;
  video_url: string | null;
  instructions: string | null;
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

function extractContent(payload: any) {
  const geminiText = payload?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text ?? '')
    .join('');
  const openAiText = payload?.choices?.[0]?.message?.content;
  const value = geminiText || openAiText || '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function normalizeExerciseName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findLibraryExercise(name: string, library: LibraryExercise[]) {
  const target = normalizeExerciseName(name);
  const exact = library.find((item) => normalizeExerciseName(item.name) === target);
  if (exact) return exact;

  const tokens = target.split(' ').filter((token) => token.length > 2);
  let best: LibraryExercise | null = null;
  let bestScore = 0;

  for (const item of library) {
    const candidate = normalizeExerciseName(item.name);
    const score = tokens.reduce((total, token) => total + (candidate.includes(token) ? 1 : 0), 0);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  return bestScore >= 2 ? best : null;
}

function parsePlan(payload: any, maxBlocks: number): WorkoutPlan {
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
  const baseName = String(parsed?.name ?? 'Treino gerado por IA').slice(0, 80);
  const rawWorkouts = Array.isArray(parsed?.workouts) ? parsed.workouts : [];
  const rawDays = rawWorkouts.length
    ? rawWorkouts.flatMap((workout: any) =>
        Array.isArray(workout?.days) ? workout.days : [],
      )
    : Array.isArray(parsed?.days)
      ? parsed.days
      : [];

  const maxExercises = Math.min(60, maxBlocks * 8);
  const exercises = rawDays
    .flatMap((day: any) =>
      (Array.isArray(day?.exercises) ? day.exercises : []).map((exercise: any) => ({
        name: String(exercise?.name ?? 'Exercício').slice(0, 120),
        sets: Math.min(12, Math.max(1, Number(exercise?.sets) || 3)),
        reps: String(exercise?.reps ?? '10-12').slice(0, 40),
        rest_seconds: Math.min(600, Math.max(0, Number(exercise?.rest_seconds) || 60)),
        notes: exercise?.notes ? String(exercise.notes).slice(0, 300) : null,
      })),
    )
    .slice(0, maxExercises);

  if (!exercises.length) {
    throw new Error('A IA não retornou exercícios válidos.');
  }

  const blockCount = Math.min(maxBlocks, Math.max(1, Math.floor(exercises.length / 3)));
  const chunkSize = Math.ceil(exercises.length / blockCount);
  const blocks: WorkoutBlock[] = [];

  for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
    const chunk = exercises.slice(blockIndex * chunkSize, (blockIndex + 1) * chunkSize);
    if (!chunk.length) continue;

    const label = String.fromCharCode(65 + blockIndex);
    const suggestedName = rawWorkouts[blockIndex]?.name;
    const name = suggestedName
      ? String(suggestedName).slice(0, 80)
      : `${baseName} - Treino ${label}`;

    blocks.push({
      name,
      day: { label, exercises: chunk },
    });
  }

  if (!blocks.length) {
    throw new Error('A IA não retornou blocos de treino válidos.');
  }

  return { name: baseName, blocks };
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
        settings.prompt_base,
        prompt,
        key,
        settings.model?.trim() || 'gemini-3.5-flash-lite',
      );
    } catch (geminiError) {
      const openAiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
      if (openAiKey) {
        try {
          return await callOpenAi(settings.prompt_base, prompt, openAiKey, 'gpt-4o-mini');
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
      settings.prompt_base,
      prompt,
      key,
      settings.model?.trim() || 'gpt-4o-mini',
    );
  } catch (openAiError) {
    const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (geminiKey) {
      try {
        return await callGemini(settings.prompt_base, prompt, geminiKey, 'gemini-3.5-flash-lite');
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

    const maxBlocks = Math.min(7, Math.max(1, anamnesis.days_per_week));
    const library = (await rest(
      'exercises?select=id,name,video_url,instructions&order=name&limit=500',
    )) as LibraryExercise[];
    const prompt = [
      `Gere exatamente ${maxBlocks} treinos/blocos separados e personalizados com base nos dados abaixo.`,
      `Cada bloco deve ter de 3 a 8 exercícios e representar uma sessão diferente. Nunca coloque todos os exercícios em um único treino.`,
      'Retorne APENAS JSON no formato: {"name":"Plano ...","workouts":[{"name":"Treino A - ...","days":[{"label":"A","exercises":[{"name":"...","sets":3,"reps":"10-12","rest_seconds":60,"notes":"..."}]}]}]}.',
      'Use labels A, B, C... e nomes diferentes para cada bloco.',
      'Use somente exercícios seguros e adequados ao histórico informado.',
      `Use preferencialmente estes nomes da biblioteca de exercícios: ${library.map((item) => item.name).slice(0, 200).join(' | ')}`,
      `Duração por sessão: ${anamnesis.session_minutes} minutos.`,
      JSON.stringify(anamnesis, null, 2),
    ].join('\n');

    const aiPayload = await callProvider(settings, prompt);
    const plan = parsePlan(aiPayload, maxBlocks);

    await rest(
      `workouts?student_id=eq.${encodeURIComponent(user.id)}&coach_id=eq.${encodeURIComponent(user.id)}&generated_by_ai=eq.true&status=eq.active`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
        headers: { Prefer: 'return=minimal' },
      },
    );

    const created: { id: string; name: string; exercises: number }[] = [];

    for (const block of plan.blocks) {
      const workouts = (await rest('workouts', {
        method: 'POST',
        body: JSON.stringify({
          coach_id: user.id,
          student_id: user.id,
          name: block.name,
          status: 'active',
          generated_by_ai: true,
        }),
      })) as { id: string }[];
      const workoutId = workouts?.[0]?.id;
      if (!workoutId) {
        throw new Error('Não foi possível salvar os treinos gerados.');
      }

      const days = (await rest('workout_days', {
        method: 'POST',
        body: JSON.stringify({
          workout_id: workoutId,
          label: block.day.label,
          order_index: 0,
        }),
      })) as { id: string }[];
      const dayId = days?.[0]?.id;
      if (!dayId) {
        throw new Error('Não foi possível salvar o bloco de treino.');
      }

      for (let exerciseIndex = 0; exerciseIndex < block.day.exercises.length; exerciseIndex += 1) {
        const exercise = block.day.exercises[exerciseIndex];
        const match = findLibraryExercise(exercise.name, library);
        await rest('workout_exercises', {
          method: 'POST',
          body: JSON.stringify({
            workout_day_id: dayId,
            exercise_id: match?.id ?? null,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            rest_seconds: exercise.rest_seconds,
            notes: exercise.notes,
            video_url: match?.video_url ?? null,
            instructions: match?.instructions ?? null,
            order_index: exerciseIndex,
          }),
        });
      }

      created.push({ id: workoutId, name: block.name, exercises: block.day.exercises.length });
    }

    await rest(`profiles?id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ai_last_generated_at: new Date().toISOString(),
        ai_generation_count: (profile.ai_generation_count ?? 0) + 1,
        ai_regeneration_unlocked: false,
      }),
    });

    const workoutIds = created.map((workout) => workout.id);
    return json({
      workoutId: workoutIds[0],
      workoutIds,
      name: created[0]?.name ?? plan.name,
      days: created.length,
      workouts: created,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao gerar o treino.';
    return json({ error: message }, 500);
  }
});
