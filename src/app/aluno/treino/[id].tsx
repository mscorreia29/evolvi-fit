import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';

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
import { getExerciseCategory, isCardioCategory } from '@/lib/exercises';
import { formatDuration } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { WorkoutExercise, WorkoutWithDays } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type LogValues = {
  sets: string;
  reps: string;
  weight: string;
};

type FinishResult = {
  duration: number;
  calories: number;
  loadKg: number;
};

function firstNumber(value?: string | null) {
  const match = value?.replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

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

function exerciseVideoUrl(exercise: WorkoutExercise) {
  const url = exercise.video_url ?? exercise.exercise?.video_url ?? null;
  return typeof url === 'string' && url ? url : null;
}

function exerciseInstructions(exercise: WorkoutExercise) {
  const value = exercise.instructions ?? exercise.exercise?.instructions ?? null;
  return typeof value === 'string' && value ? value : null;
}

function exerciseDetails(exercise: WorkoutExercise) {
  const cardio = isCardioCategory(getExerciseCategory(exercise.exercise));
  return cardio
    ? [
        exercise.sets ? `${exercise.sets} bloco(s)` : null,
        exercise.reps,
        exercise.rest_seconds ? `${exercise.rest_seconds}s desc.` : null,
      ]
        .filter(Boolean)
        .join(' • ')
    : [
        exercise.sets ? `${exercise.sets} séries` : null,
        exercise.reps ? `${exercise.reps} reps` : null,
        exercise.rest_seconds ? `${exercise.rest_seconds}s desc.` : null,
      ]
        .filter(Boolean)
        .join(' • ');
}

function InlineExerciseVideo({ url, title }: { url: string; title: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = true;
  });

  return (
    <View style={styles.inlineVideoWrap} accessibilityLabel={`Vídeo de ${title}`}>
      <VideoView
        player={player}
        style={styles.inlineVideo}
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        nativeControls
      />
    </View>
  );
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
  const [finished, setFinished] = useState<FinishResult | null>(null);
  const [bodyWeight, setBodyWeight] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [video, setVideo] = useState<{
    title: string;
    url: string;
    instructions?: string | null;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!id || !profile) return;

    let cancelled = false;

    (async () => {
      const [workoutRes, assessmentRes] = await Promise.all([
        supabase
          .from('workouts')
          .select('*, workout_days(*, workout_exercises(*, exercise:exercises(video_url, instructions, muscle_group)))')
          .eq('id', id)
          .eq('student_id', profile.id)
          .maybeSingle(),
        supabase
          .from('physical_assessments')
          .select('weight_kg')
          .eq('student_id', profile.id)
          .not('weight_kg', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const { data, error: loadError } = workoutRes;

      if (cancelled) return;

      setBodyWeight(
        typeof assessmentRes.data?.weight_kg === 'number' ? assessmentRes.data.weight_kg : null,
      );

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

  const exerciseDayLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    days.forEach((day) => {
      day.workout_exercises?.forEach((exercise) => {
        labels[exercise.id] = day.label;
      });
    });
    return labels;
  }, [days]);

  const activeExercise = exercises[activeIndex] ?? exercises[0] ?? null;
  const activeVideoUrl = activeExercise ? exerciseVideoUrl(activeExercise) : null;
  const activeInstructions = activeExercise ? exerciseInstructions(activeExercise) : null;
  const activeDetails = activeExercise ? exerciseDetails(activeExercise) : '';
  const activeCardio = activeExercise
    ? isCardioCategory(getExerciseCategory(activeExercise.exercise))
    : false;
  const activeLog = activeExercise
    ? logs[activeExercise.id] ?? { sets: '', reps: '', weight: '' }
    : { sets: '', reps: '', weight: '' };
  const isActiveDone = activeExercise ? !!done[activeExercise.id] : false;

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
    if (next && exercise.rest_seconds !== 0) {
      handleStartRest(exercise.rest_seconds);
    }
  }

  function handleStartRest(seconds: number | null) {
    beginRest(seconds, setNow, setRestEndsAt);
  }

  function handleAddRest(seconds: number) {
    extendRest(seconds, setNow, setRestEndsAt);
  }

  const goToExercise = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(exercises.length - 1, index));
      setActiveIndex(next);
      setDetailsOpen(false);
    },
    [exercises.length],
  );

  const slideToExercise = useCallback(
    (direction: number) => {
      const next = activeIndex + direction;
      if (next < 0 || next >= exercises.length) return;

      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: direction * -44,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
      goToExercise(next);
    },
    [activeIndex, exercises.length, goToExercise, slideAnim],
  );

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderRelease: (_event, gesture) => {
          if (
            Math.abs(gesture.dx) < 40 ||
            Math.abs(gesture.dx) < Math.abs(gesture.dy) * 1.4
          ) {
            return;
          }
          slideToExercise(gesture.dx > 0 ? -1 : 1);
        },
      }),
    [slideToExercise],
  );

  function handleExit() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/aluno/(tabs)/treinos' as never);
    }
  }

  async function finishWorkout() {
    if (!workout || !profile) return;

    setSaving(true);
    setError(null);

    const duration = Math.floor((Date.now() - startedAt) / 1000);
    const loadKg = exercises.reduce(
      (total, exercise) => total + Math.max(0, firstNumber(logs[exercise.id]?.weight)),
      0,
    );
    const calories = duration > 0
      ? Math.max(1, Math.round(6 * (bodyWeight ?? 70) * (duration / 3600)))
      : 0;

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
    setFinished({ duration, calories, loadKg });
  }

  async function handleShareResult() {
    if (!finished) return;

    const load = Math.round(finished.loadKg).toLocaleString('pt-BR');
    const message = [
      'Treino concluído no Evolvi Fit!',
      '',
      workout?.name ?? 'Treino',
      `Calorias: ${finished.calories} kcal`,
      finished.loadKg > 0 ? `Carga total: ${load} kg` : null,
      `Tempo: ${formatDuration(finished.duration)}`,
      `${completedCount}/${exercises.length} exercícios concluídos`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');

    try {
      if (Platform.OS === 'web') {
        const navigator = (globalThis as {
          navigator?: {
            share?: (data: { text: string }) => Promise<void>;
            clipboard?: { writeText: (value: string) => Promise<void> };
          };
        }).navigator;

        if (navigator?.share) {
          await navigator.share({ text: message });
          return;
        }
        if (navigator?.clipboard) {
          await navigator.clipboard.writeText(message);
          setShareCopied(true);
          setTimeout(() => setShareCopied(false), 2500);
          return;
        }
      }

      await Share.share({ message, title: 'Meu treino no Evolvi Fit' });
    } catch {
      setShareCopied(false);
    }
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

  if (finished !== null) {
    const completion = exercises.length ? completedCount / exercises.length : 0;
    const load = Math.round(finished.loadKg).toLocaleString('pt-BR');

    return (
      <Screen>
        <Hero colors={Gradients.success} contentStyle={styles.finishHero}>
          <View style={styles.finishIcon}>
            <Ionicons name="trophy" size={38} color="#FFFFFF" />
          </View>
          <Text style={styles.finishTitle}>Treino concluído!</Text>
          <Text style={styles.finishTime}>{workout.name}</Text>
          <ProgressBar value={completion} color="#FFFFFF" style={styles.finishProgress} />
          <Text style={styles.finishMeta}>
            {completedCount} de {exercises.length} exercícios marcados
          </Text>
        </Hero>

        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={[styles.resultTitle, { color: theme.text }]}>Seu resultado</Text>
            <Badge label="Sessão registrada" tone="success" />
          </View>

          <View style={styles.resultGrid}>
            <View style={styles.resultItem}>
              <View style={[styles.resultIcon, { backgroundColor: 'rgba(245, 181, 68, 0.14)' }]}>
                <Ionicons name="flame" size={20} color={Brand.warning} />
              </View>
              <Text style={[styles.resultValue, { color: theme.text }]}>{finished.calories}</Text>
              <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>kcal gastas</Text>
            </View>
            <View style={styles.resultItem}>
              <View style={[styles.resultIcon, { backgroundColor: 'rgba(56, 189, 248, 0.14)' }]}>
                <Ionicons name="barbell" size={20} color={Brand.accent} />
              </View>
              <Text style={[styles.resultValue, { color: theme.text }]}>
                {finished.loadKg > 0 ? load : '—'}
              </Text>
              <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>kg levantados</Text>
            </View>
            <View style={styles.resultItem}>
              <View style={[styles.resultIcon, { backgroundColor: 'rgba(62, 207, 142, 0.14)' }]}>
                <Ionicons name="stopwatch" size={20} color={Brand.primary} />
              </View>
              <Text style={[styles.resultValue, { color: theme.text }]}>
                {formatDuration(finished.duration)}
              </Text>
              <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>tempo total</Text>
            </View>
          </View>

          <Text style={[styles.resultHint, { color: theme.textSecondary }]}>
            Calorias estimadas com base no tempo e no seu peso corporal. Carga total soma a carga
            registrada de cada exercício uma única vez.
          </Text>
        </Card>

        <Card style={styles.finishSummary}>
          <Text style={[styles.finishWorkoutName, { color: theme.text }]}>
            Bom trabalho! Descanse e hidrate-se.
          </Text>
          <Text style={[styles.finishSummaryText, { color: theme.textSecondary }]}>
            Compartilhe seu resultado e mostre a evolução para a galera.
          </Text>
        </Card>

        <Button
          title={shareCopied ? 'Resultado copiado!' : 'Compartilhar resultado'}
          onPress={handleShareResult}
        />
        <Button title="Ver histórico" onPress={() => router.replace('/aluno/historico' as never)} variant="secondary" />
        <Button
          title="Voltar aos treinos"
          onPress={() => router.replace('/aluno')}
          variant="secondary"
        />
      </Screen>
    );
  }


  return (
    <Screen scroll={false} contentStyle={styles.sessionScreen}>
      <View style={styles.sessionHeader}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleExit}
            style={[styles.exitButton, { backgroundColor: theme.primarySoft }]}
            accessibilityRole="button"
            accessibilityLabel="Sair do treino">
            <Ionicons name="arrow-back" size={17} color={Brand.primary} />
            <Text style={[styles.exitButtonText, { color: Brand.primary }]}>Sair</Text>
          </Pressable>
          <View style={[styles.elapsedPill, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="stopwatch-outline" size={14} color={Brand.primary} />
            <Text style={[styles.elapsedPillText, { color: Brand.primary }]}>
              {formatDuration(elapsed)}
            </Text>
          </View>
        </View>

        <View style={styles.workoutTitleRow}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {workout.name}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {completedCount}/{exercises.length} exercícios marcados
          </Text>
        </View>

        <ProgressBar
          value={exercises.length ? completedCount / exercises.length : 0}
          height={10}
        />
      </View>

      {activeExercise ? (
        <>
          <ScrollView
            style={styles.sessionBody}
            contentContainerStyle={styles.sessionBodyContent}
            keyboardShouldPersistTaps="handled">

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.exerciseStrip}>
            {exercises.map((exercise, index) => {
              const selected = index === activeIndex;
              const doneExercise = !!done[exercise.id];
              return (
                <Pressable
                  key={exercise.id}
                  onPress={() => goToExercise(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Exercício ${index + 1}: ${exercise.name}`}
                  style={[
                    styles.exerciseChip,
                    {
                      backgroundColor: selected ? theme.primarySoft : theme.backgroundElement,
                      borderColor: selected ? Brand.primary : theme.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.exerciseChipText,
                      { color: selected ? Brand.primary : theme.textSecondary },
                    ]}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  {doneExercise ? (
                    <Ionicons name="checkmark-circle" size={13} color={Brand.success} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View {...swipeResponder.panHandlers} style={styles.exerciseCarousel}>
            <Animated.View
              style={[
                styles.exerciseCarouselInner,
                { transform: [{ translateX: slideAnim }] },
              ]}>
              <View style={styles.swipeArea}>
              <View style={styles.focusHeader}>
                <View
                  style={[
                    styles.currentIndex,
                    {
                      backgroundColor: isActiveDone
                        ? theme.successSoft
                        : theme.primarySoft,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.currentIndexText,
                      { color: isActiveDone ? Brand.success : Brand.primary },
                    ]}>
                    {String(activeIndex + 1).padStart(2, '0')}
                  </Text>
                </View>
                <View style={styles.currentTexts}>
                  <Text
                    style={[styles.currentExerciseName, { color: theme.text }]}
                    numberOfLines={1}>
                    {activeExercise.name}
                  </Text>
                  <Text
                    style={[styles.currentExerciseMeta, { color: theme.textSecondary }]}
                    numberOfLines={1}>
                    {`Treino ${exerciseDayLabels[activeExercise.id] ?? 'A'}${
                      activeDetails ? ` · ${activeDetails}` : ''
                    }`}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleToggleDone(activeExercise)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isActiveDone ? 'Marcar como pendente' : 'Marcar como concluído'
                  }
                  hitSlop={8}>
                  <Ionicons
                    name={isActiveDone ? 'checkmark-circle' : 'ellipse-outline'}
                    size={28}
                    color={isActiveDone ? Brand.success : theme.textSecondary}
                  />
                </Pressable>
              </View>

              {restActive ? (
                <Hero
                  colors={Gradients.accent}
                  contentStyle={styles.restContent}
                  style={styles.restHero}>
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
              ) : activeVideoUrl ? (
                <InlineExerciseVideo
                  key={activeVideoUrl}
                  url={activeVideoUrl}
                  title={activeExercise.name}
                />
              ) : (
                <Card style={styles.noVideoCard}>
                  <Ionicons name="videocam-off-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.noVideoText, { color: theme.textSecondary }]}>
                    Vídeo indisponível para este exercício.
                  </Text>
                </Card>
              )}

              <Pressable
                onPress={() => setDetailsOpen((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={detailsOpen ? 'Ocultar detalhes' : 'Ver detalhes'}
                style={styles.detailsToggle}>
                <Ionicons
                  name={detailsOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color={Brand.primary}
                />
                <Text style={[styles.detailsToggleText, { color: Brand.primary }]}>
                  {detailsOpen ? 'Ocultar detalhes' : 'Detalhes do exercício'}
                </Text>
              </Pressable>

              {detailsOpen ? (
                <Card style={[styles.exerciseCard, isActiveDone && styles.exerciseCardDone]}>
                  {activeCardio ? (
                    <View style={styles.logRow}>
                      <View style={styles.logField}>
                        <TextField
                          label="Blocos"
                          value={activeLog.sets}
                          onChangeText={(value) => setLog(activeExercise.id, 'sets', value)}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={styles.logFieldWide}>
                        <TextField
                          label="Duração / distância"
                          value={activeLog.reps}
                          onChangeText={(value) => setLog(activeExercise.id, 'reps', value)}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.logRow}>
                      <View style={styles.logField}>
                        <TextField
                          label="Séries"
                          value={activeLog.sets}
                          onChangeText={(value) => setLog(activeExercise.id, 'sets', value)}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={styles.logField}>
                        <TextField
                          label="Reps"
                          value={activeLog.reps}
                          onChangeText={(value) => setLog(activeExercise.id, 'reps', value)}
                        />
                      </View>
                      <View style={styles.logField}>
                        <TextField
                          label="Carga (kg)"
                          value={activeLog.weight}
                          onChangeText={(value) => setLog(activeExercise.id, 'weight', value)}
                          keyboardType="decimal-pad"
                          placeholder="0"
                        />
                      </View>
                    </View>
                  )}

                  {activeInstructions ? (
                    <Text style={[styles.instructions, { color: theme.textSecondary }]}>
                      {activeInstructions}
                    </Text>
                  ) : null}

                  {activeExercise.notes ? (
                    <View
                      style={[
                        styles.noteBox,
                        {
                          backgroundColor: theme.backgroundSelected,
                          borderColor: theme.border,
                        },
                      ]}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color={Brand.warning}
                      />
                      <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                        {activeExercise.notes}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.exerciseActions}>
                    {activeVideoUrl ? (
                      <Pressable
                        onPress={() =>
                          setVideo({
                            title: activeExercise.name,
                            url: activeVideoUrl,
                            instructions: activeInstructions,
                          })
                        }
                        style={styles.action}>
                        <Ionicons name="expand-outline" size={18} color={Brand.primary} />
                        <Text style={[styles.actionText, { color: Brand.primary }]}>
                          Ampliar vídeo
                        </Text>
                      </Pressable>
                    ) : null}
                    {(activeExercise.rest_seconds ?? 0) > 0 ? (
                      <Pressable
                        onPress={() => handleStartRest(activeExercise.rest_seconds)}
                        style={styles.action}>
                        <Ionicons name="timer-outline" size={18} color={theme.text} />
                        <Text style={[styles.actionText, { color: theme.text }]}>
                          Descanso {activeExercise.rest_seconds ?? 60}s
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Card>
              ) : null}
            </View>
            </Animated.View>
          </View>

        </ScrollView>

        <View style={[styles.sessionFooter, { borderTopColor: theme.border }]}>
          {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}
          <View style={styles.footerPrimaryRow}>
            <Pressable
              onPress={() => slideToExercise(-1)}
              disabled={activeIndex === 0}
              accessibilityRole="button"
              accessibilityLabel="Exercício anterior"
              style={[
                styles.footerIconButton,
                {
                  backgroundColor: theme.backgroundSelected,
                  borderColor: theme.border,
                  opacity: activeIndex === 0 ? 0.4 : 1,
                },
              ]}>
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </Pressable>
            <Button
              title={isActiveDone ? 'Exercício finalizado' : 'Finalizar exercício'}
              variant={isActiveDone ? 'secondary' : 'primary'}
              disabled={isActiveDone}
              onPress={() => handleToggleDone(activeExercise)}
              style={styles.footerMainButton}
            />
            <Pressable
              onPress={() => slideToExercise(1)}
              disabled={activeIndex === exercises.length - 1}
              accessibilityRole="button"
              accessibilityLabel="Próximo exercício"
              style={[
                styles.footerIconButton,
                {
                  backgroundColor: theme.backgroundSelected,
                  borderColor: theme.border,
                  opacity: activeIndex === exercises.length - 1 ? 0.4 : 1,
                },
              ]}>
              <Ionicons name="chevron-forward" size={20} color={theme.text} />
            </Pressable>
          </View>
          <View style={styles.footerSecondaryRow}>
            <View style={styles.footerMeta}>
              <Text style={[styles.footerCount, { color: theme.textSecondary }]}>
                {activeIndex + 1} / {exercises.length}
              </Text>
              {isActiveDone ? (
                <Pressable
                  onPress={() => handleToggleDone(activeExercise)}
                  accessibilityRole="button"
                  accessibilityLabel="Desfazer conclusão do exercício"
                  style={styles.footerUndo}>
                  <Ionicons name="arrow-undo-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.footerUndoText, { color: theme.textSecondary }]}>
                    Desfazer
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={finishWorkout}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Finalizar treino">
              <Text
                style={[
                  styles.finishSessionText,
                  { color: saving ? theme.textSecondary : Brand.primary },
                ]}>
                {saving ? 'Salvando...' : 'Finalizar treino'}
              </Text>
            </Pressable>
          </View>
        </View>
        </>
      ) : (
        <>
          <EmptyState
            icon="barbell-outline"
            title="Este treino não tem exercícios"
            actionLabel="Voltar"
            onAction={handleExit}
          />
          <View style={[styles.sessionFooter, { borderTopColor: theme.border }]}>
            {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}
            <Button title="Finalizar treino" onPress={finishWorkout} loading={saving} />
          </View>
        </>
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
  sessionHeader: {
    gap: Spacing.two,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  exitButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  workoutTitleRow: {
    gap: 2,
  },
  title: {
    fontSize: 18,
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
    minHeight: 40,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  restHero: {
    minHeight: 176,
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
  sessionScreen: {
    paddingHorizontal: Spacing.three,
  },
  sessionBody: {
    flex: 1,
  },
  sessionBodyContent: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  exerciseStrip: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  exerciseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 52,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exerciseChipText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  exerciseCarousel: {
    gap: Spacing.two,
  },
  exerciseCarouselInner: {
    gap: Spacing.two,
  },
  swipeArea: {
    gap: Spacing.two,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  currentIndex: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentIndexText: {
    fontSize: 14,
    fontWeight: '800',
  },
  currentTexts: {
    flex: 1,
    gap: 2,
  },
  currentExerciseName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  currentExerciseMeta: {
    fontSize: 12,
  },
  inlineVideoWrap: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  inlineVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  noVideoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  noVideoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.one,
  },
  detailsToggleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sessionFooter: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: 1,
  },
  footerPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  footerIconButton: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  footerMainButton: {
    flex: 1,
  },
  footerSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  footerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  footerCount: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  footerUndo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  footerUndoText: {
    fontSize: 12,
    fontWeight: '700',
  },
  finishSessionText: {
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: 4,
  },
  exerciseCard: {
    gap: Spacing.two,
  },
  exerciseCardDone: {
    opacity: 0.72,
    borderColor: Brand.success,
  },
  logRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  logField: {
    flex: 1,
  },
  logFieldWide: {
    flex: 2,
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
  resultCard: {
    gap: Spacing.three,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  resultTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
  },
  resultGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  resultItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  resultValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  resultLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  resultHint: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
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
