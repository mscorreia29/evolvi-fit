import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Profile, Workout } from '@/lib/types';
import { updateWorkoutStatus } from '@/lib/workouts';
import { useAuth } from '@/providers/auth-provider';

type WorkoutRow = Workout & { workout_days?: { id: string }[] };
type Filter = 'all' | 'active' | 'draft' | 'archived';

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Ativos' },
  { key: 'draft', label: 'Rascunhos' },
  { key: 'archived', label: 'Arquivados' },
];

const statusMeta: Record<string, { label: string; tone: 'success' | 'warning' | 'muted' }> = {
  active: { label: 'Ativo', tone: 'success' },
  draft: { label: 'Rascunho', tone: 'warning' },
  archived: { label: 'Arquivado', tone: 'muted' },
};

export default function PersonalWorkoutsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [students, setStudents] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;

    let { data, error: loadError } = await supabase
      .from('workouts')
      .select('*, workout_days(id)')
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: false });

    if (loadError) {
      const fallback = await supabase
        .from('workouts')
        .select('*')
        .eq('coach_id', profile.id)
        .order('created_at', { ascending: false });
      data = fallback.data;
      loadError = fallback.error;
    }

    if (loadError) {
      console.warn(loadError.message);
      setWorkouts([]);
      return;
    }

    const list = (data as WorkoutRow[]) ?? [];
    setWorkouts(list);

    const studentIds = Array.from(new Set(list.map((workout) => workout.student_id)));
    if (studentIds.length === 0) {
      setStudents({});
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', studentIds);

    const map: Record<string, string> = {};
    ((profiles as Pick<Profile, 'id' | 'full_name'>[]) ?? []).forEach((student) => {
      map[student.id] = student.full_name ?? 'Aluno';
    });
    setStudents(map);
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

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);

    const { error: deleteError } = await supabase.from('workouts').delete().eq('id', id);

    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setConfirmId(null);
    await load();
  }

  async function handleToggleStatus(workout: WorkoutRow) {
    setStatusUpdatingId(workout.id);
    setError(null);

    const nextStatus = workout.status === 'archived' ? 'active' : 'archived';
    const result = await updateWorkoutStatus(workout.id, nextStatus);

    setStatusUpdatingId(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    await load();
  }

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = workouts.filter((workout) => {
      if (filter !== 'all' && workout.status !== filter) return false;
      if (!term) return true;
      const studentName = (students[workout.student_id] ?? '').toLowerCase();
      return studentName.includes(term) || workout.name.toLowerCase().includes(term);
    });

    const map = new Map<string, { studentName: string; workouts: WorkoutRow[] }>();
    for (const workout of filtered) {
      const studentName = students[workout.student_id] ?? 'Aluno';
      const group = map.get(workout.student_id);
      if (group) {
        group.workouts.push(workout);
      } else {
        map.set(workout.student_id, { studentName, workouts: [workout] });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [workouts, students, search, filter]);

  const activeCount = workouts.filter((workout) => workout.status === 'active').length;
  const shownCount = groups.reduce((sum, group) => sum + group.workouts.length, 0);

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PhotoHero source={Images.gym} height={220} imagePosition="bottom" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <View style={styles.heroTexts}>
            <Text style={styles.heroLabel}>BIBLIOTECA DE TREINOS</Text>
            <Text style={styles.heroNumber}>{workouts.length} treinos</Text>
            <Text style={styles.heroHint}>{activeCount} ativos agora</Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="barbell" size={28} color="#FFFFFF" />
          </View>
        </View>
      </PhotoHero>

      <Button title="+ Novo treino" onPress={() => router.push('/personal/novo-treino')} />

      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar aluno ou treino..."
        autoCapitalize="none"
        rightAccessory={<Ionicons name="search" size={18} color={theme.textSecondary} />}
      />

      <View style={styles.filters}>
        {filters.map((item) => {
          const selected = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: selected ? Brand.primaryDark : theme.backgroundElement,
                  borderColor: selected ? Brand.primaryDark : theme.border,
                },
              ]}>
              <Text
                style={[
                  styles.filterLabel,
                  { color: selected ? '#FFFFFF' : theme.textSecondary },
                ]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {search.trim() || filter !== 'all' ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {shownCount} treino(s) encontrado(s)
        </Text>
      ) : null}

      {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}

      {workouts.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="barbell-outline" size={22} color={Brand.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum treino criado</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Toque em &quot;Novo treino&quot; para montar o primeiro treino do seu aluno.
          </Text>
        </Card>
      ) : groups.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="search-outline" size={22} color={theme.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum resultado</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Ajuste a busca ou o filtro selecionado.
          </Text>
        </Card>
      ) : (
        groups.map((group) => (
          <View key={group.studentName + group.workouts[0].student_id} style={styles.group}>
            <View style={styles.groupHeader}>
              <Avatar name={group.studentName} size={32} />
              <Text style={[styles.groupName, { color: theme.text }]}>{group.studentName}</Text>
              <Badge label={`${group.workouts.length}`} tone="primary" />
            </View>

            {group.workouts.map((workout) => {
              const status = statusMeta[workout.status] ?? statusMeta.draft;
              const dayCount = workout.workout_days?.length ?? 0;

              return (
                <Card key={workout.id} style={styles.workoutCard}>
                  <View style={styles.workoutHeader}>
                    <View style={styles.workoutTitleBox}>
                      <Text style={[styles.workoutName, { color: theme.text }]}>{workout.name}</Text>
                      <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
                        <Text style={[styles.workoutMeta, { color: theme.textSecondary }]}>
                          {dayCount > 0
                            ? `${dayCount} divisão(ões)`
                            : `Criado em ${formatDate(workout.created_at)}`}
                        </Text>
                      </View>
                    </View>
                    <Badge label={status.label} tone={status.tone} />
                  </View>

                  {workout.status === 'archived' ? (
                    <Text style={[styles.archiveHint, { color: theme.textSecondary }]}>
                      Este treino está arquivado e não aparece para o aluno.
                    </Text>
                  ) : null}

                  <Pressable
                    onPress={() => handleToggleStatus(workout)}
                    disabled={statusUpdatingId === workout.id}
                    accessibilityRole="button"
                    accessibilityLabel={
                      workout.status === 'archived'
                        ? `Reativar ${workout.name}`
                        : `Arquivar ${workout.name}`
                    }
                    style={styles.statusAction}>
                    {statusUpdatingId === workout.id ? (
                      <ActivityIndicator size="small" color={Brand.primary} />
                    ) : (
                      <Ionicons
                        name={workout.status === 'archived' ? 'arrow-undo-outline' : 'archive-outline'}
                        size={16}
                        color={Brand.primary}
                      />
                    )}
                    <Text style={[styles.statusActionText, { color: Brand.primary }]}>
                      {workout.status === 'archived' ? 'Reativar treino' : 'Arquivar treino'}
                    </Text>
                  </Pressable>

                  {confirmId === workout.id ? (
                    <View style={styles.confirmBox}>
                      <Text style={[styles.confirmText, { color: theme.text }]}>Excluir este treino?</Text>
                      <View style={styles.actionsRow}>
                        <Button
                          title="Cancelar"
                          variant="secondary"
                          onPress={() => setConfirmId(null)}
                          style={styles.actionButton}
                        />
                        <Button
                          title="Excluir"
                          variant="danger"
                          onPress={() => handleDelete(workout.id)}
                          loading={deletingId === workout.id}
                          style={styles.actionButton}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.actionsRow}>
                      <Button
                        title="Editar"
                        variant="secondary"
                        onPress={() =>
                          router.push({
                            pathname: '/personal/novo-treino',
                            params: { edit: workout.id },
                          })
                        }
                        style={styles.actionButton}
                      />
                      <Button
                        title="Excluir"
                        variant="secondary"
                        onPress={() => setConfirmId(workout.id)}
                        style={styles.actionButton}
                      />
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroNumber: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroHint: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  filterPill: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
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
  group: {
    gap: Spacing.two,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  groupName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  workoutCard: {
    gap: Spacing.two,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  workoutTitleBox: {
    flex: 1,
    gap: 3,
  },
  workoutName: {
    fontSize: 17,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workoutMeta: {
    fontSize: 12,
  },
  archiveHint: {
    fontSize: 12,
  },
  statusAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 2,
  },
  statusActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  confirmBox: {
    gap: Spacing.two,
  },
  confirmText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
  },
});

