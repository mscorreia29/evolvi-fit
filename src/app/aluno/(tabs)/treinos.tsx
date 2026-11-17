import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Hero } from '@/components/ui/hero';
import { Loading } from '@/components/ui/loading';
import { NotificationBell } from '@/components/ui/notification-bell';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Brand, Gradients, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { estimateWorkoutMinutes } from '@/lib/exercises';
import { checkNewWorkouts } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { fetchWeekActivity } from '@/lib/tracking';
import type { WorkoutWithDays } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type WeekStats = {
  sessions: number;
  totalSeconds: number;
  series: number;
  calories: number;
};

type WeekDay = {
  key: string;
  weekday: string;
  day: number;
  isToday: boolean;
};

const WEEK_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function asText(value: unknown) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function getWeekDays(): WeekDay[] {
  const today = new Date();
  const offset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - offset);

  return WEEK_LABELS.map((weekday, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      key: dateKey(date),
      weekday,
      day: date.getDate(),
      isToday: dateKey(date) === dateKey(today),
    };
  });
}

function workoutExerciseCount(workout: WorkoutWithDays) {
  return (workout.workout_days ?? []).reduce(
    (total, day) => total + (day.workout_exercises?.length ?? 0),
    0,
  );
}

function workoutLetter(workout: WorkoutWithDays) {
  const name = asText(workout.name);
  const match = name.match(/\b([A-Z])\b/i) ?? name.match(/([A-Z])\s*$/i);
  if (match) return match[1].toUpperCase();

  const label = asText(workout.workout_days?.[0]?.label).replace(/[^A-Za-z0-9]/g, '');
  return label.charAt(0).toUpperCase() || 'T';
}

function workoutMuscles(workout: WorkoutWithDays) {
  const groups = (workout.workout_days ?? [])
    .flatMap((day) => day.workout_exercises ?? [])
    .map((exercise) => asText(exercise.exercise?.muscle_group).trim())
    .filter(Boolean);

  const unique = [...new Set(groups)];
  return unique.length > 0 ? unique.slice(0, 3).join(', ') : 'Treino completo';
}

function ProgressCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  tone: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.progressCard,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <Ionicons name={icon} size={18} color={tone} />
      <Text style={[styles.progressValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.progressLabel, { color: theme.textSecondary }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export default function StudentTrainingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();

  const [workouts, setWorkouts] = useState<WorkoutWithDays[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekStats, setWeekStats] = useState<WeekStats>({
    sessions: 0,
    totalSeconds: 0,
    series: 0,
    calories: 0,
  });
  const weekDays = useMemo(() => getWeekDays(), []);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate(),
    ).padStart(2, '0')}`;
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [friendOpen, setFriendOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const { data, error: loadError } = await supabase
        .from('workouts')
        .select('*, workout_days(*, workout_exercises(*, exercise:exercises(video_url, instructions, muscle_group)))')
        .eq('student_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (loadError) {
        setError(loadError.message);
        setWorkouts([]);
        return;
      }

      const list = ((data as unknown as WorkoutWithDays[]) ?? []).map((workout) => ({
        ...workout,
        workout_days: (workout.workout_days ?? []).map((day) => ({
          ...day,
          workout_exercises: day.workout_exercises ?? [],
        })),
      }));
      setWorkouts(list);
      checkNewWorkouts(list.map((item) => item.id)).catch(() => undefined);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar seus treinos.',
      );
      setWorkouts([]);
    } finally {
      setLoading(false);
    }

    try {
      const [assessment, activity] = await Promise.all([
        supabase
          .from('physical_assessments')
          .select('weight_kg')
          .eq('student_id', profile.id)
          .not('weight_kg', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        fetchWeekActivity(profile.id),
      ]);

      const weight =
        typeof assessment.data?.weight_kg === 'number' ? assessment.data.weight_kg : 70;
      const totalSeconds = activity.sessions.reduce(
        (sum, session) => sum + (session.duration_seconds ?? 0),
        0,
      );
      const sessionCalories = activity.sessions.map((session) =>
        Math.max(1, Math.round(6 * weight * ((session.duration_seconds ?? 0) / 3600))),
      );
      const averageCalories = sessionCalories.length
        ? Math.round(sessionCalories.reduce((sum, value) => sum + value, 0) / sessionCalories.length)
        : 0;

      setWeekStats({
        sessions: activity.sessions.length,
        totalSeconds,
        series: activity.series,
        calories: averageCalories,
      });
    } catch {
      setWeekStats({ sessions: 0, totalSeconds: 0, series: 0, calories: 0 });
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function startWorkout(workout: WorkoutWithDays) {
    router.push(`/aluno/treino/${workout.id}` as never);
  }

  if (loading) {
    return <Loading label="Carregando treinos..." />;
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'aluno';
  const orderedWorkouts = [...workouts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const featuredWorkout = orderedWorkouts[0] ?? null;
  const nextWorkouts = orderedWorkouts.slice(1);
  const featuredCount = featuredWorkout ? workoutExerciseCount(featuredWorkout) : 0;
  const featuredMinutes = featuredWorkout ? estimateWorkoutMinutes(featuredWorkout) : 0;
  const completedGoal = workouts.length;
  const totalMinutes = Math.round(weekStats.totalSeconds / 60);

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <View style={styles.header}>
        <View style={styles.greeting}>
          <Text style={[styles.hello, { color: theme.text }]}>Olá, {firstName}!</Text>
          <Text style={[styles.motivation, { color: theme.textSecondary }]}>
            Um treino por dia faz toda a diferença.
          </Text>
        </View>
        <View style={styles.headerActions}>
          <NotificationBell />
          <Pressable
            onPress={() => setCalendarOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Escolher período"
            style={[
              styles.periodButton,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <Ionicons name="calendar-outline" size={15} color={Brand.primary} />
            <Text style={[styles.periodText, { color: theme.text }]}>Mês</Text>
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.weekStrip,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        {weekDays.map((day) => {
          const selected = day.key === selectedDate;
          return (
            <Pressable
              key={day.key}
              onPress={() => setSelectedDate(day.key)}
              accessibilityRole="button"
              accessibilityLabel={`${day.weekday}, dia ${day.day}`}
              style={styles.weekDay}>
              <Text
                style={[
                  styles.weekDayLabel,
                  { color: selected ? Brand.primary : theme.textSecondary },
                ]}>
                {day.weekday}
              </Text>
              <Text
                style={[
                  styles.weekDayNumber,
                  { color: selected ? Brand.primary : theme.text },
                ]}>
                {day.day}
              </Text>
              <View
                style={[
                  styles.weekDot,
                  { backgroundColor: selected ? Brand.primary : 'transparent' },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="alert-circle-outline" size={26} color={Brand.warning} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Não foi possível carregar</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{error}</Text>
          <Button title="Tentar novamente" onPress={handleRefresh} loading={refreshing} />
        </Card>
      ) : !featuredWorkout ? (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="barbell-outline" size={26} color={Brand.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum treino por aqui</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Quando seu personal montar uma rotina, ela aparece aqui.
          </Text>
        </Card>
      ) : (
        <>
          <Hero
            colors={Gradients.primary}
            style={styles.featureHero}
            contentStyle={styles.featureContent}>
            <Ionicons
              name="barbell-outline"
              size={110}
              color="rgba(255, 255, 255, 0.08)"
              style={styles.watermark}
            />
            <Text style={styles.featureKicker}>TREINO DE HOJE</Text>
            <Text style={styles.featureTitle} numberOfLines={1}>
              {asText(featuredWorkout.name) || 'Treino'}
            </Text>
            <Text style={styles.featureMuscles} numberOfLines={1}>
              {asText(featuredWorkout.name) || 'Treino'} - {workoutMuscles(featuredWorkout)}
            </Text>
            <Text style={styles.featureMeta}>
              {featuredCount} exercícios • {featuredMinutes} min
            </Text>
            <Pressable
              onPress={() => startWorkout(featuredWorkout)}
              accessibilityRole="button"
              accessibilityLabel="Iniciar treino"
              style={styles.startPill}>
              <Text style={[styles.startPillText, { color: Brand.primaryDark }]}>
                Iniciar treino
              </Text>
              <Ionicons name="arrow-forward" size={18} color={Brand.primaryDark} />
            </Pressable>
          </Hero>

          <Pressable
            onPress={() => setFriendOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Treinar com um amigo"
            style={[
              styles.friendButton,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <Ionicons name="person-add-outline" size={18} color={Brand.primary} />
            <Text style={[styles.friendText, { color: theme.text }]}>Treinar com um amigo</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>

          <View style={styles.progressBlock}>
            <SectionHeader
              title="Seu progresso esta semana"
              actionLabel="Ver tudo"
              onAction={() => router.push('/aluno/historico' as never)}
            />
            <View style={styles.progressGrid}>
              <ProgressCard
                icon="checkmark-circle-outline"
                value={`${weekStats.sessions}/${completedGoal}`}
                label="Concluídos"
                tone={Brand.success}
              />
              <ProgressCard
                icon="time-outline"
                value={`${totalMinutes} min`}
                label="Tempo total"
                tone={Brand.accent}
              />
              <ProgressCard
                icon="flame-outline"
                value={`${weekStats.calories.toLocaleString('pt-BR')} kcal`}
                label="Média calórica"
                tone={Brand.warning}
              />
              <ProgressCard
                icon="barbell-outline"
                value={String(weekStats.series)}
                label="Séries"
                tone={Brand.primary}
              />
            </View>
          </View>

          <View style={styles.nextBlock}>
            <SectionHeader
              title="Próximos treinos"
              actionLabel="Ver todos"
              onAction={() => router.push('/aluno/historico' as never)}
            />
            {nextWorkouts.length === 0 ? (
              <Text style={[styles.nextEmpty, { color: theme.textSecondary }]}>
                Você já tem acesso a todos os treinos liberados.
              </Text>
            ) : (
              nextWorkouts.map((workout, index) => (
                <Pressable
                  key={workout.id}
                  onPress={() => startWorkout(workout)}
                  accessibilityRole="button"
                  accessibilityLabel={`Iniciar ${asText(workout.name)}`}
                  style={[
                    styles.nextCard,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}>
                  <View style={[styles.nextLetter, { backgroundColor: theme.primarySoft }]}>
                    <Text style={[styles.nextLetterText, { color: Brand.primary }]}>
                      {workoutLetter(workout)}
                    </Text>
                  </View>
                  <View style={styles.nextInfo}>
                    <Text style={[styles.nextStatus, { color: Brand.primary }]}>
                      {index === 0 ? 'NA SEQUÊNCIA' : 'DEPOIS'}
                    </Text>
                    <Text style={[styles.nextName, { color: theme.text }]} numberOfLines={1}>
                      {asText(workout.name) || 'Treino'}
                    </Text>
                    <Text
                      style={[styles.nextMuscles, { color: theme.textSecondary }]}
                      numberOfLines={1}>
                      {workoutMuscles(workout)}
                    </Text>
                    <View style={styles.nextMeta}>
                      <Ionicons name="barbell-outline" size={12} color={theme.textSecondary} />
                      <Text style={[styles.nextMetaText, { color: theme.textSecondary }]}>
                        {workoutExerciseCount(workout)} exercícios
                      </Text>
                      <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
                      <Text style={[styles.nextMetaText, { color: theme.textSecondary }]}>
                        {estimateWorkoutMinutes(workout)} min
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </Pressable>
              ))
            )}
          </View>
        </>
      )}

      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCalendarOpen(false)}>
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
            onPress={() => undefined}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Período</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>
              Você está acompanhando os treinos de {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.
            </Text>
            <Button title="Fechar" variant="secondary" onPress={() => setCalendarOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={friendOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFriendOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFriendOpen(false)}>
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
            onPress={() => undefined}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Treinar com um amigo</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>
              Compartilhe sua rotina e motive quem você gosta a treinar junto.
            </Text>
            <Button title="Entendi" onPress={() => setFriendOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();

  return (
    <Screen scroll={false}>
      <View style={styles.fallback}>
        <Ionicons name="alert-circle-outline" size={38} color={Brand.warning} />
        <Text style={[styles.fallbackTitle, { color: theme.text }]}>
          Não foi possível abrir os treinos
        </Text>
        <Text style={[styles.fallbackText, { color: theme.textSecondary }]}>
          {error?.message || 'Ocorreu um erro inesperado.'}
        </Text>
        <Button title="Tentar novamente" onPress={() => void retry()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  greeting: {
    flex: 1,
    gap: 2,
  },
  hello: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  motivation: {
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
  },
  periodText: {
    fontSize: 12,
    fontWeight: '800',
  },
  weekStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.three,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  weekDot: {
    width: 5,
    height: 5,
    borderRadius: Radius.full,
  },
  featureHero: {
    borderRadius: 24,
    borderWidth: 0,
    overflow: 'hidden',
  },
  featureContent: {
    gap: 6,
    minHeight: 196,
  },
  watermark: {
    position: 'absolute',
    right: -18,
    bottom: -30,
  },
  featureKicker: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  featureMuscles: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '700',
  },
  featureMeta: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 12,
    fontWeight: '600',
  },
  startPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.full,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 6,
  },
  startPillText: {
    fontSize: 14,
    fontWeight: '800',
  },
  friendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    marginTop: Spacing.two,
  },
  friendText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  progressBlock: {
    marginTop: Spacing.three,
  },
  progressGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  progressCard: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.two,
  },
  progressValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  nextBlock: {
    marginTop: Spacing.three,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  nextLetter: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLetterText: {
    fontSize: 22,
    fontWeight: '800',
  },
  nextInfo: {
    flex: 1,
    gap: 2,
  },
  nextStatus: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  nextName: {
    fontSize: 15,
    fontWeight: '800',
  },
  nextMuscles: {
    fontSize: 12,
    fontWeight: '700',
  },
  nextMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  nextMetaText: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 6,
  },
  nextEmpty: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: Spacing.two,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalText: {
    fontSize: 13,
    lineHeight: 19,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  fallbackTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
