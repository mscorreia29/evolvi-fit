import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { NotificationBell } from '@/components/ui/notification-bell';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { estimateWorkoutMinutes } from '@/lib/exercises';
import { checkNewWorkouts } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { WorkoutWithDays } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

function asText(value: unknown) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

function asOrder(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export default function StudentTrainingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile, brandCoverUrl } = useAuth();

  const [workouts, setWorkouts] = useState<WorkoutWithDays[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar seus treinos.');
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return <Loading label="Carregando treinos..." />;
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'aluno';

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={[styles.brandText, { color: theme.text }]}>EVOLVI FIT</Text>
        </View>
        <NotificationBell />
      </View>

      <PhotoHero
        source={Images.workout}
        height={230}
        imagePosition="top"
        glowColor={Brand.accent}
        coverUrl={brandCoverUrl}>
        <View style={styles.heroTop}>
          <View style={styles.heroTexts}>
            <View style={styles.kicker}>
              <Ionicons name="barbell" size={12} color="#FFFFFF" />
              <Text style={styles.kickerText}>SEUS TREINOS</Text>
            </View>
            <Text style={styles.heroGreeting}>Bora treinar, {firstName}?</Text>
            <Text style={styles.heroHint}>
              {workouts.length === 0
                ? 'Seu personal ainda não publicou um treino.'
                : `${workouts.length} treino(s) liberado(s) para você.`}
            </Text>
          </View>
        </View>
      </PhotoHero>

      <SectionHeader
        title="Treinos ativos"
        subtitle={workouts.length > 0 ? 'Toque em iniciar para começar' : 'Aguardando seu personal'}
      />

      {error ? (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="alert-circle-outline" size={26} color={Brand.warning} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Não foi possível carregar</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{error}</Text>
          <Button title="Tentar novamente" onPress={handleRefresh} loading={refreshing} />
        </Card>
      ) : workouts.length === 0 ? (
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
        workouts.map((workout) => {
          const days = [...(workout.workout_days ?? [])].sort(
            (a, b) => asOrder(a?.order_index) - asOrder(b?.order_index),
          );
          const exerciseTotal = days.reduce(
            (sum, day) => sum + (day?.workout_exercises?.length ?? 0),
            0,
          );
          const minutes = estimateWorkoutMinutes({ workout_days: days });
          return (
            <Card key={workout.id} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <View style={styles.workoutTitleBox}>
                  <Text style={[styles.workoutName, { color: theme.text }]}>
                    {asText(workout.name) || 'Treino'}
                  </Text>
                  <Text style={[styles.workoutMeta, { color: theme.textSecondary }]}>
                    {days.length} treino(s) · {exerciseTotal} exercícios · ~{minutes} min
                  </Text>
                </View>
                <Badge label="ATIVO" tone="success" />
              </View>

              <View style={styles.daySummary}>
                {days.map((day) => {
                  const count = day?.workout_exercises?.length ?? 0;
                  return (
                    <View
                      key={day?.id ?? day?.label}
                      style={[styles.dayChip, { backgroundColor: theme.primarySoft }]}>
                      <Text style={[styles.dayChipLabel, { color: Brand.primary }]}>
                        {asText(day?.label) || 'Treino'}
                      </Text>
                      <Text style={[styles.dayChipCount, { color: theme.textSecondary }]}>
                        {count} exercício(s)
                      </Text>
                    </View>
                  );
                })}
              </View>

              <Text style={[styles.listHint, { color: theme.textSecondary }]}>
                Os exercícios aparecem ao iniciar o treino.
              </Text>

              <Button title="Iniciar treino" onPress={() => startWorkout(workout)} />
            </Card>
          );
        })
      )}

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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  brandDot: { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Brand.accent },
  brandText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroTexts: { flex: 1, gap: 3 },
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
  kickerText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroGreeting: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  heroHint: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 12, fontWeight: '600' },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.four, gap: Spacing.two },
  emptyIcon: { width: 54, height: 54, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  workoutCard: { gap: Spacing.three },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two },
  workoutTitleBox: { flex: 1, gap: 2 },
  workoutName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  workoutMeta: { fontSize: 12 },
  daySummary: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  dayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dayChipLabel: { fontSize: 12, fontWeight: '800' },
  dayChipCount: { fontSize: 11, fontWeight: '600' },
  listHint: { fontSize: 12 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  fallbackTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  fallbackText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
