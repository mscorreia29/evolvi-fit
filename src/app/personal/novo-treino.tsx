import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseVideoModal } from '@/components/exercise-video-modal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Hero } from '@/components/ui/hero';
import { Loading } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { TextField } from '@/components/ui/text-field';
import { Brand, Gradients, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Exercise, Profile, WorkoutWithDays } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type ExerciseInput = {
  key: number;
  name: string;
  sets: string;
  reps: string;
  rest: string;
  exerciseId: string | null;
  videoUrl: string | null;
  instructions: string | null;
};

type DayInput = {
  key: number;
  label: string;
  exercises: ExerciseInput[];
};

function emptyExercise(key: number): ExerciseInput {
  return {
    key,
    name: '',
    sets: '3',
    reps: '12',
    rest: '60',
    exerciseId: null,
    videoUrl: null,
    instructions: null,
  };
}

function dayLetter(index: number) {
  return String.fromCharCode(65 + (index % 26));
}

export default function NewWorkoutScreen() {
  const router = useRouter();
  const { edit, student } = useLocalSearchParams<{ edit?: string; student?: string }>();
  const theme = useTheme();
  const { profile } = useAuth();

  const editingId = typeof edit === 'string' && edit.length > 0 ? edit : null;

  const [students, setStudents] = useState<Profile[]>([]);
  const [studentId, setStudentId] = useState<string | null>(
    typeof student === 'string' && student.length > 0 ? student : null,
  );
  const [name, setName] = useState('');
  const [days, setDays] = useState<DayInput[]>(() => [
    { key: 1, label: 'A', exercises: [emptyExercise(1)] },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editingId));

  const [library, setLibrary] = useState<Exercise[]>([]);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [libraryDayKey, setLibraryDayKey] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [video, setVideo] = useState<{
    title: string;
    url: string;
    instructions?: string | null;
  } | null>(null);

  const nextExerciseKey = useRef(2);
  const nextDayKey = useRef(2);

  const loadStudents = useCallback(async () => {
    if (!profile) return;

    const { data: links } = await supabase
      .from('coach_students')
      .select('student_id')
      .eq('coach_id', profile.id);

    const ids = (links ?? []).map((link) => link.student_id);
    if (ids.length === 0) {
      setStudents([]);
      return;
    }

    const { data } = await supabase.from('profiles').select('*').in('id', ids);
    setStudents(
      ((data as Profile[]) ?? []).sort((a, b) =>
        (a.full_name ?? '').localeCompare(b.full_name ?? ''),
      ),
    );
  }, [profile]);

  const loadLibrary = useCallback(async () => {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, equipment, video_url, instructions')
      .order('name');
    setLibrary((data as Exercise[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStudents();
      loadLibrary();
    }, [loadStudents, loadLibrary]),
  );

  useEffect(() => {
    if (!editingId) return;

    let cancelled = false;

    (async () => {
      const { data, error: loadError } = await supabase
        .from('workouts')
        .select('*, workout_days(*, workout_exercises(*, exercise:exercises(video_url, instructions)))')
        .eq('id', editingId)
        .maybeSingle();

      if (cancelled) return;

      if (loadError || !data) {
        setError(loadError?.message ?? 'Treino não encontrado.');
        setLoadingEdit(false);
        return;
      }

      const workout = data as unknown as WorkoutWithDays;
      setName(workout.name);
      setStudentId(workout.student_id);

      const sortedDays = [...(workout.workout_days ?? [])].sort(
        (a, b) => a.order_index - b.order_index,
      );

      const loadedDays: DayInput[] = sortedDays.map((day, dayIndex) => ({
        key: nextDayKey.current++,
        label: day.label ?? dayLetter(dayIndex),
        exercises: [...(day.workout_exercises ?? [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map((exercise) => ({
            key: nextExerciseKey.current++,
            name: exercise.name,
            sets: exercise.sets != null ? String(exercise.sets) : '',
            reps: exercise.reps ?? '',
            rest: exercise.rest_seconds != null ? String(exercise.rest_seconds) : '',
            exerciseId: exercise.exercise_id,
            videoUrl: exercise.video_url ?? exercise.exercise?.video_url ?? null,
            instructions: exercise.instructions ?? exercise.exercise?.instructions ?? null,
          })),
      }));

      if (loadedDays.length === 0) {
        loadedDays.push({
          key: nextDayKey.current++,
          label: 'A',
          exercises: [emptyExercise(nextExerciseKey.current++)],
        });
      }

      setDays(loadedDays.map((day) => ({
        ...day,
        exercises: day.exercises.length > 0 ? day.exercises : [emptyExercise(nextExerciseKey.current++)],
      })));
      setLoadingEdit(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [editingId]);

  const filteredLibrary = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return library;
    return library.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.muscle_group ?? '').toLowerCase().includes(term) ||
        (item.equipment ?? '').toLowerCase().includes(term),
    );
  }, [library, search]);

  function updateDay(dayKey: number, patch: Partial<DayInput>) {
    setDays((prev) => prev.map((day) => (day.key === dayKey ? { ...day, ...patch } : day)));
  }

  function updateExercise(
    dayKey: number,
    exerciseKey: number,
    field: 'name' | 'sets' | 'reps' | 'rest' | 'videoUrl',
    value: string,
  ) {
    setDays((prev) =>
      prev.map((day) =>
        day.key === dayKey
          ? {
              ...day,
              exercises: day.exercises.map((exercise) =>
                exercise.key === exerciseKey
                  ? { ...exercise, [field === 'videoUrl' ? 'videoUrl' : field]: value }
                  : exercise,
              ),
            }
          : day,
      ),
    );
  }

  function addDay() {
    setDays((prev) => [
      ...prev,
      {
        key: nextDayKey.current++,
        label: dayLetter(prev.length),
        exercises: [emptyExercise(nextExerciseKey.current++)],
      },
    ]);
  }

  function removeDay(dayKey: number) {
    setDays((prev) => (prev.length === 1 ? prev : prev.filter((day) => day.key !== dayKey)));
  }

  function moveDay(index: number, direction: -1 | 1) {
    setDays((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const list = [...prev];
      const [item] = list.splice(index, 1);
      list.splice(target, 0, item);
      return list;
    });
  }

  function addExercise(dayKey: number) {
    setDays((prev) =>
      prev.map((day) =>
        day.key === dayKey
          ? { ...day, exercises: [...day.exercises, emptyExercise(nextExerciseKey.current++)] }
          : day,
      ),
    );
  }

  function removeExercise(dayKey: number, exerciseKey: number) {
    setDays((prev) =>
      prev.map((day) =>
        day.key === dayKey && day.exercises.length > 1
          ? { ...day, exercises: day.exercises.filter((item) => item.key !== exerciseKey) }
          : day,
      ),
    );
  }

  function moveExercise(dayKey: number, index: number, direction: -1 | 1) {
    setDays((prev) =>
      prev.map((day) => {
        if (day.key !== dayKey) return day;
        const target = index + direction;
        if (target < 0 || target >= day.exercises.length) return day;
        const list = [...day.exercises];
        const [item] = list.splice(index, 1);
        list.splice(target, 0, item);
        return { ...day, exercises: list };
      }),
    );
  }

  function openLibrary(dayKey: number) {
    setLibraryDayKey(dayKey);
    setLibraryVisible(true);
  }

  function addFromLibrary(item: Exercise) {
    const key = nextExerciseKey.current++;
    const next: ExerciseInput = {
      key,
      name: item.name,
      sets: '3',
      reps: '12',
      rest: '60',
      exerciseId: item.id,
      videoUrl: item.video_url,
      instructions: item.instructions,
    };

    setDays((prev) => {
      const targetDay = prev.find((day) => day.key === libraryDayKey) ?? prev[0];
      return prev.map((day) => {
        if (day.key !== targetDay.key) return day;
        const emptyIndex = day.exercises.findIndex((exercise) => !exercise.name.trim());
        if (emptyIndex >= 0) {
          const copy = [...day.exercises];
          copy[emptyIndex] = next;
          return { ...day, exercises: copy };
        }
        return { ...day, exercises: [...day.exercises, next] };
      });
    });

    setLibraryVisible(false);
    setSearch('');
  }

  async function handleSave() {
    if (!profile) return;

    if (!studentId) {
      setError('Selecione o aluno.');
      return;
    }
    if (!name.trim()) {
      setError('Informe o nome do treino.');
      return;
    }

    const validDays = days
      .map((day) => ({
        ...day,
        exercises: day.exercises.filter((exercise) => exercise.name.trim()),
      }))
      .filter((day) => day.exercises.length > 0);

    if (validDays.length === 0) {
      setError('Adicione pelo menos um exercício.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      let workoutId: string;

      if (editingId) {
        const { error: updateError } = await supabase
          .from('workouts')
          .update({ name: name.trim(), student_id: studentId })
          .eq('id', editingId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        const { error: clearError } = await supabase
          .from('workout_days')
          .delete()
          .eq('workout_id', editingId);

        if (clearError) {
          throw new Error(clearError.message);
        }

        workoutId = editingId;
      } else {
        const { data: workout, error: workoutError } = await supabase
          .from('workouts')
          .insert({
            coach_id: profile.id,
            student_id: studentId,
            name: name.trim(),
            status: 'active',
          })
          .select('id')
          .single();

        if (workoutError || !workout) {
          throw new Error(workoutError?.message ?? 'Erro ao criar treino.');
        }

        workoutId = workout.id;
      }

      for (const [dayIndex, day] of validDays.entries()) {
        const { data: insertedDay, error: dayError } = await supabase
          .from('workout_days')
          .insert({
            workout_id: workoutId,
            label: day.label.trim() || dayLetter(dayIndex),
            order_index: dayIndex,
          })
          .select('id')
          .single();

        if (dayError || !insertedDay) {
          throw new Error(dayError?.message ?? 'Erro ao criar a divisão do treino.');
        }

        const rows = day.exercises.map((exercise, index) => ({
          workout_day_id: insertedDay.id,
          exercise_id: exercise.exerciseId,
          name: exercise.name.trim(),
          sets: Number(exercise.sets) || null,
          reps: exercise.reps.trim() || null,
          rest_seconds: Number(exercise.rest) || null,
          video_url: exercise.videoUrl?.trim() || null,
          order_index: index,
        }));

        const { error: exercisesError } = await supabase.from('workout_exercises').insert(rows);
        if (exercisesError) {
          throw new Error(exercisesError.message);
        }
      }

      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar o treino.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingEdit) {
    return <Loading label="Carregando treino..." />;
  }

  const totalExercises = days.reduce(
    (sum, day) => sum + day.exercises.filter((exercise) => exercise.name.trim()).length,
    0,
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>
          {editingId ? 'Editar treino' : 'Novo treino'}
        </Text>
      </View>

      <Hero contentStyle={styles.heroContent}>
        <View style={styles.heroRow}>
          <View style={styles.heroTexts}>
            <Text style={styles.heroLabel}>
              {editingId ? 'AJUSTE A ROTINA' : 'MONTE A ROTINA'}
            </Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {name.trim() || 'Novo treino'}
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="barbell" size={26} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroPill}>
            <Ionicons name="layers-outline" size={14} color="#FFFFFF" />
            <Text style={styles.heroPillText}>{days.length} divisões</Text>
          </View>
          <View style={styles.heroPill}>
            <Ionicons name="fitness-outline" size={14} color="#FFFFFF" />
            <Text style={styles.heroPillText}>{totalExercises} exercícios</Text>
          </View>
        </View>
      </Hero>

      <Card>
        <TextField
          label="Nome do treino"
          value={name}
          onChangeText={setName}
          placeholder="Ex: Treino A - Superiores"
          autoCorrect={false}
          spellCheck={false}
        />

        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Aluno</Text>
        {students.length === 0 ? (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Nenhum aluno vinculado. Crie o acesso do aluno na aba Alunos.
          </Text>
        ) : (
          <View style={styles.studentList}>
            {students.map((student) => {
              const selected = studentId === student.id;
              return (
                <Pressable
                  key={student.id}
                  onPress={() => setStudentId(student.id)}
                  style={[
                    styles.studentChip,
                    {
                      borderColor: selected ? Brand.primaryDark : theme.backgroundSelected,
                      backgroundColor: selected ? Brand.primaryDark : 'transparent',
                    },
                  ]}>
                  <Text style={{ color: selected ? '#FFFFFF' : theme.text, fontWeight: '600' }}>
                    {student.full_name ?? 'Aluno'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <SectionHeader title="Divisões" subtitle={`${days.length} dia(s) • ${totalExercises} exercícios`} />

      {days.map((day, dayIndex) => (
        <Card key={day.key} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <LinearGradient
              colors={dayIndex % 2 === 0 ? Gradients.primary : Gradients.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dayBadge}>
              <Text style={styles.dayBadgeText}>{day.label.trim().slice(0, 2) || dayLetter(dayIndex)}</Text>
            </LinearGradient>
            <View style={styles.dayLabel}>
              <TextField
                label={`Divisão ${dayIndex + 1}`}
                value={day.label}
                onChangeText={(value) => updateDay(day.key, { label: value })}
                placeholder="A, B, Peito..."
                autoCorrect={false}
                spellCheck={false}
              />
            </View>
            <View style={styles.dayActions}>
              <Pressable
                onPress={() => moveDay(dayIndex, -1)}
                disabled={dayIndex === 0}
                hitSlop={6}
                accessibilityLabel="Mover divisão para cima"
                style={{ opacity: dayIndex === 0 ? 0.3 : 1 }}>
                <Ionicons name="chevron-up" size={22} color={theme.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => moveDay(dayIndex, 1)}
                disabled={dayIndex === days.length - 1}
                hitSlop={6}
                accessibilityLabel="Mover divisão para baixo"
                style={{ opacity: dayIndex === days.length - 1 ? 0.3 : 1 }}>
                <Ionicons name="chevron-down" size={22} color={theme.textSecondary} />
              </Pressable>
              {days.length > 1 ? (
                <Pressable
                  onPress={() => removeDay(day.key)}
                  hitSlop={6}
                  accessibilityLabel="Remover divisão">
                  <Ionicons name="trash-outline" size={20} color={Brand.danger} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {day.exercises.map((exercise, index) => (
            <View
              key={exercise.key}
              style={[styles.exerciseBlock, { borderColor: theme.backgroundSelected }]}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseTitleRow}>
                  <View style={[styles.exerciseIndex, { backgroundColor: theme.primarySoft }]}>
                    <Text style={[styles.exerciseIndexText, { color: Brand.primary }]}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </View>
                  <Text style={[styles.exerciseTitle, { color: theme.text }]}>
                    Exercício {index + 1}
                  </Text>
                  {exercise.exerciseId ? (
                    <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
                      <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
                        BIBLIOTECA
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.exerciseActions}>
                  <Pressable
                    onPress={() => moveExercise(day.key, index, -1)}
                    disabled={index === 0}
                    hitSlop={6}
                    accessibilityLabel="Mover exercício para cima"
                    style={{ opacity: index === 0 ? 0.3 : 1 }}>
                    <Ionicons name="arrow-up" size={18} color={theme.textSecondary} />
                  </Pressable>
                  <Pressable
                    onPress={() => moveExercise(day.key, index, 1)}
                    disabled={index === day.exercises.length - 1}
                    hitSlop={6}
                    accessibilityLabel="Mover exercício para baixo"
                    style={{ opacity: index === day.exercises.length - 1 ? 0.3 : 1 }}>
                    <Ionicons name="arrow-down" size={18} color={theme.textSecondary} />
                  </Pressable>
                  {day.exercises.length > 1 ? (
                    <Pressable
                      onPress={() => removeExercise(day.key, exercise.key)}
                      hitSlop={6}
                      accessibilityLabel="Remover exercício">
                      <Ionicons name="trash-outline" size={18} color={Brand.danger} />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <TextField
                label="Nome"
                value={exercise.name}
                onChangeText={(value) => updateExercise(day.key, exercise.key, 'name', value)}
                placeholder="Ex: Agachamento livre"
                autoCorrect={false}
                spellCheck={false}
              />

              {exercise.videoUrl ? (
                <Pressable
                  onPress={() =>
                    setVideo({
                      title: exercise.name || 'Exercício',
                      url: exercise.videoUrl as string,
                      instructions: exercise.instructions,
                    })
                  }
                  style={styles.videoLink}>
                  <Ionicons name="play-circle" size={18} color={Brand.primary} />
                  <Text style={[styles.videoText, { color: Brand.primary }]}>Ver vídeo</Text>
                </Pressable>
              ) : null}

              <TextField
                label="URL do vídeo (opcional)"
                value={exercise.videoUrl ?? ''}
                onChangeText={(value) => updateExercise(day.key, exercise.key, 'videoUrl', value)}
                placeholder="https://..."
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <TextField
                    label="Séries"
                    value={exercise.sets}
                    onChangeText={(value) => updateExercise(day.key, exercise.key, 'sets', value)}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.rowItem}>
                  <TextField
                    label="Reps"
                    value={exercise.reps}
                    onChangeText={(value) => updateExercise(day.key, exercise.key, 'reps', value)}
                    placeholder="12 ou 8-12"
                  />
                </View>
                <View style={styles.rowItem}>
                  <TextField
                    label="Desc. (s)"
                    value={exercise.rest}
                    onChangeText={(value) => updateExercise(day.key, exercise.key, 'rest', value)}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>
          ))}

          <View style={styles.dayButtons}>
            <Button
              title="+ Biblioteca"
              variant="secondary"
              onPress={() => openLibrary(day.key)}
              style={styles.dayButton}
            />
            <Button
              title="+ Manual"
              variant="ghost"
              onPress={() => addExercise(day.key)}
              style={styles.dayButton}
            />
          </View>
        </Card>
      ))}

      <Button
        title="+ Adicionar divisão (B, C...)"
        variant="secondary"
        onPress={addDay}
      />

      {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}

      <Button
        title={editingId ? 'Salvar alterações' : 'Salvar treino'}
        onPress={handleSave}
        loading={saving}
      />

      <Modal
        visible={libraryVisible}
        animationType="slide"
        onRequestClose={() => setLibraryVisible(false)}>
        <SafeAreaView
          edges={['top', 'bottom', 'left', 'right']}
          style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Biblioteca de exercícios</Text>
            <Pressable onPress={() => setLibraryVisible(false)} accessibilityLabel="Fechar">
              <Ionicons name="close" size={26} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.modalSearch}>
            <TextField
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por nome, músculo ou equipamento"
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filteredLibrary}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                Nenhum exercício encontrado. Rode o arquivo supabase/exercises_seed.sql no Supabase.
              </Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.libraryItem, { backgroundColor: theme.backgroundElement }]}>
                <Pressable onPress={() => addFromLibrary(item)} style={styles.libraryAddArea}>
                  <View style={styles.libraryInfo}>
                    <Text style={[styles.libraryName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.libraryMeta, { color: theme.textSecondary }]}>
                      {[item.muscle_group, item.equipment].filter(Boolean).join(' • ')}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={26} color={Brand.primary} />
                </Pressable>
                {item.video_url ? (
                  <Pressable
                    onPress={() =>
                      setVideo({
                        title: item.name,
                        url: item.video_url as string,
                        instructions: item.instructions,
                      })
                    }
                    accessibilityLabel={`Ver vídeo de ${item.name}`}
                    hitSlop={8}>
                    <Ionicons name="play-circle-outline" size={26} color={Brand.primary} />
                  </Pressable>
                ) : null}
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backButton: {
    padding: Spacing.one,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroContent: {
    gap: Spacing.three,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroTexts: {
    flex: 1,
    gap: 2,
  },
  heroLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  heroPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
  },
  studentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  studentChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 12,
  },
  dayCard: {
    gap: Spacing.three,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayBadge: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    color: '#04140D',
    fontSize: 14,
    fontWeight: '800',
  },
  dayLabel: {
    flex: 1,
  },
  dayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  exerciseBlock: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  exerciseIndex: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseIndexText: {
    fontSize: 10,
    fontWeight: '800',
  },
  exerciseTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  videoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  videoText: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowItem: {
    flex: 1,
  },
  dayButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dayButton: {
    flex: 1,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSearch: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  modalList: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  libraryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 14,
    padding: Spacing.three,
  },
  libraryAddArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  libraryInfo: {
    flex: 1,
    gap: 2,
  },
  libraryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  libraryMeta: {
    fontSize: 12,
  },
});

