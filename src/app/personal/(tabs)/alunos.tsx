import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { StatTile } from '@/components/ui/stat-tile';
import { TextField } from '@/components/ui/text-field';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Profile, WorkoutSession } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type StudentRow = Profile & {
  lastSessionAt?: string | null;
  totalSessions?: number;
};

type Filter = 'all' | 'active' | 'inactive' | 'new';

function relativeLabel(value?: string | null) {
  if (!value) return 'Sem treinos';
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diff <= 0) return 'Treinou hoje';
  if (diff === 1) return 'Treinou ontem';
  if (diff < 7) return `Há ${diff} dias`;
  return formatDate(value);
}

export default function PersonalStudentsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    const { data: links, error } = await supabase
      .from('coach_students')
      .select('student_id')
      .eq('coach_id', profile.id);

    if (error) {
      console.warn(error.message);
      setStudents([]);
      return;
    }

    const ids = (links ?? []).map((link) => link.student_id);
    if (ids.length === 0) {
      setStudents([]);
      return;
    }

    const [{ data: profiles }, { data: sessions }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', ids),
      supabase
        .from('workout_sessions')
        .select('student_id, performed_at')
        .in('student_id', ids)
        .order('performed_at', { ascending: false }),
    ]);

    const lastByStudent = new Map<string, string>();
    const countByStudent = new Map<string, number>();
    ((sessions as Pick<WorkoutSession, 'student_id' | 'performed_at'>[]) ?? []).forEach((session) => {
      if (!lastByStudent.has(session.student_id)) {
        lastByStudent.set(session.student_id, session.performed_at);
      }
      countByStudent.set(session.student_id, (countByStudent.get(session.student_id) ?? 0) + 1);
    });

    setStudents(
      ((profiles as Profile[]) ?? [])
        .map((student) => ({
          ...student,
          lastSessionAt: lastByStudent.get(student.id) ?? null,
          totalSessions: countByStudent.get(student.id) ?? 0,
        }))
        .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')),
    );
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

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 6);
    return d;
  }, []);

  const activeThisWeek = students.filter(
    (student) => student.lastSessionAt && new Date(student.lastSessionAt) >= weekStart,
  ).length;
  const inactiveCount = students.filter(
    (student) => student.lastSessionAt && new Date(student.lastSessionAt) < weekStart,
  ).length;
  const newCount = students.filter((student) => !student.lastSessionAt).length;
  const totalSessions = students.reduce((sum, student) => sum + (student.totalSessions ?? 0), 0);

  const filtered = students.filter((student) => {
    const term = search.trim().toLowerCase();
    if (term) {
      const matches =
        (student.full_name ?? '').toLowerCase().includes(term) ||
        (student.email ?? '').toLowerCase().includes(term);
      if (!matches) return false;
    }
    const active = !!student.lastSessionAt && new Date(student.lastSessionAt) >= weekStart;
    if (filter === 'active') return active;
    if (filter === 'inactive') return !!student.lastSessionAt && !active;
    if (filter === 'new') return !student.lastSessionAt;
    return true;
  });

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: students.length },
    { key: 'active', label: 'Ativos', count: activeThisWeek },
    { key: 'inactive', label: 'Inativos', count: inactiveCount },
    { key: 'new', label: 'Novos', count: newCount },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PhotoHero source={Images.gym} height={220} imagePosition="center" glowColor={Brand.accent}>
        <View style={styles.heroRow}>
          <View style={styles.heroTexts}>
            <Text style={styles.heroLabel}>SUA TURMA</Text>
            <Text style={styles.heroNumber}>{students.length} alunos</Text>
            <Text style={styles.heroHint}>{activeThisWeek} treinaram nos últimos 7 dias</Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="people" size={28} color="#FFFFFF" />
          </View>
        </View>
      </PhotoHero>

      <View style={styles.grid}>
        <StatTile icon="pulse" label="Ativos na semana" value={activeThisWeek} tone="success" />
        <StatTile icon="checkmark-done" label="Sessões registradas" value={totalSessions} tone="primary" />
      </View>

      <View style={styles.actionsRow}>
        <Button title="Convidar aluno" onPress={() => router.push('/personal/novo-aluno')} style={{ flex: 1 }} />
        <Button title="Convites" variant="secondary" onPress={() => router.push('/personal/convites' as never)} style={{ flex: 1 }} />
      </View>

      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nome ou email"
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
              <Text style={[styles.filterLabel, { color: selected ? '#FFFFFF' : theme.textSecondary }]}>
                {item.label} ({item.count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {students.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Nenhum aluno ainda"
          message="Gere um link de convite. O aluno cria a própria senha e responde a anamnese antes de entrar."
          actionLabel="Convidar aluno"
          onAction={() => router.push('/personal/novo-aluno' as never)}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="Nenhum resultado"
          message="Ajuste a busca ou o filtro selecionado."
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((student) => {
            const active = !!student.lastSessionAt && new Date(student.lastSessionAt) >= weekStart;

            return (
              <Card key={student.id} style={styles.studentCard}>
                <Pressable
                  style={styles.studentMain}
                  onPress={() => router.push({ pathname: '/personal/aluno/[id]', params: { id: student.id } } as never)}>
                  <Avatar name={student.full_name} size={48} />
                  <View style={styles.studentInfo}>
                    <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>
                      {student.full_name ?? 'Aluno sem nome'}
                    </Text>
                    <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {relativeLabel(student.lastSessionAt)}
                      {student.totalSessions ? ` • ${student.totalSessions} sessões` : ''}
                    </Text>
                  </View>
                  <Badge
                    label={active ? 'Ativo' : student.lastSessionAt ? 'Inativo' : 'Novo'}
                    tone={active ? 'success' : 'muted'}
                  />
                </Pressable>
                <View style={styles.studentActions}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/personal/novo-treino', params: { student: student.id } } as never)}
                    style={[styles.iconAction, { backgroundColor: theme.primarySoft }]}>
                    <Ionicons name="barbell-outline" size={16} color={Brand.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => router.push({ pathname: '/personal/aluno/[id]', params: { id: student.id } } as never)}
                    style={[styles.iconAction, { backgroundColor: theme.backgroundSelected }]}>
                    <Ionicons name="person-outline" size={16} color={theme.text} />
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <Button title="+ Novo treino" variant="secondary" onPress={() => router.push('/personal/novo-treino' as never)} />
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
  grid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  filterPill: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    gap: Spacing.two,
  },
  studentCard: {
    gap: Spacing.two,
  },
  studentMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  studentInfo: {
    flex: 1,
    gap: 2,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
  },
  studentMeta: {
    fontSize: 12,
  },
  studentActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  iconAction: {
    flex: 1,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


