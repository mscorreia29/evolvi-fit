import { supabase } from '@/lib/supabase';
import type { Meal, MealPlan } from '@/lib/types';

export function createLocalId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function mealPlanCalories(plan: Pick<MealPlan, 'meals' | 'ai_generated'> | null | undefined) {
  if (!plan || plan.meals.length === 0) return 0;

  if (plan.ai_generated) {
    const perMeal = plan.meals.map((meal) =>
      meal.items.length > 0
        ? meal.items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0) /
          meal.items.length
        : 0,
    );
    return Math.round(perMeal.reduce((sum, value) => sum + value, 0) / perMeal.length);
  }

  return plan.meals.reduce(
    (total, meal) =>
      total + meal.items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0),
    0,
  );
}

export function normalizeMeals(meals: Meal[]): Meal[] {
  return meals
    .map((meal) => ({
      ...meal,
      name: meal.name.trim(),
      time: meal.time.trim(),
      notes: meal.notes.trim(),
      items: meal.items
        .map((item) => ({
          ...item,
          name: item.name.trim(),
          quantity: item.quantity.trim(),
          calories:
            item.calories != null && Number.isFinite(Number(item.calories))
              ? Number(item.calories)
              : null,
        }))
        .filter((item) => item.name),
    }))
    .filter((meal) => meal.name);
}

export async function getMealPlan(studentId: string, coachId?: string | null) {
  let query = supabase.from('meal_plans').select('*').eq('student_id', studentId);

  if (coachId) {
    query = query.eq('coach_id', coachId);
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { error: error.message, plan: null as MealPlan | null };
  return { error: null, plan: (data as MealPlan | null) ?? null };
}

export async function saveMealPlan(input: {
  coachId: string;
  studentId: string;
  title: string;
  notes: string;
  meals: Meal[];
}) {
  const { data, error } = await supabase
    .from('meal_plans')
    .upsert(
      {
        coach_id: input.coachId,
        student_id: input.studentId,
        title: input.title.trim() || 'Plano alimentar',
        notes: input.notes.trim() || null,
        ai_generated: false,
        meals: normalizeMeals(input.meals),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'coach_id,student_id' },
    )
    .select('*')
    .single();

  if (error) return { error: error.message, plan: null as MealPlan | null };
  return { error: null, plan: data as MealPlan };
}

export async function deleteMealPlan(id: string) {
  const { error } = await supabase.from('meal_plans').delete().eq('id', id);
  return { error: error?.message ?? null };
}
