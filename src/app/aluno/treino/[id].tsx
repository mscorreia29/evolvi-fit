import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  Vibration,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Hero } from '@/components/ui/hero';
import { Loading } from '@/components/ui/loading';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Images } from '@/constants/images';
import { Brand, Gradients, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getExerciseCategory, isCardioCategory } from '@/lib/exercises';
import { formatDuration } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { WorkoutExercise, WorkoutWithDays } from '@/lib/types';
import {
  clearActiveWorkoutSession,
  loadActiveWorkoutSession,
  saveActiveWorkoutSession,
} from '@/lib/workouts';
import { useAuth } from '@/providers/auth-provider';

const WORKOUT_KEEP_AWAKE_TAG = 'evolvifit-workout';

type LogValues = {
  sets: string;
  reps: string;
  weight: string;
};

type FinishResult = {
  duration: number;
  calories: number;
  loadKg: number;
  completedCount: number;
};

function firstNumber(value?: string | null) {
  const match = value?.replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function lastNumber(value?: string | null) {
  const matches = value?.replace(',', '.').match(/\d+(?:\.\d+)?/g);
  return matches?.length ? Number(matches[matches.length - 1]) : 0;
}

function DashedLine({ color }: { color: string }) {
  return (
    <View style={styles.dashRow}>
      {Array.from({ length: 9 }).map((_, index) => (
        <View key={index} style={[styles.dash, { backgroundColor: color }]} />
      ))}
    </View>
  );
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

  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<Record<string, LogValues>>({});
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState<FinishResult | null>(null);
  const [bodyWeight, setBodyWeight] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<'weight' | 'evolution' | null>(null);
  const [weightDraft, setWeightDraft] = useState('');
  const [carouselWidth, setCarouselWidth] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  const carouselRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!workout || finished) return;

    void activateKeepAwakeAsync(WORKOUT_KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      void deactivateKeepAwake(WORKOUT_KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [workout, finished]);

  useEffect(() => {
    if (!id || !profile) return;

    let cancelled = false;

    (async () => {
      const [workoutRes, assessmentRes, draft] = await Promise.all([
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
        loadActiveWorkoutSession(),
      ]);

      const { data, error: loadError } = workoutRes;

      if (cancelled) return;

      const assessmentWeight =
        typeof assessmentRes.data?.weight_kg === 'number' ? assessmentRes.data.weight_kg : null;

      if (loadError) {
        setError(loadError.message);
        setWorkout(null);
      } else if (!data) {
        setError('Treino não encontrado.');
        setWorkout(null);
        if (draft?.workoutId === id) void clearActiveWorkoutSession().catch(() => {});
      } else {
        const loaded = data as unknown as WorkoutWithDays;
        setWorkout(loaded);

        const initialLogs: Record<string, LogValues> = {};
        let exerciseCount = 0;
        loaded.workout_days?.forEach((day) => {
          day.workout_exercises?.forEach((exercise) => {
            exerciseCount += 1;
            initialLogs[exercise.id] = {
              sets: exercise.sets != null ? String(exercise.sets) : '',
              reps: exercise.reps ?? '',
              weight: '',
            };
          });
        });

        const validDraft = draft?.workoutId === id && draft.studentId === profile.id;
        if (draft && !validDraft) void clearActiveWorkoutSession().catch(() => {});

        if (validDraft) {
          setStartedAt(draft.startedAt);
          setNow(Date.now());
          setDone(draft.done ?? {});
          setLogs({ ...initialLogs, ...(draft.logs ?? {}) });
          setRestEndsAt(draft.restEndsAt ?? null);
          setActiveIndex(
            Math.max(0, Math.min(typeof draft.activeIndex === 'number' ? draft.activeIndex : 0, exerciseCount - 1)),
          );
          setBodyWeight(draft.bodyWeight ?? assessmentWeight);
        } else {
          setStartedAt(Date.now());
          setNow(Date.now());
          setDone({});
          setLogs(initialLogs);
          setRestEndsAt(null);
          setActiveIndex(0);
          setBodyWeight(assessmentWeight);
        }
        setError(null);
      }
      setHydrated(true);
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

  const activeExercise = exercises[activeIndex] ?? exercises[0] ?? null;
  const activeDetails = activeExercise ? exerciseDetails(activeExercise) : '';
  const activeCardio = activeExercise
    ? isCardioCategory(getExerciseCategory(activeExercise.exercise))
    : false;
  const activeLog = activeExercise
    ? logs[activeExercise.id] ?? { sets: '', reps: '', weight: '' }
    : { sets: '', reps: '', weight: '' };
  const isActiveDone = activeExercise ? !!done[activeExercise.id] : false;

  const setsValue = activeLog.sets || (activeExercise?.sets != null ? String(activeExercise.sets) : '0');
  const repsGoal = activeExercise?.reps ?? '';
  const weightValue = activeLog.weight || '0';

  const cardWidth = Math.max(
    240,
    Math.min((carouselWidth || windowWidth - Spacing.three * 2) - 28, 420),
  );
  const snapInterval = cardWidth + Spacing.two;

  const elapsed = Math.floor((now - startedAt) / 1000);
  const restRemaining = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const restActive = restEndsAt !== null && restRemaining > 0;
  const completedCount = exercises.filter((exercise) => done[exercise.id]).length;
  const vibratedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated || !workout || !profile || finished) return;

    void saveActiveWorkoutSession({
      workoutId: workout.id,
      studentId: profile.id,
      startedAt,
      done,
      logs,
      restEndsAt,
      activeIndex,
      bodyWeight,
    }).catch(() => {});
  }, [hydrated, workout, profile, startedAt, done, logs, restEndsAt, activeIndex, bodyWeight, finished]);

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
      setMenuOpen(false);
      carouselRef.current?.scrollTo({ x: next * snapInterval, animated: true });
    },
    [exercises.length, snapInterval],
  );

  function handleCarouselScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
    if (next >= 0 && next < exercises.length && next !== activeIndex) {
      setActiveIndex(next);
    }
  }

  function openWeightEditor() {
    setWeightDraft(weightValue === '0' ? '' : weightValue);
    setModal('weight');
  }

  function saveWeight() {
    if (!activeExercise) return;
    setLog(activeExercise.id, 'weight', weightDraft.trim());
    setModal(null);
  }

  function leaveWorkout() {
    void clearActiveWorkoutSession().catch(() => {});
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/aluno/(tabs)/treinos' as never);
    }
  }

  function handleExit() {
    const message = 'Sair do treino? O progresso desta sessão será encerrado.';
    if (Platform.OS === 'web') {
      const browser = (globalThis as { window?: { confirm?: (text: string) => boolean } }).window;
      if (browser?.confirm && !browser.confirm(message)) return;
      leaveWorkout();
      return;
    }

    Alert.alert('Sair do treino?', 'O progresso desta sessão será encerrado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: leaveWorkout },
    ]);
  }

  async function finishWorkout(completedExerciseId?: string) {
    if (!workout || !profile) return;

    setSaving(true);
    setError(null);

    const finalDone = completedExerciseId ? { ...done, [completedExerciseId]: true } : done;
    const finalCompletedCount = exercises.filter((exercise) => finalDone[exercise.id]).length;
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
        notes: `${finalCompletedCount}/${exercises.length} exercícios concluídos`,
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
        completed: Boolean(finalDone[exercise.id]),
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

    await clearActiveWorkoutSession().catch(() => {});
    setDone(finalDone);
    setSaving(false);
    setFinished({ duration, calories, loadKg, completedCount: finalCompletedCount });
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
      `${finished.completedCount}/${exercises.length} exercícios concluídos`,
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
    const completion = exercises.length ? finished.completedCount / exercises.length : 0;
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
            {finished.completedCount} de {exercises.length} exercícios marcados
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
        <Pressable
          onPress={handleExit}
          accessibilityRole="button"
          accessibilityLabel="Sair do treino"
          style={[
            styles.exitHeaderButton,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <Ionicons name="chevron-back" size={19} color={theme.text} />
          <Text style={[styles.exitHeaderText, { color: theme.text }]}>Sair</Text>
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {workout?.name || 'Treino'}
        </Text>

        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setMenuOpen((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel="Mais opções"
            style={styles.headerIconButton}>
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
          </Pressable>
        </View>

        {menuOpen ? (
          <View
            style={[
              styles.headerMenu,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}>
            <Text style={[styles.menuInfo, { color: theme.textSecondary }]}>
              {completedCount}/{exercises.length} concluídos · {formatDuration(elapsed)}
            </Text>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                handleExit();
              }}
              style={styles.menuItem}>
              <Text style={[styles.menuItemText, { color: theme.text }]}>Sair do treino</Text>
            </Pressable>
            {restActive ? (
              <>
                <Pressable
                  onPress={() => {
                    handleAddRest(15);
                    setMenuOpen(false);
                  }}
                  style={styles.menuItem}>
                  <Text style={[styles.menuItemText, { color: theme.text }]}>Adicionar 15s</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setRestEndsAt(null);
                    setMenuOpen(false);
                  }}
                  style={styles.menuItem}>
                  <Text style={[styles.menuItemText, { color: theme.text }]}>Pular descanso</Text>
                </Pressable>
              </>
            ) : null}
            {isActiveDone && activeExercise ? (
              <Pressable
                onPress={() => {
                  handleToggleDone(activeExercise);
                  setMenuOpen(false);
                }}
                style={styles.menuItem}>
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  Desfazer conclusão
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {activeExercise ? (
        <>
          <ScrollView
            style={styles.sessionVertical}
            contentContainerStyle={styles.sessionVerticalContent}
            showsVerticalScrollIndicator={false}>
            <ScrollView
              ref={carouselRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={snapInterval}
            snapToAlignment="start"
            decelerationRate="fast"
            onScroll={handleCarouselScroll}
            scrollEventThrottle={16}
            onLayout={(event) => setCarouselWidth(event.nativeEvent.layout.width)}
            contentContainerStyle={styles.carouselContent}>
            {exercises.map((exercise, index) => {
              const mediaUrl = exerciseVideoUrl(exercise);
              const log = logs[exercise.id] ?? { sets: '', reps: '', weight: '' };
              const sets = log.sets || (exercise.sets != null ? String(exercise.sets) : '0');
              const repsGoal = exercise.reps ?? '';
              const reps = String(lastNumber(log.reps || repsGoal) || 0);
              const weight = log.weight || '0';
              const restSeconds = exercise.rest_seconds ?? 0;
              const restText =
                index === activeIndex && restActive
                  ? formatDuration(restRemaining)
                  : formatDuration(restSeconds);
              const note =
                exercise.notes || exerciseInstructions(exercise) || 'Sem observações para este exercício.';
              const isFinalCard = index === exercises.length - 1;

              return (
                <Card
                  key={exercise.id}
                  style={[
                    styles.exerciseCardShell,
                    { width: cardWidth },
                    done[exercise.id] && styles.exerciseCardDone,
                  ]}>
                  <View
                    style={[styles.cardTitleBand, { backgroundColor: theme.backgroundSelected }]}>
                    <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
                      {exercise.name}
                    </Text>
                  </View>

                  <View style={styles.mediaArea}>
                    {index === activeIndex && mediaUrl ? (
                      <InlineExerciseVideo
                        key={mediaUrl}
                        url={mediaUrl}
                        title={exercise.name}
                      />
                    ) : (
                      <Image source={Images.workout} style={styles.mediaImage} resizeMode="cover" />
                    )}
                    <View pointerEvents="none" style={styles.mediaShade} />
                  </View>

                  <Pressable
                    onPress={() => {
                      goToExercise(index);
                      handleStartRest(exercise.rest_seconds);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Iniciar descanso de ${exercise.name}`}
                    style={[styles.timerFab, { borderColor: theme.backgroundElement }]}>
                    <Ionicons name="timer-outline" size={22} color="#FFFFFF" />
                  </Pressable>


                  <View style={styles.cardBody}>
                    <View style={styles.metricsRow}>
                      <View style={styles.metricColumn}>
                        <Text style={[styles.metricValue, { color: theme.text }]}>{sets}</Text>
                        <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                          Séries
                        </Text>
                      </View>

                      <View style={styles.metricColumn}>
                        <Text style={[styles.metricValue, { color: theme.text }]}>{reps}</Text>
                        <DashedLine color={theme.border} />
                        <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                          Repetições
                        </Text>
                        <Text
                          style={[
                            styles.metricGoal,
                            { color: Brand.primary, backgroundColor: theme.primarySoft },
                          ]}>
                          {repsGoal || '—'}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => {
                          goToExercise(index);
                          openWeightEditor();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Editar carga"
                        style={styles.metricColumn}>
                        <View style={styles.weightValueRow}>
                          <Text style={[styles.metricValue, { color: theme.text }]}>{weight}</Text>
                          <Text style={[styles.weightUnit, { color: theme.textSecondary }]}>kg</Text>
                          <View style={[styles.editBadge, { backgroundColor: theme.primarySoft }]}>
                            <Ionicons name="pencil" size={10} color={Brand.primary} />
                          </View>
                        </View>
                        <DashedLine color={theme.border} />
                        <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Carga</Text>
                        <Text style={[styles.metricHint, { color: theme.textSecondary }]}>
                          toque e digite
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.restBlock}>
                      <Text style={[styles.restTime, { color: theme.text }]}>{restText}</Text>
                      <Text style={[styles.restCaption, { color: theme.textSecondary }]}>
                        Descanso
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.observationBox,
                        {
                          backgroundColor: theme.backgroundSelected,
                          borderColor: theme.border,
                        },
                      ]}>
                      <View style={styles.observationHeader}>
                        <Ionicons name="chatbubble-outline" size={14} color={Brand.primary} />
                        <Text style={[styles.observationTitle, { color: Brand.primary }]}>
                          OBSERVAÇÃO DO PERSONAL
                        </Text>
                      </View>
                      <Text
                        style={[styles.observationText, { color: theme.textSecondary }]}
                        numberOfLines={3}>
                        {note}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    <Pressable
                      onPress={() => {
                        goToExercise(index);
                        setModal('evolution');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Ver evolução"
                      style={[
                        styles.evolutionButton,
                        {
                          backgroundColor: theme.backgroundSelected,
                          borderColor: theme.border,
                        },
                      ]}>
                      <Ionicons name="trending-up-outline" size={20} color={Brand.primary} />
                    </Pressable>
                    <Button
                      title={isFinalCard ? 'Finalizar treino' : done[exercise.id] ? 'Concluído' : 'Finalizar'}
                      variant={isFinalCard || !done[exercise.id] ? 'primary' : 'secondary'}
                      disabled={isFinalCard ? saving : done[exercise.id]}
                      onPress={
                        isFinalCard
                          ? () => void finishWorkout(exercise.id)
                          : () => {
                              goToExercise(index);
                              handleToggleDone(exercise);
                            }
                      }
                      style={styles.cardFinishButton}
                    />
                  </View>
                </Card>
              );
              })}
            </ScrollView>

            {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}


          <View style={styles.pagination}>
            {exercises.map((exercise, index) => (
              <Pressable
                key={exercise.id}
                onPress={() => goToExercise(index)}
                accessibilityRole="button"
                accessibilityLabel={`Ir para o exercício ${index + 1}`}
                style={[
                  styles.paginationDot,
                  {
                    backgroundColor: index === activeIndex ? Brand.primary : theme.border,
                    width: index === activeIndex ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          </ScrollView>
        </>
      ) : (
        <>
          <EmptyState
            icon="barbell-outline"
            title="Este treino não tem exercícios"
            actionLabel="Voltar"
            onAction={handleExit}
          />
          {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}
        </>
      )}

      <Modal
        visible={modal === 'weight'}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModal(null)}>
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
            onPress={() => undefined}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Carga do exercício</Text>
            <TextField
              label="Carga (kg)"
              value={weightDraft}
              onChangeText={setWeightDraft}
              keyboardType="decimal-pad"
              placeholder="0"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => setModal(null)}
                style={styles.modalButton}
              />
              <Button title="Salvar" onPress={saveWeight} style={styles.modalButton} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={modal === 'evolution'}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModal(null)}>
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
            onPress={() => undefined}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Evolução</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {activeExercise?.name ?? 'Exercício'} · {activeCardio ? 'Cardio' : 'Força'}
            </Text>
            <View style={styles.evolutionStats}>
              <View style={styles.evolutionStat}>
                <Text style={[styles.evolutionValue, { color: theme.text }]}>{setsValue}</Text>
                <Text style={[styles.evolutionLabel, { color: theme.textSecondary }]}>Séries</Text>
              </View>
              <View style={styles.evolutionStat}>
                <Text style={[styles.evolutionValue, { color: theme.text }]}>
                  {activeLog.reps || repsGoal || '—'}
                </Text>
                <Text style={[styles.evolutionLabel, { color: theme.textSecondary }]}>Reps</Text>
              </View>
              <View style={styles.evolutionStat}>
                <Text style={[styles.evolutionValue, { color: theme.text }]}>{weightValue}</Text>
                <Text style={[styles.evolutionLabel, { color: theme.textSecondary }]}>Kg</Text>
              </View>
            </View>
            <Text style={[styles.evolutionHint, { color: theme.textSecondary }]}>
              {activeDetails || 'Nenhum histórico registrado nesta sessão.'}
            </Text>
            <Button title="Fechar" variant="secondary" onPress={() => setModal(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sessionHeader: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    marginBottom: Spacing.two,
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
    paddingTop: Spacing.two,
  },
  sessionVertical: {
    flex: 1,
  },
  sessionVerticalContent: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  exitHeaderButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: Radius.full,
    zIndex: 11,
  },
  exitHeaderText: {
    fontSize: 13,
    fontWeight: '800',
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
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  inlineVideo: {
    width: '100%',
    height: '100%',
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
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerMenu: {
    position: 'absolute',
    top: 50,
    right: 0,
    width: 208,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.one,
    gap: 2,
    zIndex: 10,
  },
  menuInfo: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  menuItem: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  carouselContent: {
    gap: Spacing.two,
  },
  exerciseCardShell: {
    alignSelf: 'flex-start',
    borderRadius: 24,
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
  cardTitleBand: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  mediaArea: {
    position: 'relative',
    height: 156,
    backgroundColor: '#000000',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  timerFab: {
    position: 'absolute',
    top: 177,
    left: '50%',
    width: 50,
    height: 50,
    marginLeft: -25,
    borderRadius: Radius.full,
    borderWidth: 5,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cardBody: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: 34,
    paddingBottom: Spacing.two,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  metricGoal: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  metricHint: {
    fontSize: 10,
    textAlign: 'center',
  },
  weightValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  weightUnit: {
    fontSize: 13,
    fontWeight: '700',
  },
  editBadge: {
    position: 'absolute',
    top: -8,
    right: -16,
    width: 18,
    height: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    height: 1,
    marginVertical: 2,
  },
  dash: {
    width: 6,
    height: 1,
    borderRadius: 1,
  },
  restBlock: {
    alignItems: 'center',
    gap: 2,
  },
  restTime: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  restCaption: {
    fontSize: 11,
    fontWeight: '700',
  },
  observationBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: 6,
  },
  observationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  observationTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  observationText: {
    fontSize: 12,
    lineHeight: 17,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  evolutionButton: {
    width: 50,
    height: 50,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFinishButton: {
    flex: 1,
    borderRadius: 16,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.two,
  },
  paginationDot: {
    height: 8,
    borderRadius: Radius.full,
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
  modalSubtitle: {
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modalButton: {
    flex: 1,
    borderRadius: Radius.md,
  },
  evolutionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  evolutionStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  evolutionValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  evolutionLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  evolutionHint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
