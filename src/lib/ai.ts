import { supabase } from '@/lib/supabase';

export type AiProvider = 'gemini' | 'openai';

export type AiSettings = {
  id: number;
  enabled: boolean;
  provider: AiProvider;
  api_key: string | null;
  prompt_base: string;
  generation_interval_days: number;
  allow_manual_regeneration: boolean;
  model: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type AiStudent = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_autonomous: boolean;
  ai_last_generated_at: string | null;
  ai_generation_count: number;
  ai_regeneration_unlocked: boolean;
  created_at: string;
};

export type AutonomousAnamnesis = {
  full_name: string;
  objective: string;
  level: string;
  days_per_week: number;
  session_minutes: number;
  location: string;
  restrictions: string;
  injuries: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  notes: string;
};

export type AiSettingsInput = {
  enabled: boolean;
  provider: AiProvider;
  apiKey: string;
  clearApiKey: boolean;
  promptBase: string;
  generationIntervalDays: number;
  allowManualRegeneration: boolean;
  model: string;
};

export async function isAiSignupEnabled() {
  const { data, error } = await supabase.rpc('ai_signup_enabled');
  if (error) return false;
  return Boolean(data);
}

export async function signUpAutonomous(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        role: 'aluno',
        full_name: fullName.trim(),
        is_autonomous: true,
      },
    },
  });

  return {
    error: error?.message ?? null,
    needsConfirmation: !data.session,
  };
}

export async function saveAutonomousAnamnesis(userId: string, payload: AutonomousAnamnesis) {
  await supabase
    .from('profiles')
    .update({ full_name: payload.full_name.trim() })
    .eq('id', userId);

  const { error: anamnesisError } = await supabase.from('anamnesis').insert({
    coach_id: userId,
    student_id: userId,
    data: {
      ...payload,
      origin: 'ai_autonomo',
      created_at: new Date().toISOString(),
    },
  });
  if (anamnesisError) throw new Error(anamnesisError.message);

  const { error: assessmentError } = await supabase.from('physical_assessments').insert({
    coach_id: userId,
    student_id: userId,
    weight_kg: payload.weight_kg,
    height_cm: payload.height_cm,
    measurements: {
      age: payload.age,
      origin: 'ai_autonomo',
    },
  });
  if (assessmentError) throw new Error(assessmentError.message);
}

export async function generateAiWorkout(payload: AutonomousAnamnesis) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('Sessão expirada. Entre novamente para continuar.');
  }

  const { data, error } = await supabase.functions.invoke('generate-ai-workout', {
    body: payload,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    let detail = error.message || 'Falha ao chamar o serviço de IA.';
    try {
      const body = (await context?.json?.()) as { error?: string; message?: string } | undefined;
      if (body?.error) detail = body.error;
      else if (body?.message) detail = body.message;
    } catch {}
    throw new Error(detail);
  }

  const result = data as { error?: string; workoutId?: string; name?: string; days?: number } | null;
  if (result?.error) {
    throw new Error(result.error);
  }
  if (!result?.workoutId) {
    throw new Error('A IA não retornou um treino válido.');
  }

  return result as { workoutId: string; name: string; days: number };
}

export async function fetchAiSettings() {
  const { data, error } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AiSettings | null) ?? null;
}

export async function saveAiSettings(input: AiSettingsInput) {
  const { error } = await supabase.rpc('admin_update_ai_settings', {
    p_enabled: input.enabled,
    p_provider: input.provider,
    p_api_key: input.apiKey.trim() ? input.apiKey.trim() : null,
    p_clear_api_key: input.clearApiKey,
    p_prompt_base: input.promptBase,
    p_generation_interval_days: input.generationIntervalDays,
    p_allow_manual_regeneration: input.allowManualRegeneration,
    p_model: input.model.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function fetchAiStudents() {
  const [autonomous, linked] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, is_autonomous, ai_last_generated_at, ai_generation_count, ai_regeneration_unlocked, created_at')
      .eq('is_autonomous', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name, email, is_autonomous, ai_last_generated_at, ai_generation_count, ai_regeneration_unlocked, created_at')
      .eq('role', 'aluno')
      .eq('is_autonomous', false)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (autonomous.error) throw new Error(autonomous.error.message);
  if (linked.error) throw new Error(linked.error.message);

  return {
    autonomous: (autonomous.data ?? []) as AiStudent[],
    linked: (linked.data ?? []) as AiStudent[],
  };
}

export async function unlockAiRegeneration(userId: string) {
  const { error } = await supabase.rpc('admin_unlock_ai_regeneration', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}
