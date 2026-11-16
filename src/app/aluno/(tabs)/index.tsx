import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExerciseVideoModal } from '@/components/exercise-video-modal';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NotificationBell } from '@/components/ui/notification-bell';
import { PhotoHero } from '@/components/ui/photo-hero';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { WeeklyChart } from '@/components/ui/weekly-chart';
import { Images } from '@/constants/images';
import { Brand, Gradients, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchStudentGoals,
  fetchTodayChallengeLog,
  fetchWeeklyCheckin,
  getDailyChallenge,
  getWeekStartDateString,
  setChallengeCompleted,
  upsertWeeklyCheckin,
} from '@/lib/engagement';
import { checkNewWorkouts } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { StudentGoal, WeeklyCheckin, WorkoutWithDays } from '@/lib/types';
import { buildWeek, type WeeklyPoint } from '@/lib/week';
import { useAuth } from '@/providers/auth-provider';

export default function StudentWorkoutScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();

  const [workouts, setWorkouts] = useState<WorkoutWithDays[]>([]);
  const [week, setWeek] = useState<WeeklyPoint[]>([]);
  const [weekCount, setWeekCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [goals, setGoals] = useState<StudentGoal[]>([]);
  const [challengeDone, setChallengeDone] = useState(false);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [checkin, setCheckin] = useState<WeeklyCheckin | null>(null);
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [video, setVideo] = useState<{
    title: string;
    url: string;
    instructions?: string | null;
  } | null>(null);

  const dailyChallenge = getDailyChallenge();

  const load = useCallback(async () => {
    if (!profile) return;
    const [workoutsRes, historyRes, goalsRes, challengeRes, checkinRes] = await Promise.all([
      supabase
        .from('workouts')
        .select('*, workout_days(*, workout_exercises(*, exercise:exercises(video_url, instructions)))')
        .eq('student_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('workout_sessions')
        .select('performed_at')
        .eq('student_id', profile.id)
        .order('performed_at', { ascending: false })
        .limit(120),
      fetchStudentGoals(profile.id),
      fetchTodayChallengeLog(profile.id, getDailyChallenge().key),
      fetchWeeklyCheckin(profile.id),
    ]);

    if (workoutsRes.error) {
      console.warn(workoutsRes.error.message);
      setWorkouts([]);
    } else {
      const list = (workoutsRes.data as unknown as WorkoutWithDays[]) ?? [];
      setWorkouts(list);
      await checkNewWorkouts(list.map((item) => item.id));
    }

    const dates = ((historyRes.data as { performed_at: string }[]) ?? []).map((item) => item.performed_at);
    const weekFromDates = buildWeek(dates);
    setWeek(weekFromDates);
    setWeekCount(weekFromDates.reduce((sum, day) => sum + day.value, 0));

    const dayKeys = new Set(dates.map((value) => new Date(value).toDateString()));
    const cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    if (!dayKeys.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (dayKeys.has(cursor.toDateString())) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    setStreak(count);

    setGoals(goalsRes.goals);
    setChallengeDone(Boolean(challengeRes.log?.completed));
    setCheckin(checkinRes.checkin);
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

  async function toggleChallenge() {
    if (!profile || challengeBusy) return;
    setChallengeBusy(true);
    const next = !challengeDone;
    const { error } = await setChallengeCompleted(profile.id, dailyChallenge.key, next);
    setChallengeBusy(false);
    if (!error) setChallengeDone(next);
  }

  async function handleCheckin(value: number) {
    if (!profile || savingCheckin) return;
    setSavingCheckin(true);
    const { checkin: saved } = await upsertWeeklyCheckin(profile.id, { motivation: value }, getWeekStartDateString());
    setSavingCheckin(false);
    if (saved) setCheckin(saved);
  }

  const activeGoals = goals.filter((g) => g.status === 'active').slice(0, 3);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'aluno';
  const totalExercises = workouts.reduce(
    (sum, workout) =>
      sum +
      (workout.workout_days ?? []).reduce(
        (daySum, day) => daySum + (day.workout_exercises?.length ?? 0),
        0,
      ),
    0,
  );

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={[styles.brandText, { color: theme.text }]}>EVOLVI FIT</Text>
        </View>
        <NotificationBell />
      </View>

      <PhotoHero source={Images.workout} height={280} imagePosition="top" glowColor={Brand.accent}>
        <View style={styles.heroTop}>
          <View style={styles.heroTexts}>
            <View style={styles.kicker}>
              <Ionicons name="flame" size={12} color="#FFFFFF" />
              <Text style={styles.kickerText}>MODO ALUNO</Text>
            </View>
            <Text style={styles.heroGreeting}>Pronto para treinar?</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              Bora, {firstName}!
            </Text>
          </View>
          <View style={styles.heroActions}>
            <Avatar name={profile?.full_name} size={56} ring />
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroStatPill}>
            <Ionicons name="barbell" size={15} color="#FFFFFF" />
            <Text style={styles.heroStatText}>{workouts.length} treinos</Text>
          </View>
          <View style={styles.heroStatPill}>
            <Ionicons name="flame" size={15} color="#FFFFFF" />
            <Text style={styles.heroStatText}>{streak} dias seguidos</Text>
          </View>
        </View>
      </PhotoHero>

      <Card style={styles.featureCard}>
        <SectionHeader title="Sua semana" subtitle={`${weekCount} treino(s) nos últimos 7 dias`} />
        <WeeklyChart data={week} />
      </Card>

      <Card style={styles.featureCard}>
        <SectionHeader title="Desafio do dia" subtitle={dailyChallenge.title} />
        <View style={styles.challengeRow}>
          <View style={[styles.challengeIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name={dailyChallenge.icon as any} size={22} color={Brand.primary} />
          </View>
          <View style={styles.challengeTexts}>
            <Text style={[styles.challengeTitle, { color: theme.text }]}>{dailyChallenge.title}</Text>
            <Text style={[styles.challengeDesc, { color: theme.textSecondary }]}>
              {dailyChallenge.description}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={toggleChallenge}
          disabled={challengeBusy}
          style={[
            styles.challengeBtn,
            {
              backgroundColor: challengeDone ? theme.successSoft : theme.primarySoft,
              borderColor: challengeDone ? Brand.success : Brand.primary,
            },
          ]}>
          <Ionicons
            name={challengeDone ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={challengeDone ? Brand.success : Brand.primary}
          />
          <Text style={{ color: challengeDone ? Brand.success : Brand.primary, fontWeight: '800' }}>
            {challengeDone ? 'Concluído hoje' : 'Marcar como feito'}
          </Text>
        </Pressable>
      </Card>

      <Card style={styles.featureCard}>
        <SectionHeader title="Minhas metas" subtitle={`${activeGoals.length} ativa(s)`} />
        {activeGoals.length === 0 ? (
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            Seu personal ainda não definiu metas para você.
          </Text>
        ) : (
          activeGoals.map((goal) => (
            <View key={goal.id} style={styles.goalItem}>
              <View style={styles.goalHeader}>
                <Text style={[styles.goalTitle, { color: theme.text }]} numberOfLines={1}>
                  {goal.title}
                </Text>
                <Text style={[styles.goalPct, { color: Brand.primary }]}>{goal.progress ?? 0}%</Text>
              </View>
              <ProgressBar value={(goal.progress ?? 0) / 100} />
            </View>
          ))
        )}
      </Card>

      <Card style={styles.featureCard}>
        <SectionHeader title="Check-in semanal" subtitle="Como está sua motivação?" />
        <View style={styles.moodRow}>
          {[1, 2, 3, 4, 5].map((v) => {
            const selected = (checkin?.motivation ?? 0) === v;
            const labels = ['😞', '😕', '😐', '🙂', '😄'];
            return (
              <Pressable
                key={v}
                onPress={() => handleCheckin(v)}
                disabled={savingCheckin}
                style={[
                  styles.moodBtn,
                  {
                    borderColor: selected ? Brand.primary : theme.border,
                    backgroundColor: selected ? theme.primarySoft : theme.backgroundElement,
                  },
                ]}>
                <Text style={{ fontSize: 22 }}>{labels[v - 1]}</Text>
              </Pressable>
            );
          })}
        </View>
        {checkin?.motivation ? (
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
            Check-in registrado para esta semana.
          </Text>
        ) : null}
      </Card>

      <SectionHeader
        title="Seus treinos"
        subtitle={`${workouts.length} ativo(s) • ${totalExercises} exercícios`}
      />

      {workouts.length === 0 ? (
        <Card style={styles.emptyCard}>
          <LinearGradient
            colors={Gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyIcon}>
            <Ionicons name="barbell" size={24} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum treino por aqui</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Seu personal ainda não montou um treino para você. Fale com ele para começar.
          </Text>
          <Button
            title="Ver meu perfil"
            onPress={() => router.push('/aluno/perfil')}
            variant="secondary"
          />
        </Card>
      ) : (
        workouts.map((workout, workoutIndex) => {
          const days = [...(workout.workout_days ?? [])].sort((a, b) => a.order_index - b.order_index);
          const exerciseTotal = days.reduce(
            (sum, day) => sum + (day.workout_exercises?.length ?? 0),
            0,
          );

          return (
            <Card key={workout.id} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <View style={styles.workoutTitleBox}>
                  <Text style={[styles.workoutName, { color: theme.text }]}>{workout.name}</Text>
                  <Text style={[styles.workoutMeta, { color: theme.textSecondary }]}>
                    {days.length} divisões • {exerciseTotal} exercícios
                  </Text>
                </View>
                <Badge label={`#${workoutIndex + 1}`} tone="primary" />
              </View>

              {days.map((day, dayIndex) => {
                const exercises = [...(day.workout_exercises ?? [])].sort(
                  (a, b) => a.order_index - b.order_index,
                );
                return (
                  <View
                    key={day.id}
                    style={[
                      styles.dayBox,
                      { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                    ]}>
                    <View style={styles.dayHeader}>
                      <LinearGradient
                        colors={dayIndex % 2 === 0 ? Gradients.primary : Gradients.accent}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.dayBadge}>
                        <Text style={styles.dayBadgeText}>{day.label}</Text>
                      </LinearGradient>
                      <Text style={[styles.dayCount, { color: theme.textSecondary }]}>
                        {exercises.length} exercício(s)
                      </Text>
                    </View>

                    {exercises.map((exercise) => {
                      const videoUrl = exercise.video_url ?? exercise.exercise?.video_url ?? null;
                      const details = [
                        exercise.sets ? `${exercise.sets} séries` : null,
                        exercise.reps ? `${exercise.reps} reps` : null,
                        exercise.rest_seconds ? `${exercise.rest_seconds}s desc.` : null,
                      ]
                        .filter(Boolean)
                        .join(' • ');

                      return (
                        <View key={exercise.id} style={styles.exerciseRow}>
                          <View
                            style={[
                              styles.exerciseDot,
                              { backgroundColor: theme.backgroundElement },
                            ]}>
                            <Ionicons name="barbell-outline" size={13} color={Brand.primary} />
                          </View>
                          <View style={styles.exerciseInfo}>
                            <Text style={[styles.exerciseName, { color: theme.text }]}>
                              {exercise.name}
                            </Text>
                            {details ? (
                              <Text style={[styles.exerciseDetails, { color: theme.textSecondary }]}>
                                {details}
                              </Text>
                            ) : null}
                          </View>
                          {videoUrl ? (
                            <Pressable
                              hitSlop={8}
                              onPress={() =>
                                setVideo({
                                  title: exercise.name,
                                  url: videoUrl,
                                  instructions: exercise.exercise?.instructions ?? null,
                                })
                              }>
                              <Ionicons name="play-circle" size={24} color={Brand.primary} />
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              <Button title="Iniciar treino" onPress={() => startWorkout(workout)} />
            </Card>
          );
        })
      )}

      <ExerciseVideoModal
        visible={video !== null}
        onClose={() => setVideo(null)}
        title={video?.title ?? ''}
        videoUrl={video?.url}
        instructions={video?.instructions}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroTexts: {
    flex: 1,
    gap: 2,
  },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Brand.accent,
  },
  brandText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  kickerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroGreeting: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  heroStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroStatText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  featureCard: {
    gap: Spacing.three,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  challengeIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeTexts: {
    flex: 1,
    gap: 2,
  },
  challengeTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  challengeDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  challengeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  goalItem: {
    gap: 6,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  goalTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  goalPct: {
    fontSize: 13,
    fontWeight: '800',
  },
  moodRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  workoutCard: {
    gap: Spacing.three,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  workoutTitleBox: {
    flex: 1,
    gap: 2,
  },
  workoutName: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  workoutMeta: {
    fontSize: 12,
  },
  dayBox: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayBadge: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  dayCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  exerciseDot: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseInfo: {
    flex: 1,
    gap: 1,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseDetails: {
    fontSize: 12,
  },
});
