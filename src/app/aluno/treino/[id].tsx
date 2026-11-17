import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { ExerciseVideoModal } from '@/components/exercise-video-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Hero } from '@/components/ui/hero';
import { Loading } from '@/components/ui/loading';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Brand, Gradients, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { WorkoutExercise, WorkoutWithDays } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type LogValues = {
  sets: string;
  reps: string;
  weight: string;
};

function beginRest(
  seconds: number | null,
  syncNow: (value: number) => void,
  setEndsAt: (value: number | null) => void,
) {
  const total = seconds && seconds > 0 ? seconds : 60;
  const current = Date.now();
  syncNow(current);
  setEndsAt(current + total * 1000);
}

function extendRest(
  seconds: number,
  syncNow: (value: number) => void,
  setEndsAt: (updater: (prev: number | null) => number | null) => void,
) {
  const current = Date.now();
  syncNow(current);
  setEndsAt((prev) => (prev ? prev + seconds * 1000 : current + seconds * 1000));
}

export default function WorkoutSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();

  const [workout, setWorkout] = useState<WorkoutWithDays | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<Record<string, LogValues>>({});
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [finishedDuration, setFinishedDuration] = useState<number | null>(null);
  const [video, setVideo] = useState<{
    title: string;
    url: string;
    instructions?: string | null;
  } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!id || !profile) return;

    let cancelled = false;

    (async () => {
      const { data, error: loadError } = await supabase
        .from('workouts')
        .select('*, workout_days(*, workout_exercises(*, exercise:exercises(video_url, instructions)))')
        .eq('id', id)
        .eq('student_id', profile.id)
        .maybeSingle();

      if (cancelled) return;

      if (loadError) {
        setError(loadError.message);
        setWorkout(null);
      } else if (!data) {
        setError('Treino não encontrado.');
        setWorkout(null);
      } else {
        const loaded = data as unknown as WorkoutWithDays;
        setWorkout(loaded);

        const initialLogs: Record<string, LogValues> = {};
        loaded.workout_days?.forEach((day) => {
          day.workout_exercises?.forEach((exercise) => {
            initialLogs[exercise.id] = {
              sets: exercise.sets != null ? String(exercise.sets) : '',
              reps: exercise.reps ?? '',
              weight: '',
            };
          });
        });
        setLogs(initialLogs);
        setError(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, profile]);

  const days = useMemo(
    () => [...(workout?.workout_days ?? [])].sort((a, b) => a.order_index - b.order_index),
    [workout],
  );

  const exercises = useMemo(
    () => days.flatMap((day) => [...(day.workout_exercises ?? [])].sort((a, b) => a.order_index - b.order_index)),
    [days],
  );

  const elapsed = Math.floor((now - startedAt) / 1000);
  const restRemaining = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const restActive = restEndsAt !== null && restRemaining > 0;
  const completedCount = exercises.filter((exercise) => done[exercise.id]).length;
  const vibratedFor = useRef<number | null>(null);

  useEffect(() => {
    if (restEndsAt !== null && restRemaining === 0 && vibratedFor.current !== restEndsAt) {
      vibratedFor.current = restEndsAt;
      Vibration.vibrate(400);
    }
  }, [restEndsAt, restRemaining]);

  function setLog(exerciseId: string, field: keyof LogValues, value: string) {
    setLogs((prev) => ({
      ...prev,
      [exerciseId]: {
        sets: prev[exerciseId]?.sets ?? '',
        reps: prev[exerciseId]?.reps ?? '',
        weight: prev[exerciseId]?.weight ?? '',
        [field]: value,
      },
    }));
  }

  function handleToggleDone(exercise: WorkoutExercise) {
    const next = !done[exercise.id];
    setDone((prev) => ({ ...prev, [exercise.id]: next }));
    if (next) {
      handleStartRest(exercise.rest_seconds);
    }
  }

  function handleStartRest(seconds: number | null) {
    beginRest(seconds, setNow, setRestEndsAt);
  }

  function handleAddRest(seconds: number) {
    extendRest(seconds, setNow, setRestEndsAt);
  }

  async function finishWorkout() {
    if (!workout || !profile) return;

    setSaving(true);
    setError(null);

    const duration = Math.floor((Date.now() - startedAt) / 1000);
    const { data: session, error: insertError } = await supabase
      .from('workout_sessions')
      .insert({
        workout_id: workout.id,
        student_id: profile.id,
        duration_seconds: duration,
        completed: true,
        notes: `${completedCount}/${exercises.length} exercícios concluídos`,
      })
      .select('id')
      .single();

    if (insertError || !session) {
      setSaving(false);
      setError(insertError?.message ?? 'Não foi possível salvar a sessão.');
      return;
    }

    const rows = exercises.map((exercise, index) => {
      const values = logs[exercise.id] ?? { sets: '', reps: '', weight: '' };
      const weight = Number(values.weight.replace(',', '.'));
      const sets = Number(values.sets);

      return {
        session_id: session.id,
        workout_exercise_id: exercise.id,
        name: exercise.name,
        sets_done: Number.isFinite(sets) && values.sets.trim() ? sets : null,
        reps_done: values.reps.trim() || null,
        weight_kg: Number.isFinite(weight) && values.weight.trim() ? weight : null,
        completed: Boolean(done[exercise.id]),
        order_index: index,
      };
    });

    if (rows.length > 0) {
      const { error: logsError } = await supabase.from('session_exercises').insert(rows);
      if (logsError) {
        setSaving(false);
        setError(
          `Sessão salva, mas os detalhes dos exercícios falharam: ${logsError.message}. Rode supabase/upgrade_v2.sql.`,
        );
        return;
      }
    }

    setSaving(false);
    setFinishedDuration(duration);
  }

  if (loading) {
    return <Loading label="Carregando treino..." />;
  }

  if (!workout) {
    return (
      <Screen>
        <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>
        <EmptyState
          icon="alert-circle-outline"
          title={error ?? 'Treino não encontrado.'}
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  if (finishedDuration !== null) {
    const completion = exercises.length ? completedCount / exercises.length : 0;

    return (
      <Screen>
        <Hero colors={Gradients.success} contentStyle={styles.finishHero}>
          <View style={styles.finishIcon}>
            <Ionicons name="trophy" size={38} color="#FFFFFF" />
          </View>
          <Text style={styles.finishTitle}>Treino concluído!</Text>
          <Text style={styles.finishTime}>
            {workout.name} • {formatDuration(finishedDuration)}
          </Text>
          <ProgressBar value={completion} color="#FFFFFF" style={styles.finishProgress} />
          <Text style={styles.finishMeta}>
            {completedCount} de {exercises.length} exercícios marcados
          </Text>
        </Hero>

        <Card style={styles.finishSummary}>
          <Badge label="Sessão registrada" tone="success" />
          <Text style={[styles.finishWorkoutName, { color: theme.text }]}>
            Bom trabalho! Descanse e hidrate-se.
          </Text>
          <Text style={[styles.finishSummaryText, { color: theme.textSecondary }]}>
            Seu personal já pode acompanhar os detalhes desta sessão painel dele.
          </Text>
        </Card>

        <Button title="Ver histórico" onPress={() => router.replace('/aluno/historico' as never)} />
        <Button
          title="Voltar aos treinos"
          onPress={() => router.replace('/aluno')}
          variant="secondary"
        />
      </Screen>
    );
  }


  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.topInfo}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {workout.name}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {completedCount}/{exercises.length} exercícios marcados
          </Text>
        </View>
        <View style={[styles.elapsedPill, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="stopwatch-outline" size={14} color={Brand.primary} />
          <Text style={[styles.elapsedPillText, { color: Brand.primary }]}>
            {formatDuration(elapsed)}
          </Text>
        </View>
      </View>

      <ProgressBar
        value={exercises.length ? completedCount / exercises.length : 0}
        height={10}
      />

      <Hero contentStyle={styles.timerContent}>
        <View style={styles.timerTop}>
          <View style={styles.timerLabelRow}>
            <Ionicons name="stopwatch-outline" size={16} color="rgba(255, 255, 255, 0.85)" />
            <Text style={styles.timerLabel}>TEMPO DE TREINO</Text>
          </View>
          <View style={styles.timerBadge}>
            <Text style={styles.timerBadgeText}>{days.length} divisões</Text>
          </View>
        </View>
        <Text style={styles.timerValue}>{formatDuration(elapsed)}</Text>
        <Text style={styles.timerHint}>
          {completedCount} de {exercises.length} exercícios concluídos
        </Text>
      </Hero>

      {restActive ? (
        <Hero colors={Gradients.accent} contentStyle={styles.restContent}>
          <View style={styles.restHeader}>
            <Ionicons name="timer-outline" size={18} color="#FFFFFF" />
            <Text style={styles.restLabel}>DESCANSO</Text>
          </View>
          <Text style={styles.restValue}>{formatDuration(restRemaining)}</Text>
          <View style={styles.restActions}>
            <Button
              title="+15s"
              variant="secondary"
              onPress={() => handleAddRest(15)}
              style={styles.restButton}
            />
            <Button
              title="Pular"
              variant="secondary"
              onPress={() => setRestEndsAt(null)}
              style={styles.restButton}
            />
          </View>
        </Hero>
      ) : null}

      {days.map((day, dayIndex) => {
        const dayExercises = [...(day.workout_exercises ?? [])].sort(
          (a, b) => a.order_index - b.order_index,
        );
        return (
          <View key={day.id} style={styles.day}>
            <View style={styles.dayHeader}>
              <LinearGradient
                colors={dayIndex % 2 === 0 ? Gradients.primary : Gradients.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>{day.label}</Text>
              </LinearGradient>
              <Text style={[styles.dayCount, { color: theme.textSecondary }]}>
                {dayExercises.length} exercício(s)
              </Text>
            </View>

            {dayExercises.map((exercise, exerciseIndex) => {
              const isDone = !!done[exercise.id];
              const videoUrl = exercise.video_url ?? exercise.exercise?.video_url ?? null;
              const instructions = exercise.exercise?.instructions ?? null;
              const values = logs[exercise.id] ?? { sets: '', reps: '', weight: '' };
              const details = [
                exercise.sets ? `${exercise.sets} séries` : null,
                exercise.reps ? `${exercise.reps} reps` : null,
                exercise.rest_seconds ? `${exercise.rest_seconds}s desc.` : null,
              ]
                .filter(Boolean)
                .join(' • ');

              return (
                <Card
                  key={exercise.id}
                  style={[styles.exerciseCard, isDone && styles.exerciseCardDone]}>
                  <Pressable onPress={() => handleToggleDone(exercise)} style={styles.exerciseCheckRow}>
                    <View
                      style={[
                        styles.exerciseIndex,
                        { backgroundColor: isDone ? theme.successSoft : theme.primarySoft },
                      ]}>
                      <Text
                        style={[
                          styles.exerciseIndexText,
                          { color: isDone ? Brand.success : Brand.primary },
                        ]}>
                        {String(exerciseIndex + 1).padStart(2, '0')}
                      </Text>
                    </View>
                    <View style={styles.exerciseInfo}>
                      <Text
                        style={[
                          styles.exerciseName,
                          { color: theme.text },
                          isDone && styles.exerciseNameDone,
                        ]}>
                        {exercise.name}
                      </Text>
                      {details ? (
                        <Text style={[styles.exerciseDetails, { color: theme.textSecondary }]}>
                          {details}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                      size={26}
                      color={isDone ? Brand.success : theme.textSecondary}
                    />
                  </Pressable>

                  <View style={styles.logRow}>
                    <View style={styles.logField}>
                      <TextField
                        label="Séries"
                        value={values.sets}
                        onChangeText={(value) => setLog(exercise.id, 'sets', value)}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.logField}>
                      <TextField
                        label="Reps"
                        value={values.reps}
                        onChangeText={(value) => setLog(exercise.id, 'reps', value)}
                      />
                    </View>
                    <View style={styles.logField}>
                      <TextField
                        label="Carga (kg)"
                        value={values.weight}
                        onChangeText={(value) => setLog(exercise.id, 'weight', value)}
                        keyboardType="decimal-pad"
                        placeholder="0"
                      />
                    </View>
                  </View>

                  {instructions ? (
                    <Text style={[styles.instructions, { color: theme.textSecondary }]}>
                      {instructions}
                    </Text>
                  ) : null}

                  {exercise.notes ? (
                    <View
                      style={[
                        styles.noteBox,
                        { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                      ]}>
                      <Ionicons name="information-circle-outline" size={16} color={Brand.warning} />
                      <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                        {exercise.notes}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.exerciseActions}>
                    {videoUrl ? (
                      <Pressable
                        onPress={() =>
                          setVideo({
                            title: exercise.name,
                            url: videoUrl,
                            instructions,
                          })
                        }
                        style={styles.action}>
                        <Ionicons name="play-circle" size={18} color={Brand.primary} />
                        <Text style={[styles.actionText, { color: Brand.primary }]}>Ver vídeo</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => handleStartRest(exercise.rest_seconds)} style={styles.action}>
                      <Ionicons name="timer-outline" size={18} color={theme.text} />
                      <Text style={[styles.actionText, { color: theme.text }]}>
                        Descanso {exercise.rest_seconds ?? 60}s
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        );
      })}

      {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}

      <Button title="Finalizar treino" onPress={finishWorkout} loading={saving} />

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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backButton: {
    padding: Spacing.one,
  },
  topInfo: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
  },
  elapsedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  elapsedPillText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timerContent: {
    gap: Spacing.two,
  },
  timerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  timerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  timerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  timerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  timerValue: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  timerHint: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  restContent: {
    gap: Spacing.two,
  },
  restHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  restValue: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  restActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  restButton: {
    flex: 1,
    minHeight: 42,
  },
  day: {
    gap: Spacing.two,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    color: '#04140D',
    fontSize: 13,
    fontWeight: '800',
  },
  dayCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseCard: {
    gap: Spacing.two,
  },
  exerciseCardDone: {
    opacity: 0.72,
    borderColor: Brand.success,
  },
  exerciseCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  exerciseIndex: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseIndexText: {
    fontSize: 11,
    fontWeight: '800',
  },
  exerciseInfo: {
    flex: 1,
    gap: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
  },
  exerciseNameDone: {
    textDecorationLine: 'line-through',
  },
  exerciseDetails: {
    fontSize: 13,
  },
  logRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  logField: {
    flex: 1,
  },
  instructions: {
    fontSize: 12,
    lineHeight: 18,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.two,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  exerciseActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  finishHero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  finishIcon: {
    width: 76,
    height: 76,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  finishTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  finishTime: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  finishProgress: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  finishMeta: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  finishSummary: {
    gap: Spacing.two,
  },
  finishWorkoutName: {
    fontSize: 17,
    fontWeight: '800',
  },
  finishSummaryText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
