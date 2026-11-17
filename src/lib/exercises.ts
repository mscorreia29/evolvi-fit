import type { Exercise, WorkoutWithDays } from '@/lib/types';

export type ExerciseCategory = 'strength' | 'cardio' | 'running' | 'mobility';

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  strength: 'Musculação',
  cardio: 'Cardio',
  running: 'Corrida',
  mobility: 'Mobilidade',
};

export const EXERCISE_CATEGORY_FILTERS: { value: ExerciseCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'strength', label: 'Musculação' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'running', label: 'Corrida' },
  { value: 'mobility', label: 'Mobilidade' },
];

const CARDIO_TERMS = [
  'cardio',
  'esteira',
  'bicicleta',
  'bike',
  'elíptico',
  'eliptico',
  'remo',
  'escada',
  'corda',
  'caminhada',
];

export function getExerciseCategory(
  exercise: Pick<Exercise, 'muscle_group'> | null | undefined,
): ExerciseCategory {
  const group = (exercise?.muscle_group ?? '').toLowerCase();

  if (group.includes('corrida') || group.includes('running')) return 'running';
  if (CARDIO_TERMS.some((term) => group.includes(term))) return 'cardio';
  if (group.includes('mobilidade') || group.includes('alongamento')) return 'mobility';
  return 'strength';
}

export function isCardioCategory(category: ExerciseCategory | null | undefined) {
  return category === 'cardio' || category === 'running';
}

export function getDefaultPrescription(category: ExerciseCategory | null | undefined) {
  if (category === 'cardio') return { sets: '1', reps: '20 min', rest: '0' };
  if (category === 'running') return { sets: '1', reps: '30 min', rest: '0' };
  if (category === 'mobility') return { sets: '2', reps: '30 s', rest: '30' };
  return { sets: '3', reps: '12', rest: '60' };
}

export function estimateWorkoutMinutes(
  workout: Pick<WorkoutWithDays, 'workout_days'> | null | undefined,
) {
  const exercises = (workout?.workout_days ?? []).flatMap((day) => day.workout_exercises ?? []);
  if (exercises.length === 0) return 0;

  let seconds = 0;

  for (const exercise of exercises) {
    const category = getExerciseCategory(exercise.exercise);
    const reps = (exercise.reps ?? '').toLowerCase();

    if (isCardioCategory(category)) {
      const distance = reps.match(/(\d+(?:[.,]\d+)?)\s*km/);
      if (distance) {
        seconds += Number(distance[1].replace(',', '.')) * 6 * 60;
      } else {
        const minutes = reps.match(/(\d+)\s*min/);
        seconds += (minutes ? Number(minutes[1]) : 20) * 60;
      }
      continue;
    }

    const sets = Math.max(1, exercise.sets ?? 3);
    const rest = exercise.rest_seconds ?? 60;
    seconds += sets * 35 + Math.max(0, sets - 1) * rest;
  }

  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}
