import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import type { WorkoutStatus } from '@/lib/types';

const ACTIVE_WORKOUT_KEY = 'evolvifit.activeWorkoutSession';

export type WorkoutDraftLog = {
  sets: string;
  reps: string;
  weight: string;
};

export type WorkoutDraft = {
  workoutId: string;
  studentId: string;
  startedAt: number;
  done: Record<string, boolean>;
  logs: Record<string, WorkoutDraftLog>;
  restEndsAt: number | null;
  activeIndex: number;
  bodyWeight: number | null;
};

export async function updateWorkoutStatus(id: string, status: WorkoutStatus) {
  const { error } = await supabase.from('workouts').update({ status }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function saveActiveWorkoutSession(draft: WorkoutDraft) {
  await AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(draft));
}

export async function loadActiveWorkoutSession(): Promise<WorkoutDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_WORKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkoutDraft;
    if (!parsed?.workoutId || !parsed?.studentId || typeof parsed.startedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearActiveWorkoutSession() {
  await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY);
}
