import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { NotificationBell } from '@/components/ui/notification-bell';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatTile } from '@/components/ui/stat-tile';
import { WeeklyChart } from '@/components/ui/weekly-chart';
import { Images } from '@/constants/images';
import { Brand, Gradients, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Profile, Workout, WorkoutSession } from '@/lib/types';
import { buildWeek, type WeeklyPoint } from '@/lib/week';
import { useAuth } from '@/providers/auth-provider';

export default function PersonalDashboard() {
  const router = useRouter();
  const theme = useTheme();
  const { profile, trialDaysLeft, daysUntilExpiry, accessExpiresAt } = useAuth();

  const [students, setStudents] = useState<Profile[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [week, setWeek] = useState<WeeklyPoint[]>([]);
  const [weekCutoff, setWeekCutoff] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [openFeedbacks, setOpenFeedbacks] = useState(0);
  const [pendingDues, setPendingDues] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDuesAmount, setPendingDuesAmount] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;

    const { data: links } = await supabase
      .from('coach_students')
      .select('student_id')
      .eq('coach_id', profile.id);

    const ids = (links ?? []).map((link) => link.student_id);

    const [
      { data: studentsData },
      { data: workoutsData },
      { data: sessionsData },
      { count: unreadCount },
      { count: feedbackCount },
      { count: dueCount },
      { data: dueData },
    ] = await Promise.all([
      ids.length
        ? supabase.from('profiles').select('*').in('id', ids).order('full_name', { ascending: true })
        : Promise.resolve({ data: [] as Profile[] }),
      supabase
        .from('workouts')
        .select('*')
        .eq('coach_id', profile.id)
        .order('created_at', { ascending: false }),
      ids.length
        ? supabase
            .from('workout_sessions')
            .select('*')
            .in('student_id', ids)
            .order('performed_at', { ascending: false })
        : Promise.resolve({ data: [] as WorkoutSession[] }),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', profile.id)
        .neq('sender_id', profile.id)
        .is('read_at', null),
      supabase
        .from('student_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', profile.id)
        .eq('status', 'open'),
      supabase
        .from('payment_dues')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', profile.id)
        .in('status', ['pending', 'late']),
      supabase
        .from('payment_dues')
        .select('amount')
        .eq('coach_id', profile.id)
        .in('status', ['pending', 'late']),
    ]);

    const studentRows = (studentsData as Profile[]) ?? [];
    const workoutRows = (workoutsData as Workout[]) ?? [];
    const sessionRows = (sessionsData as WorkoutSession[]) ?? [];
    setStudents(studentRows);
    setWorkouts(workoutRows);
    setSessions(sessionRows);
    setUnreadMessages(unreadCount ?? 0);
    setOpenFeedbacks(feedbackCount ?? 0);
    setPendingDues(dueCount ?? 0);
    setPendingDuesAmount((dueData as { amount: number | null }[] | null)?.reduce((s, d) => s + (d.amount ?? 0), 0) ?? 0);
    setActiveStudents(new Set(sessionRows.filter((s) => new Date(s.performed_at).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000).map((s) => s.student_id)).size);
    setWeek(buildWeek(sessionRows.map((s) => s.performed_at)));
    setWeekCutoff(Date.now() - 7 * 24 * 60 * 60 * 1000);
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

  const activeWorkouts = workouts.filter((w) => w.status === 'active').length;
  const weekCount = week.reduce((sum, day) => sum + day.value, 0);
  const sessionCount = sessions.length;
  const firstName = profile?.full_name?.split(' ')[0] ?? 'personal';

  const lastSessionByStudent = new Map<string, string>();
  for (const session of sessions) {
    if (!lastSessionByStudent.has(session.student_id)) {
      lastSessionByStudent.set(session.student_id, session.performed_at);
    }
  }
  const trainedThisWeek = new Set(
    sessions
      .filter((s) => new Date(s.performed_at).getTime() >= weekCutoff)
      .map((s) => s.student_id),
  );
  const inactiveStudents = students.filter((s) => !trainedThisWeek.has(s.id));
  const neverTrained = inactiveStudents.filter((s) => !lastSessionByStudent.has(s.id));
  const topAttention = inactiveStudents.slice(0, 3);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const workoutMap = new Map(workouts.map((w) => [w.id, w.name]));
  const recent = sessions.slice(0, 3);

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={[styles.brandText, { color: theme.text }]}>EVOLVI FIT</Text>
        </View>
        <NotificationBell />
      </View>

      {profile?.status === 'trial' && trialDaysLeft != null ? (
        <View style={[styles.trialBanner, { backgroundColor: Brand.warning + '22', borderColor: Brand.warning }]}>
          <Ionicons name="time-outline" size={16} color={Brand.warning} />
          <Text style={[styles.trialBannerText, { color: Brand.warning }]}>
            Período de teste: {trialDaysLeft} dia(s) restante(s). Aguarde aprovação do administrador.
          </Text>
        </View>
      ) : null}

      {profile?.status === 'approved' && daysUntilExpiry != null && daysUntilExpiry <= 7 && accessExpiresAt ? (
        <View style={[styles.trialBanner, { backgroundColor: Brand.warning + '22', borderColor: Brand.warning }]}>
          <Ionicons name="time-outline" size={16} color={Brand.warning} />
          <Text style={[styles.trialBannerText, { color: Brand.warning }]}>
            Seu acesso vence em {daysUntilExpiry} dia(s) ({new Date(accessExpiresAt).toLocaleDateString('pt-BR')}). Renove com o administrador.
          </Text>
        </View>
      ) : null}

      <PhotoHero source={Images.coach} height={280} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroTop}>
          <View style={styles.heroTexts}>
            <View style={styles.kicker}>
              <Ionicons name="flash" size={12} color={Brand.primary} />
              <Text style={styles.kickerText}>PAINEL DO PERSONAL</Text>
            </View>
            <Text style={styles.heroGreeting}>Bem-vindo de volta</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              Olá, {firstName}
            </Text>
          </View>
          <View style={styles.heroActions}>
            <Avatar name={profile?.full_name} size={56} ring />
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStatPill}>
            <Ionicons name="people" size={15} color="#FFFFFF" />
            <Text style={styles.heroStatText}>
              {students.length} {students.length === 1 ? 'aluno' : 'alunos'}
            </Text>
          </View>
          <View style={styles.heroStatPill}>
            <Ionicons name="barbell" size={15} color="#FFFFFF" />
            <Text style={styles.heroStatText}>{activeWorkouts} treinos ativos</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/personal/novo-aluno' as never)}
          style={({ pressed }) => [styles.heroCta, { opacity: pressed ? 0.85 : 1 }]}>
          <LinearGradient
            colors={Gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCtaInner}>
            <Ionicons name="person-add" size={16} color="#FFFFFF" />
            <Text style={styles.heroCtaText}>Convidar aluno</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </PhotoHero>

      <View style={styles.grid}>
        <StatTile icon="people" label="Alunos" value={students.length} tone="primary" />
        <StatTile icon="barbell" label="Treinos ativos" value={activeWorkouts} tone="accent" />
        <StatTile icon="flame" label="Sessões (7 dias)" value={weekCount} tone="warning" />
        <StatTile icon="checkmark-done" label="Sessões totais" value={sessionCount} tone="success" />
        <StatTile icon="person-add" label="Novos (sem registro)" value={neverTrained.length} tone="accent" />
      </View>

      <Card style={styles.featureCard}>
        <SectionHeader title="Atividade" subtitle="Sessões concluídas nos últimos 7 dias" />
        <WeeklyChart data={week} />
        <View style={styles.chartFooter}>
          <Text style={[styles.chartFooterText, { color: theme.textSecondary }]}>Esta semana</Text>
          <Badge label={`${weekCount} sessões`} tone="primary" />
        </View>
      </Card>

      {students.length > 0 ? (
        topAttention.length > 0 ? (
          <>
            <SectionHeader title="Precisa de atenção" subtitle="Alunos sem treino recente" actionLabel="Ver todos" onAction={() => router.push('/personal/alunos')} />
            <View style={styles.list}>
              {topAttention.map((student) => (
                <Card key={student.id} style={styles.attentionCard}>
                  <Pressable
                    style={styles.attentionMain}
                  onPress={() => router.push(`/personal/aluno/${student.id}`)}>
                    <Avatar name={student.full_name} size={44} />
                    <View style={styles.recentInfo}>
                      <Text style={[styles.recentName, { color: theme.text }]}>
                        {student.full_name ?? 'Aluno'}
                      </Text>
                      <Text style={[styles.recentMeta, { color: theme.textSecondary }]}>
                        Sem treino nos últimos 7 dias
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push({ pathname: '/personal/novo-treino', params: { student: student.id } } as never)}
                    style={[styles.miniAction, { backgroundColor: theme.primarySoft }]}>
                    <Ionicons name="barbell-outline" size={16} color={Brand.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => router.push(`/personal/aluno/${student.id}`)}
                    style={[styles.miniAction, { backgroundColor: theme.backgroundSelected }]}>
                    <Ionicons name="open-outline" size={16} color={theme.text} />
                  </Pressable>
                </Card>
              ))}
            </View>
          </>
        ) : (
          <Card style={styles.allActiveCard}>
            <View style={[styles.doneIcon, { backgroundColor: theme.successSoft }]}>
              <Ionicons name="checkmark" size={16} color={Brand.success} />
            </View>
            <View style={styles.recentInfo}>
              <Text style={[styles.recentName, { color: theme.text }]}>Todos em dia</Text>
              <Text style={[styles.recentMeta, { color: theme.textSecondary }]}>
                Todos os alunos treinaram nos últimos 7 dias.
              </Text>
            </View>
          </Card>
        )
      ) : null}

      <Card style={styles.featureCard}>
        <SectionHeader title="Resumo da semana" subtitle="Sua atividade recente" />
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{weekCount}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>sessões</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{activeStudents}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>alunos ativos</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{students.length}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>alunos total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: Brand.warning }]}>R$ {pendingDuesAmount.toFixed(0)}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>a receber</Text>
          </View>
        </View>
      </Card>

      {(unreadMessages > 0 || openFeedbacks > 0 || pendingDues > 0 || (profile?.status === 'approved' && daysUntilExpiry != null && daysUntilExpiry <= 7)) ? (
        <Card style={styles.featureCard}>
          <SectionHeader title="Alertas" subtitle="Itens que precisam de atenção" />
          {unreadMessages > 0 ? (
            <Pressable onPress={() => router.push('/personal/mensagens' as never)} style={styles.alertRow}>
              <Ionicons name="chatbubbles" size={18} color={Brand.warning} />
              <Text style={[styles.alertText, { color: theme.text }]}>{unreadMessages} mensagem(ns) não lida(s)</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
          {openFeedbacks > 0 ? (
            <Pressable onPress={() => router.push('/personal/feedbacks' as never)} style={styles.alertRow}>
              <Ionicons name="chatbox-ellipses" size={18} color={Brand.warning} />
              <Text style={[styles.alertText, { color: theme.text }]}>{openFeedbacks} feedback(s) aberto(s)</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
          {pendingDues > 0 ? (
            <Pressable onPress={() => router.push('/personal/financeiro' as never)} style={styles.alertRow}>
              <Ionicons name="card" size={18} color={Brand.warning} />
              <Text style={[styles.alertText, { color: theme.text }]}>{pendingDues} cobrança(s) pendente(s) • R$ {pendingDuesAmount.toFixed(2)}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
          {profile?.status === 'approved' && daysUntilExpiry != null && daysUntilExpiry <= 7 && accessExpiresAt ? (
            <View style={styles.alertRow}>
              <Ionicons name="time" size={18} color={Brand.danger} />
              <Text style={[styles.alertText, { color: Brand.danger }]}>Seu acesso vence em {daysUntilExpiry} dia(s). Renove com o admin.</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      <SectionHeader title="Comunicação e financeiro" subtitle="Alertas de alunos e cobranças" />
      <View style={styles.quickGrid}>
        {[
          { icon: 'chatbubbles-outline' as const, label: 'Mensagens', sub: unreadMessages ? `${unreadMessages} não lida(s)` : 'Chat com alunos', href: '/personal/mensagens', alert: unreadMessages },
          { icon: 'chatbox-ellipses-outline' as const, label: 'Feedbacks', sub: openFeedbacks ? `${openFeedbacks} novo(s)` : 'Solicitações', href: '/personal/feedbacks', alert: openFeedbacks },
          { icon: 'card-outline' as const, label: 'Financeiro', sub: pendingDues ? `${pendingDues} pendente(s)` : 'Mensalidades', href: '/personal/financeiro', alert: pendingDues },
        ].map((item) => (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.href as never)}
            style={({ pressed }) => [
              styles.quickCard,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: item.alert ? Brand.warning : theme.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}>
            <View style={[styles.quickIconWrap, { backgroundColor: item.alert ? 'rgba(245,158,11,0.15)' : theme.primarySoft }]}>
              <Ionicons name={item.icon} size={20} color={item.alert ? Brand.warning : Brand.primary} />
            </View>
            <Text style={[styles.quickLabel, { color: theme.text }]}>{item.label}</Text>
            <Text style={[styles.quickSub, { color: item.alert ? Brand.warning : theme.textSecondary }]}>{item.sub}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Central de ações" subtitle="Acesso rápido às principais ferramentas" />
      <View style={styles.quickGrid}>
        {[
          { icon: 'barbell-outline' as const, label: 'Novo treino', sub: 'Criar rotina', href: '/personal/novo-treino', primary: true },
          { icon: 'person-add-outline' as const, label: 'Convidar aluno', sub: 'Gerar link', href: '/personal/novo-aluno' },
          { icon: 'mail-outline' as const, label: 'Convites', sub: 'Gerenciar links', href: '/personal/convites' },
          { icon: 'people-outline' as const, label: 'Alunos', sub: 'Ver fichas', href: '/personal/alunos' },
          { icon: 'clipboard-outline' as const, label: 'Treinos', sub: 'Biblioteca', href: '/personal/treinos' },
          { icon: 'person-circle-outline' as const, label: 'Meu perfil', sub: 'Conta e acesso', href: '/personal/perfil' },
        ].map((item) => (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.href as never)}
            style={({ pressed }) => [
              styles.quickCard,
              {
                backgroundColor: item.primary ? undefined : theme.backgroundElement,
                borderColor: item.primary ? 'transparent' : theme.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}>
            {item.primary ? (
              <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            ) : null}
            <View style={[styles.quickIconWrap, { backgroundColor: item.primary ? 'rgba(255,255,255,0.2)' : theme.primarySoft }]}>
              <Ionicons name={item.icon} size={20} color={item.primary ? '#FFFFFF' : Brand.primary} />
            </View>
            <Text style={[styles.quickLabel, { color: item.primary ? '#FFFFFF' : theme.text }]}>{item.label}</Text>
            <Text style={[styles.quickSub, { color: item.primary ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>{item.sub}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader
        title="Últimos treinos"
        actionLabel="Ver alunos"
        onAction={() => router.push('/personal/alunos')}
      />

      {recent.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="pulse-outline" size={22} color={Brand.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Sem atividade ainda</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Quando seus alunos concluírem treinos, eles aparecerão aqui.
          </Text>
        </Card>
      ) : (
        <Card style={styles.recentListCard}>
          {recent.map((session, index) => {
            const student = studentMap.get(session.student_id);
            return (
              <Pressable
                key={session.id}
                onPress={() => router.push(`/personal/aluno/${session.student_id}`)}
                style={({ pressed }) => [
                  styles.recentRow,
                  index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                  { opacity: pressed ? 0.7 : 1 },
                ]}>
                <Avatar name={student?.full_name} size={38} />
                <View style={styles.recentInfo}>
                  <Text style={[styles.recentName, { color: theme.text }]}>
                    {student?.full_name ?? 'Aluno'}
                  </Text>
                  <Text style={[styles.recentMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {workoutMap.get(session.workout_id) ?? 'Treino'} • {new Date(session.performed_at).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                <View style={[styles.doneIcon, { backgroundColor: theme.successSoft }]}>
                  <Ionicons name="checkmark" size={16} color={Brand.success} />
                </View>
              </Pressable>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroTexts: {
    flex: 1,
    gap: 2,
  },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  trialBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Brand.primary,
  },
  brandText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(62, 207, 142, 0.16)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  kickerText: {
    color: Brand.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroGreeting: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  heroStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroStatText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  heroCta: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  heroCtaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 11,
  },
  heroCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  featureCard: {
    gap: Spacing.three,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  summaryItem: { flexBasis: '47%', flexGrow: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.two },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 11, fontWeight: '600' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 8 },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600' },
  chartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  chartFooterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  quickCard: {
    width: '31%',
    minWidth: 100,
    flexGrow: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.two,
    gap: 4,
    overflow: 'hidden',
    minHeight: 104,
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  quickSub: {
    fontSize: 11,
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
  list: {
    gap: Spacing.two,
  },
  attentionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  attentionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  miniAction: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allActiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  recentListCard: {
    paddingVertical: Spacing.one,
    gap: 0,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  recentInfo: {
    flex: 1,
    gap: 2,
  },
  recentName: {
    fontSize: 15,
    fontWeight: '700',
  },
  recentMeta: {
    fontSize: 12,
  },
  doneIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

