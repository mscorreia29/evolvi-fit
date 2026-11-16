import { supabase } from '@/lib/supabase';
import type { WorkoutStatus } from '@/lib/types';

export async function updateWorkoutStatus(id: string, status: WorkoutStatus) {
  const { error } = await supabase.from('workouts').update({ status }).eq('id', id);
  return { error: error?.message ?? null };
}
