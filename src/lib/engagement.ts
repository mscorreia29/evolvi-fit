import { supabase } from '@/lib/supabase';
import type { CoachSettings, DailyChallengeLog, StudentGoal, WeeklyCheckin } from '@/lib/types';

export type DailyChallenge = {
  key: string;
  title: string;
  description: string;
  icon: string;
};

const CHALLENGES: DailyChallenge[] = [
  { key: 'agua', title: 'Beba água', description: 'Tome pelo menos 2L de água hoje.', icon: 'water-outline' },
  { key: 'alongamento', title: 'Alongue-se', description: 'Faça 10 minutos de alongamento.', icon: 'body-outline' },
  { key: 'passos', title: 'Movimente-se', description: 'Caminhe por 20 minutos.', icon: 'walk-outline' },
  { key: 'sono', title: 'Sono em dia', description: 'Durma ao menos 7 horas.', icon: 'moon-outline' },
  { key: 'frutas', title: 'Coma frutas', description: 'Inclua 2 porções de frutas.', icon: 'nutrition-outline' },
  { key: 'treino-foco', title: 'Foco no treino', description: 'Conclua o treino do dia com atenção.', icon: 'barbell-outline' },
  { key: 'postura', title: 'Postura', description: 'Faça pausas para ajustar a postura.', icon: 'accessibility-outline' },
];

export function getTodayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekStartDateString(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function getDailyChallenge(dateString = getTodayDateString()): DailyChallenge {
  let hash = 0;
  for (let i = 0; i < dateString.length; i += 1) hash = (hash * 31 + dateString.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % CHALLENGES.length;
  return CHALLENGES[idx];
}

export async function fetchCoachSettings(coachId: string) {
  const { data, error } = await supabase
    .from('coach_settings')
    .select('*')
    .eq('coach_id', coachId)
    .maybeSingle();
  return { settings: (data as CoachSettings | null) ?? null, error: error?.message ?? null };
}

export async function upsertCoachSettings(coachId: string, patch: Partial<Pick<CoachSettings, 'feedback_interval_days' | 'payment_reminder_days_before'>>) {
  const { data, error } = await supabase
    .from('coach_settings')
    .upsert({ coach_id: coachId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'coach_id' })
    .select('*')
    .maybeSingle();
  return { settings: (data as CoachSettings | null) ?? null, error: error?.message ?? null };
}

export async function fetchStudentGoals(studentId: string) {
  const { data, error } = await supabase
    .from('student_goals')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  return { goals: (data as StudentGoal[]) ?? [], error: error?.message ?? null };
}

export async function updateStudentGoal(id: string, patch: Partial<Pick<StudentGoal, 'status' | 'progress' | 'title'>>) {
  const next = { ...patch };
  if (typeof next.progress === 'number') {
    next.progress = Math.max(0, Math.min(100, Math.round(next.progress)));
    if (next.progress >= 100 && !next.status) next.status = 'done';
    if (next.progress < 100 && next.status === 'done' && patch.status == null) next.status = 'active';
  }
  if (next.status === 'done' && next.progress == null) next.progress = 100;
  const { error } = await supabase.from('student_goals').update(next).eq('id', id);
  return { error: error?.message ?? null };
}

export async function fetchTodayChallengeLog(studentId: string, challengeKey: string) {
  const day = getTodayDateString();
  const { data, error } = await supabase
    .from('daily_challenge_logs')
    .select('*')
    .eq('student_id', studentId)
    .eq('challenge_date', day)
    .eq('challenge_key', challengeKey)
    .maybeSingle();
  return { log: (data as DailyChallengeLog | null) ?? null, error: error?.message ?? null };
}

export async function setChallengeCompleted(studentId: string, challengeKey: string, completed: boolean) {
  const day = getTodayDateString();
  const { data, error } = await supabase
    .from('daily_challenge_logs')
    .upsert(
      { student_id: studentId, challenge_date: day, challenge_key: challengeKey, completed },
      { onConflict: 'student_id,challenge_date,challenge_key' },
    )
    .select('*')
    .maybeSingle();
  return { log: (data as DailyChallengeLog | null) ?? null, error: error?.message ?? null };
}

export async function fetchWeeklyCheckin(studentId: string, weekStart = getWeekStartDateString()) {
  const { data, error } = await supabase
    .from('weekly_checkins')
    .select('*')
    .eq('student_id', studentId)
    .eq('week_start', weekStart)
    .maybeSingle();
  return { checkin: (data as WeeklyCheckin | null) ?? null, error: error?.message ?? null };
}

export async function upsertWeeklyCheckin(
  studentId: string,
  values: Partial<Pick<WeeklyCheckin, 'performance' | 'motivation' | 'difficulty' | 'had_difficulties' | 'notes'>>,
  weekStart = getWeekStartDateString(),
) {
  const { data, error } = await supabase
    .from('weekly_checkins')
    .upsert({ student_id: studentId, week_start: weekStart, ...values }, { onConflict: 'student_id,week_start' })
    .select('*')
    .maybeSingle();
  return { checkin: (data as WeeklyCheckin | null) ?? null, error: error?.message ?? null };
}

export async function fetchRecentCheckins(studentId: string, limit = 4) {
  const { data, error } = await supabase
    .from('weekly_checkins')
    .select('*')
    .eq('student_id', studentId)
    .order('week_start', { ascending: false })
    .limit(limit);
  return { checkins: (data as WeeklyCheckin[]) ?? [], error: error?.message ?? null };
}

export async function fetchRecentChallengeLogs(studentId: string, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const y = since.getFullYear();
  const m = String(since.getMonth() + 1).padStart(2, '0');
  const d = String(since.getDate()).padStart(2, '0');
  const sinceStr = `${y}-${m}-${d}`;
  const { data, error } = await supabase
    .from('daily_challenge_logs')
    .select('*')
    .eq('student_id', studentId)
    .gte('challenge_date', sinceStr)
    .order('challenge_date', { ascending: false });
  return { logs: (data as DailyChallengeLog[]) ?? [], error: error?.message ?? null };
}
