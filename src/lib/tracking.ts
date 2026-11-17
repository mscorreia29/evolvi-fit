import { supabase } from '@/lib/supabase';
import type { MealLog, WaterLog } from '@/lib/types';

export function todayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function fetchTodayWater(studentId: string) {
  const day = todayDateString();
  const { data, error } = await supabase
    .from('water_logs')
    .select('*')
    .eq('student_id', studentId)
    .eq('log_date', day)
    .maybeSingle();
  return { log: (data as WaterLog | null) ?? null, error: error?.message ?? null };
}

export async function addWater(studentId: string, amountMl: number, goalMl = 2500) {
  const day = todayDateString();
  const { data: existing } = await supabase
    .from('water_logs')
    .select('amount_ml, goal_ml')
    .eq('student_id', studentId)
    .eq('log_date', day)
    .maybeSingle();

  const current = (existing?.amount_ml as number | undefined) ?? 0;
  const goal = (existing?.goal_ml as number | undefined) ?? goalMl;
  const next = Math.max(0, current + amountMl);

  const { data, error } = await supabase
    .from('water_logs')
    .upsert(
      { student_id: studentId, log_date: day, amount_ml: next, goal_ml: goal, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,log_date' },
    )
    .select('*')
    .maybeSingle();
  return { log: (data as WaterLog | null) ?? null, error: error?.message ?? null };
}

export async function setWaterGoal(studentId: string, goalMl: number) {
  const day = todayDateString();
  const { data: existing } = await supabase
    .from('water_logs')
    .select('amount_ml')
    .eq('student_id', studentId)
    .eq('log_date', day)
    .maybeSingle();
  const amount = (existing?.amount_ml as number | undefined) ?? 0;
  const { data, error } = await supabase
    .from('water_logs')
    .upsert(
      { student_id: studentId, log_date: day, amount_ml: amount, goal_ml: goalMl, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,log_date' },
    )
    .select('*')
    .maybeSingle();
  return { log: (data as WaterLog | null) ?? null, error: error?.message ?? null };
}

export async function fetchTodayMeals(studentId: string) {
  const day = todayDateString();
  const { data, error } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('student_id', studentId)
    .eq('log_date', day)
    .order('created_at', { ascending: true });
  return { meals: (data as MealLog[]) ?? [], error: error?.message ?? null };
}

export async function logMeal(studentId: string, mealName: string, calories?: number | null, notes?: string | null) {
  const day = todayDateString();
  const { data, error } = await supabase
    .from('meal_logs')
    .insert({ student_id: studentId, log_date: day, meal_name: mealName, calories: calories ?? null, notes: notes ?? null })
    .select('*')
    .maybeSingle();
  return { meal: (data as MealLog | null) ?? null, error: error?.message ?? null };
}

export async function deleteMeal(mealId: string) {
  const { error } = await supabase.from('meal_logs').delete().eq('id', mealId);
  return { error: error?.message ?? null };
}

export async function fetchWeekActivity(studentId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
  const [sessionsRes, waterRes, mealsRes] = await Promise.all([
    supabase
      .from('workout_sessions')
      .select('id, performed_at, duration_seconds')
      .eq('student_id', studentId)
      .gte('performed_at', sinceStr),
    supabase.from('water_logs').select('log_date, amount_ml, goal_ml').eq('student_id', studentId).gte('log_date', sinceStr),
    supabase.from('meal_logs').select('log_date, calories').eq('student_id', studentId).gte('log_date', sinceStr),
  ]);

  const sessions = (sessionsRes.data as { id: string; performed_at: string; duration_seconds: number | null }[]) ?? [];
  const sessionIds = sessions.map((session) => session.id);
  const { data: setRows } = sessionIds.length > 0
    ? await supabase.from('session_exercises').select('session_id, sets_done').in('session_id', sessionIds)
    : { data: [] };

  const series = ((setRows as { session_id: string; sets_done: number | null }[] | null) ?? []).reduce(
    (sum, row) => sum + (row.sets_done ?? 0),
    0,
  );

  return {
    sessions,
    water: (waterRes.data as { log_date: string; amount_ml: number; goal_ml: number }[]) ?? [],
    meals: (mealsRes.data as { log_date: string; calories: number | null }[]) ?? [],
    series,
  };
}

export async function addXp(studentId: string, amount: number) {
  // read current xp
  const { data } = await supabase.from('profiles').select('xp').eq('id', studentId).maybeSingle();
  const current = (data?.xp as number | undefined) ?? 0;
  const { error } = await supabase.from('profiles').update({ xp: current + amount }).eq('id', studentId);
  return { error: error?.message ?? null, newXp: current + amount };
}
