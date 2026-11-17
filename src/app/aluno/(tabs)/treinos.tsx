import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ExerciseVideoModal } from '@/components/exercise-video-modal';
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
import { checkNewWorkouts } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { WorkoutWithDays } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

export default function StudentTrainingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile, brandCoverUrl } = useAuth();

  const [workouts, setWorkouts] = useState<WorkoutWithDays[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<{ title: string; url: string; instructions?: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const { data, error: loadError } = await supabase
        .from('workouts')
        .select('*, workout_days(*, workout_exercises(*, exercise:exercises(video_url, instructions)))')
        .eq('student_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (loadError) {
        setError(loadError.message);
        setWorkouts([]);
        return;
      }

      const list = (data as unknown as WorkoutWithDays[]) ?? [];
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
          const days = [...(workout.workout_days ?? [])].sort((a, b) => a.order_index - b.order_index);
          const exerciseTotal = days.reduce((sum, day) => sum + (day.workout_exercises?.length ?? 0), 0);
          return (
            <Card key={workout.id} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <View style={styles.workoutTitleBox}>
                  <Text style={[styles.workoutName, { color: theme.text }]}>{workout.name}</Text>
                  <Text style={[styles.workoutMeta, { color: theme.textSecondary }]}>
                    {days.length} divisão(ões) · {exerciseTotal} exercícios
                  </Text>
                </View>
                <Badge label="ATIVO" tone="success" />
              </View>

              {days.map((day) => (
                <View key={day.id} style={styles.dayBlock}>
                  <View style={styles.dayHeader}>
                    <View style={[styles.dayBadge, { backgroundColor: theme.primarySoft }]}>
                      <Text style={[styles.dayBadgeText, { color: Brand.primary }]}>{day.label}</Text>
                    </View>
                    <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>
                      {day.workout_exercises?.length ?? 0} exercício(s)
                    </Text>
                  </View>

                  {[...(day.workout_exercises ?? [])]
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((exercise) => {
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
                          <View style={styles.exerciseInfo}>
                            <Text style={[styles.exerciseName, { color: theme.text }]}>
                              {exercise.name}
                            </Text>
                            {details ? (
                              <Text style={[styles.exerciseMeta, { color: theme.textSecondary }]}>
                                {details}
                              </Text>
                            ) : null}
                            {exercise.notes ? (
                              <Text style={[styles.exerciseNote, { color: Brand.warning }]}>
                                Obs: {exercise.notes}
                              </Text>
                            ) : null}
                          </View>
                          {videoUrl ? (
                            <Button
                              title="Vídeo"
                              variant="ghost"
                              onPress={() =>
                                setVideo({
                                  title: exercise.name,
                                  url: videoUrl,
                                  instructions: exercise.exercise?.instructions ?? null,
                                })
                              }
                              style={styles.videoButton}
                            />
                          ) : null}
                        </View>
                      );
                    })}
                </View>
              ))}

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
  dayBlock: { gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayBadge: { minWidth: 34, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  dayBadgeText: { fontSize: 12, fontWeight: '800' },
  dayLabel: { fontSize: 12, fontWeight: '600' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  exerciseInfo: { flex: 1, gap: 1 },
  exerciseName: { fontSize: 14, fontWeight: '700' },
  exerciseMeta: { fontSize: 12 },
  exerciseNote: { fontSize: 12, lineHeight: 17 },
  videoButton: { minHeight: 38, paddingHorizontal: 12 },
});
