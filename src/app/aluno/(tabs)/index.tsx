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
import { TextField } from '@/components/ui/text-field';
import { WeeklyChart } from '@/components/ui/weekly-chart';
import { Images } from '@/constants/images';
import { Brand, Gradients, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchStudentGoals,
  fetchWeeklyCheckin,
  getDailyChallenge,
  getWeekStartDateString,
  upsertWeeklyCheckin,
} from '@/lib/engagement';
import {
  addWater,
  addXp,
  fetchTodayMeals,
  fetchTodayWater,
  fetchWeekActivity,
  logMeal,
} from '@/lib/tracking';
import { checkNewWorkouts } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { MealLog, StudentGoal, WaterLog, WeeklyCheckin, WorkoutWithDays } from '@/lib/types';
import { buildWeek, type WeeklyPoint } from '@/lib/week';
import { useAuth } from '@/providers/auth-provider';

type Mission = { id: string; title: string; desc: string; xp: number; done: boolean };

export default function StudentWorkoutScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();

  const [workouts, setWorkouts] = useState<WorkoutWithDays[]>([]);
  const [week, setWeek] = useState<WeeklyPoint[]>([]);
  const [weekCount, setWeekCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [video, setVideo] = useState<{ title: string; url: string; instructions?: string | null } | null>(null);

  const [goals, setGoals] = useState<StudentGoal[]>([]);
  const [checkin, setCheckin] = useState<WeeklyCheckin | null>(null);
  const [savingCheckin, setSavingCheckin] = useState(false);

  const [water, setWater] = useState<WaterLog | null>(null);
  const [waterBusy, setWaterBusy] = useState(false);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [mealName, setMealName] = useState('');
  const [mealBusy, setMealBusy] = useState(false);

  const [weekActivity, setWeekActivity] = useState<{ sessions: { performed_at: string }[]; water: { log_date: string; amount_ml: number; goal_ml: number }[]; meals: { log_date: string }[] } | null>(null);

  const dailyChallenge = getDailyChallenge();

  const load = useCallback(async () => {
    if (!profile) return;
    const [workoutsRes, historyRes, goalsRes, checkinRes, waterRes, mealsRes, activityRes] = await Promise.all([
      supabase
        .from('workouts')
        .select('*, workout_days(*, workout_exercises(*, exercise:exercises(video_url, instructions)))')
        .eq('student_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase.from('workout_sessions').select('performed_at').eq('student_id', profile.id).order('performed_at', { ascending: false }).limit(120),
      fetchStudentGoals(profile.id),
      fetchWeeklyCheckin(profile.id),
      fetchTodayWater(profile.id),
      fetchTodayMeals(profile.id),
      fetchWeekActivity(profile.id),
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

    setGoals(goalsRes.goals);
    setCheckin(checkinRes.checkin);
    setWater(waterRes.log);
    setMeals(mealsRes.meals);
    setWeekActivity(activityRes);
  }, [profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function startWorkout(workout: WorkoutWithDays) {
    router.push(`/aluno/treino/${workout.id}` as never);
  }

  async function handleCheckin(value: number) {
    if (!profile || savingCheckin) return;
    setSavingCheckin(true);
    const { checkin: saved } = await upsertWeeklyCheckin(profile.id, { motivation: value }, getWeekStartDateString());
    setSavingCheckin(false);
    if (saved) setCheckin(saved);
  }

  async function handleAddWater(amount: number) {
    if (!profile || waterBusy) return;
    setWaterBusy(true);
    const { log } = await addWater(profile.id, amount, water?.goal_ml ?? 2500);
    setWaterBusy(false);
    if (log) {
      setWater(log);
      const goal = log.goal_ml ?? 2500;
      if (log.amount_ml >= goal && (water?.amount_ml ?? 0) < goal) {
        await addXp(profile.id, 5);
      }
    }
  }

  async function handleLogMeal() {
    if (!profile || !mealName.trim() || mealBusy) return;
    setMealBusy(true);
    const { meal, error } = await logMeal(profile.id, mealName.trim());
    setMealBusy(false);
    if (!error && meal) {
      setMeals((prev) => [...prev, meal]);
      setMealName('');
      await addXp(profile.id, 5);
    }
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'aluno';
  const activeGoals = goals.filter((g) => g.status === 'active').slice(0, 1)[0] ?? null;
  const waterAmount = water?.amount_ml ?? 0;
  const waterGoal = water?.goal_ml ?? 2500;
  const waterPct = Math.min(1, waterAmount / waterGoal);
  const mealsPct = Math.min(1, meals.length / 3);
  const todayWorkoutDone = weekCount > 0 && week[week.length - 1]?.value > 0;
  const workoutPct = todayWorkoutDone ? 1 : 0;

  const missions: Mission[] = [
    { id: 'workout', title: 'Fazer o treino de hoje', desc: 'Vale mais XP', xp: 20, done: todayWorkoutDone },
    { id: 'water', title: 'Bater a meta de água', desc: `${Math.round(waterPct * 100)}% da meta`, xp: 5, done: waterPct >= 1 },
    { id: 'meal', title: 'Registrar as refeições', desc: 'por refeição', xp: 5, done: meals.length > 0 },
  ];
  const missionsDone = missions.filter((m) => m.done).length;
  const xpTotal = (profile as any)?.xp ?? 0;

  // weekly summary
  const weekWaterAvg = weekActivity
    ? Math.round((weekActivity.water.reduce((s, w) => s + w.amount_ml, 0) / Math.max(1, weekActivity.water.length)) / 100) / 10
    : 0;
  const weekMealsCount = weekActivity?.meals.length ?? 0;
  const weekWorkoutsCount = weekActivity?.sessions.length ?? 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={[styles.brandText, { color: theme.text }]}>EVOLVI FIT</Text>
        </View>
        <NotificationBell />
      </View>

      <PhotoHero source={Images.workout} height={260} imagePosition="top" glowColor={Brand.accent}>
        <View style={styles.heroTop}>
          <View style={styles.heroTexts}>
            <View style={styles.kicker}>
              <Ionicons name="flame" size={12} color="#FFFFFF" />
              <Text style={styles.kickerText}>{greeting.toUpperCase()}</Text>
            </View>
            <Text style={styles.heroGreeting}>Olá, {firstName}!</Text>
            <Text style={styles.heroXp}>{xpTotal} XP</Text>
            <Text style={styles.heroHint}>
              {xpTotal === 0 ? 'Bora começar? Seu primeiro registro te espera.' : 'Continue assim!'}
            </Text>
          </View>
          <View style={styles.heroActions}>
            <Avatar name={profile?.full_name} size={56} ring />
          </View>
        </View>
      </PhotoHero>

      {activeGoals ? (
        <Card style={styles.featureCard}>
          <SectionHeader title="Progresso da meta" subtitle={activeGoals.title} />
          <View style={styles.goalRow}>
            <Text style={[styles.goalPct, { color: Brand.primary }]}>{activeGoals.progress ?? 0}%</Text>
            <ProgressBar value={(activeGoals.progress ?? 0) / 100} />
          </View>
          <View style={styles.goalStats}>
            <View style={styles.goalStat}>
              <Text style={[styles.goalStatValue, { color: theme.text }]}>
                {activeGoals.current_value != null ? `${activeGoals.current_value}${activeGoals.unit ?? 'kg'}` : '—'}
              </Text>
              <Text style={[styles.goalStatLabel, { color: theme.textSecondary }]}>ATUAL</Text>
            </View>
            <View style={styles.goalStat}>
              <Text style={[styles.goalStatValue, { color: theme.textSecondary }]}>
                {activeGoals.target_value != null ? `${activeGoals.target_value}${activeGoals.unit ?? 'kg'}` : '—'}
              </Text>
              <Text style={[styles.goalStatLabel, { color: theme.textSecondary }]}>META</Text>
            </View>
            {activeGoals.target_value != null && activeGoals.current_value != null ? (
              <View style={styles.goalStat}>
                <Text style={[styles.goalStatValue, { color: Brand.primary }]}>
                  {Math.max(0, activeGoals.target_value - activeGoals.current_value).toFixed(1)}{activeGoals.unit ?? 'kg'}
                </Text>
                <Text style={[styles.goalStatLabel, { color: theme.textSecondary }]}>RESTANTES</Text>
              </View>
            ) : null}
          </View>
          {activeGoals.target_value != null && activeGoals.current_value != null && (activeGoals.target_value - activeGoals.current_value) > 0 ? (
            <Text style={[styles.goalHint, { color: theme.textSecondary }]}>
              {Math.max(0, Math.round((activeGoals.target_value - activeGoals.current_value) / 0.5))} dias estimados no ritmo atual
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.featureCard}>
        <SectionHeader title="Sua atividade de hoje" />
        <View style={styles.activityRow}>
          <View style={styles.activityItem}>
            <Text style={[styles.activityPct, { color: workoutPct >= 1 ? Brand.success : theme.text }]}>{Math.round(workoutPct * 100)}%</Text>
            <Text style={[styles.activityLabel, { color: theme.textSecondary }]}>Treino</Text>
          </View>
          <View style={styles.activityItem}>
            <Text style={[styles.activityPct, { color: waterPct >= 1 ? Brand.success : theme.text }]}>{Math.round(waterPct * 100)}%</Text>
            <Text style={[styles.activityLabel, { color: theme.textSecondary }]}>Água</Text>
          </View>
          <View style={styles.activityItem}>
            <Text style={[styles.activityPct, { color: mealsPct >= 1 ? Brand.success : theme.text }]}>{Math.round(mealsPct * 100)}%</Text>
            <Text style={[styles.activityLabel, { color: theme.textSecondary }]}>Refeições</Text>
          </View>
        </View>
        <WeeklyChart data={week} />
      </Card>

      <Card style={styles.featureCard}>
        <View style={styles.challengeHeader}>
          <View>
            <Text style={[styles.challengeTitle, { color: theme.text }]}>Desafio do dia</Text>
            <Text style={[styles.challengeSub, { color: theme.textSecondary }]}>{dailyChallenge.title}</Text>
          </View>
          <Badge label={`+${missions.reduce((s, m) => s + (m.done ? 0 : m.xp), 0)} / 30 XP`} tone="warning" />
        </View>
        <Text style={[styles.challengeDesc, { color: theme.textSecondary }]}>
          {dailyChallenge.description}
        </Text>
        <Text style={[styles.missionProgress, { color: theme.textSecondary }]}>
          {missionsDone}/3 MISSÕES
        </Text>
        {missionsDone === 0 ? (
          <Text style={[styles.missionHint, { color: theme.textSecondary }]}>
            Comece pelo mais rápido: a água vale XP em um toque.
          </Text>
        ) : null}
        {missions.map((m) => (
          <Pressable key={m.id} style={styles.missionRow}>
            <View style={[styles.missionCheck, { backgroundColor: m.done ? theme.successSoft : theme.backgroundSelected }]}>
              <Ionicons name={m.done ? 'checkmark' : 'ellipse-outline'} size={16} color={m.done ? Brand.success : theme.textSecondary} />
            </View>
            <View style={styles.missionInfo}>
              <Text style={[styles.missionTitle, { color: theme.text }]}>{m.title}</Text>
              <Text style={[styles.missionDesc, { color: theme.textSecondary }]}>{m.desc}</Text>
            </View>
            <Text style={[styles.missionXp, { color: Brand.warning }]}>+{m.xp} XP</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </Pressable>
        ))}
      </Card>

      <SectionHeader title="O que seu personal indicou pra hoje" />

      {workouts.length === 0 ? (
        <Card style={styles.emptyCard}>
          <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyIcon}>
            <Ionicons name="barbell" size={24} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum treino por aqui</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Seu personal ainda não montou um treino para você.
          </Text>
        </Card>
      ) : (
        workouts.slice(0, 1).map((workout) => {
          const days = [...(workout.workout_days ?? [])].sort((a, b) => a.order_index - b.order_index);
          const exerciseTotal = days.reduce((sum, day) => sum + (day.workout_exercises?.length ?? 0), 0);
          const muscleGroups = Array.from(new Set(days.flatMap((d) => d.workout_exercises?.map((e) => e.name.split(' ')[0]) ?? []))).slice(0, 4);
          return (
            <Card key={workout.id} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <View style={styles.workoutTitleBox}>
                  <Text style={[styles.workoutName, { color: theme.text }]}>{workout.name}</Text>
                  <Text style={[styles.workoutMeta, { color: theme.textSecondary }]}>
                    60 min · {exerciseTotal} exercícios
                  </Text>
                </View>
              </View>
              <View style={styles.muscleRow}>
                {muscleGroups.map((m, i) => (
                  <Badge key={i} label={m} tone="muted" />
                ))}
              </View>
              <View style={styles.workoutActions}>
                <Button title="Iniciar treino" onPress={() => startWorkout(workout)} />
                <Button title="Treinar com um amigo" variant="secondary" onPress={() => {}} />
              </View>
            </Card>
          );
        })
      )}

      <Card style={styles.featureCard}>
        <View style={styles.sectionRow}>
          <SectionHeader title="Hidratação" subtitle={`meta ${waterGoal / 1000} L`} />
          <Text style={[styles.sectionStat, { color: Brand.primary }]}>{(waterAmount / 1000).toFixed(1)} L</Text>
        </View>
        <Text style={[styles.waterHint, { color: theme.textSecondary }]}>
          Faltam {Math.max(0, (waterGoal - waterAmount) / 1000).toFixed(1)} L para a meta
        </Text>
        <View style={styles.waterButtons}>
          <Button title="+300 ml" onPress={() => handleAddWater(300)} loading={waterBusy} variant="secondary" />
          <Button title="+500 ml" onPress={() => handleAddWater(500)} loading={waterBusy} variant="secondary" />
        </View>
      </Card>

      <Card style={styles.featureCard}>
        <SectionHeader title="Alimentação" subtitle="Suas refeições de hoje" />
        {meals.length === 0 ? (
          <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>Sem plano alimentar por enquanto.</Text>
        ) : (
          meals.map((m) => (
            <View key={m.id} style={styles.mealRow}>
              <Ionicons name="restaurant-outline" size={16} color={Brand.primary} />
              <Text style={[styles.mealName, { color: theme.text }]}>{m.meal_name}</Text>
              {m.calories ? <Text style={[styles.mealCal, { color: theme.textSecondary }]}>{m.calories} kcal</Text> : null}
            </View>
          ))
        )}
        <View style={styles.mealAddRow}>
          <View style={{ flex: 1 }}>
            <TextField value={mealName} onChangeText={setMealName} placeholder="Ex: Café da manhã" />
          </View>
          <Pressable
            onPress={handleLogMeal}
            disabled={mealBusy || !mealName.trim()}
            style={[styles.addBtn, { backgroundColor: Brand.primary, opacity: mealBusy || !mealName.trim() ? 0.5 : 1 }]}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </Card>

      <Card style={styles.featureCard}>
        <SectionHeader title="Resumo da semana" subtitle="Detalhes" />
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{weekWorkoutsCount}/5</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>treinos</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{weekWaterAvg.toFixed(1)} L</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>média água</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{Math.round((weekMealsCount / Math.max(1, 7)) * 100)}%</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>refeições</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{weekCount}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>total</Text>
          </View>
        </View>
      </Card>

      {!checkin?.motivation ? (
        <Card style={styles.featureCard}>
          <SectionHeader title="Sua atualização chegou" subtitle="Conta rapidinho como está sendo" />
          <Text style={[styles.checkinHint, { color: theme.textSecondary }]}>Check-in semanal</Text>
          <View style={styles.moodRow}>
            {[1, 2, 3, 4, 5].map((v) => {
              const labels = ['😞', '😕', '😐', '🙂', '😄'];
              return (
                <Pressable
                  key={v}
                  onPress={() => handleCheckin(v)}
                  disabled={savingCheckin}
                  style={[styles.moodBtn, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                  <Text style={{ fontSize: 22 }}>{labels[v - 1]}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

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
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  heroTexts: { flex: 1, gap: 2 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  brandDot: { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Brand.accent },
  brandText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4 },
  kickerText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroGreeting: { color: 'rgba(255, 255, 255, 0.82)', fontSize: 13, fontWeight: '600' },
  heroXp: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  heroHint: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 12, fontWeight: '600' },
  featureCard: { gap: Spacing.three },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.four },
  emptyIcon: { width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  goalRow: { gap: 6 },
  goalPct: { fontSize: 28, fontWeight: '800' },
  goalStats: { flexDirection: 'row', gap: Spacing.two },
  goalStat: { flex: 1, alignItems: 'center', gap: 2 },
  goalStatValue: { fontSize: 16, fontWeight: '800' },
  goalStatLabel: { fontSize: 10, fontWeight: '700' },
  goalHint: { fontSize: 12, textAlign: 'center' },
  activityRow: { flexDirection: 'row', justifyContent: 'space-around' },
  activityItem: { alignItems: 'center', gap: 2 },
  activityPct: { fontSize: 24, fontWeight: '800' },
  activityLabel: { fontSize: 12, fontWeight: '600' },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeTitle: { fontSize: 16, fontWeight: '800' },
  challengeSub: { fontSize: 13 },
  challengeDesc: { fontSize: 13, lineHeight: 18 },
  missionProgress: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  missionHint: { fontSize: 12, lineHeight: 17 },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 },
  missionCheck: { width: 28, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  missionInfo: { flex: 1, gap: 1 },
  missionTitle: { fontSize: 14, fontWeight: '700' },
  missionDesc: { fontSize: 12 },
  missionXp: { fontSize: 12, fontWeight: '800' },
  workoutCard: { gap: Spacing.three },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two },
  workoutTitleBox: { flex: 1, gap: 2 },
  workoutName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  workoutMeta: { fontSize: 12 },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  workoutActions: { gap: Spacing.two },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionStat: { fontSize: 18, fontWeight: '800' },
  waterHint: { fontSize: 13 },
  waterButtons: { flexDirection: 'row', gap: Spacing.two },
  emptyHint: { fontSize: 13, lineHeight: 19 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 4 },
  mealName: { flex: 1, fontSize: 14, fontWeight: '600' },
  mealCal: { fontSize: 12 },
  mealAddRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  addBtn: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  summaryItem: { flexBasis: '47%', flexGrow: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.two },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 11, fontWeight: '600' },
  checkinHint: { fontSize: 13, marginBottom: Spacing.one },
  moodRow: { flexDirection: 'row', gap: Spacing.two },
  moodBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1 },
});
