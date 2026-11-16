import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatTile } from '@/components/ui/stat-tile';
import { WeeklyChart } from '@/components/ui/weekly-chart';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { WorkoutSessionWithDetails } from '@/lib/types';
import { buildWeek, computeStreak } from '@/lib/week';
import { useAuth } from '@/providers/auth-provider';

export default function StudentHistoryScreen() {
  const theme = useTheme();
  const { profile } = useAuth();

  const [sessions, setSessions] = useState<WorkoutSessionWithDetails[]>([]);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    const query = (select: string) =>
      supabase
        .from('workout_sessions')
        .select(select)
        .eq('student_id', profile.id)
        .order('performed_at', { ascending: false })
        .limit(200);

    let { data, error } = await query('*, workout:workouts(name), session_exercises(*)');

    if (error) {
      const fallback = await query('*, workout:workouts(name)');
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.warn(error.message);
      setSessions([]);
      return;
    }

    setSessions((data as unknown as WorkoutSessionWithDetails[]) ?? []);
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

  const stats = useMemo(() => {
    const now = new Date();
    const monthSessions = sessions.filter((session) => {
      const date = new Date(session.performed_at);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;

    const totalSeconds = sessions.reduce((sum, session) => sum + (session.duration_seconds ?? 0), 0);
    const week = buildWeek(sessions.map((session) => session.performed_at));

    return {
      monthSessions,
      totalMinutes: Math.round(totalSeconds / 60),
      streak: computeStreak(sessions.map((session) => session.performed_at)),
      week,
      weekCount: week.reduce((sum, day) => sum + day.value, 0),
    };
  }, [sessions]);

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PhotoHero source={Images.student} height={220} imagePosition="top" glowColor={Brand.success}>
        <View style={styles.heroRow}>
          <View style={styles.heroTexts}>
            <Text style={styles.heroLabel}>SUA EVOLUÇÃO</Text>
            <Text style={styles.heroNumber}>{sessions.length} treinos</Text>
            <Text style={styles.heroHint}>
              {stats.weekCount} nesta semana • {stats.streak} dias de sequência
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="trophy" size={28} color="#FFFFFF" />
          </View>
        </View>
      </PhotoHero>

      <View style={styles.grid}>
        <StatTile icon="calendar" label="Este mês" value={stats.monthSessions} tone="primary" />
        <StatTile icon="timer" label="Tempo total" value={`${stats.totalMinutes} min`} tone="accent" />
        <StatTile icon="flame" label="Sequência" value={`${stats.streak} dias`} tone="warning" />
        <StatTile icon="checkmark-done" label="Sessões" value={sessions.length} tone="success" />
      </View>

      <Card style={styles.featureCard}>
        <SectionHeader title="Ritmo da semana" subtitle="Treinos concluídos nos últimos 7 dias" />
        <WeeklyChart data={stats.week} />
      </Card>

      <SectionHeader title="Sessões" subtitle="Toque para ver os detalhes" />

      {sessions.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Nada registrado ainda"
          message="Conclua um treino na aba Treino para ver seu histórico aqui."
        />
      ) : (
        sessions.map((session) => {
          const expanded = openSession === session.id;
          const exercises = [...(session.session_exercises ?? [])].sort(
            (a, b) => a.order_index - b.order_index,
          );
          const date = new Date(session.performed_at);

          return (
            <Card key={session.id} style={styles.sessionCard}>
              <Pressable
                onPress={() => setOpenSession(expanded ? null : session.id)}
                style={styles.sessionHeader}>
                <View style={[styles.dateBlock, { backgroundColor: theme.primarySoft }]}>
                  <Text style={[styles.dateDay, { color: Brand.primary }]}>{date.getDate()}</Text>
                  <Text style={[styles.dateMonth, { color: Brand.primary }]}>
                    {date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}
                  </Text>
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={[styles.sessionName, { color: theme.text }]} numberOfLines={1}>
                    {(session as any).workout?.name ?? 'Treino'}
                  </Text>
                  <Text style={[styles.sessionDate, { color: theme.textSecondary }]}>
                    {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {session.duration_seconds ? ` ? ${formatDuration(session.duration_seconds)}` : ''}
                    {exercises.length > 0 ? ` • ${exercises.length} exercícios` : ''}
                  </Text>
                </View>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>

              {expanded ? (
                <View style={styles.sessionDetails}>
                  {exercises.length === 0 ? (
                    <Text style={[styles.notes, { color: theme.textSecondary }]}>
                      {session.notes ?? 'Sem detalhes de exercícios registrados.'}
                    </Text>
                  ) : (
                    exercises.map((exercise) => (
                      <View
                        key={exercise.id}
                        style={[styles.logRow, { backgroundColor: theme.backgroundSelected }]}>
                        <View style={styles.logInfo}>
                          <Text style={[styles.logName, { color: theme.text }]}>{exercise.name}</Text>
                          {exercise.completed ? (
                            <View style={styles.logStatusRow}>
                              <Ionicons name="checkmark-circle" size={13} color={Brand.success} />
                              <Text style={[styles.logStatus, { color: Brand.success }]}>Concluído</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.logBadges}>
                          {exercise.sets_done != null ? (
                            <Badge label={`${exercise.sets_done} séries`} tone="muted" />
                          ) : null}
                          {exercise.reps_done ? <Badge label={`${exercise.reps_done} reps`} tone="muted" /> : null}
                          {exercise.weight_kg != null ? (
                            <Badge label={`${exercise.weight_kg} kg`} tone="primary" />
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </Card>
          );
        })
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
    fontWeight: '800',
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
    fontSize: 12,
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
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  featureCard: {
    gap: Spacing.three,
  },
  sessionCard: {
    gap: Spacing.two,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  dateBlock: {
    width: 46,
    height: 50,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '700',
  },
  sessionDate: {
    fontSize: 12,
  },
  sessionDetails: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    padding: Spacing.two,
  },
  logInfo: {
    flex: 1,
    gap: 1,
  },
  logName: {
    fontSize: 14,
    fontWeight: '600',
  },
  logStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  logStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  logBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'flex-end',
  },
  notes: {
    fontSize: 13,
  },
});
