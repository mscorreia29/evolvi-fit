import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { PhotoHero } from '@/components/ui/photo-hero';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatTile } from '@/components/ui/stat-tile';
import { TextField } from '@/components/ui/text-field';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchRecentChallengeLogs,
  fetchRecentCheckins,
  updateStudentGoal,
} from '@/lib/engagement';
import { formatDate, formatDuration } from '@/lib/format';
import type { AnamnesisAnswers } from '@/lib/invites';
import { supabase } from '@/lib/supabase';
import { resendStudentConfirmation, sendStudentPasswordReset } from '@/lib/students';
import type {
  CoachNote,
  DailyChallengeLog,
  PhysicalAssessment,
  Profile,
  StudentGoal,
  WeeklyCheckin,
  Workout,
  WorkoutSessionWithDetails,
} from '@/lib/types';
import { updateWorkoutStatus } from '@/lib/workouts';
import { useAuth } from '@/providers/auth-provider';

const statusMeta: Record<string, { label: string; tone: 'success' | 'warning' | 'muted' }> = {
  active: { label: 'Ativo', tone: 'success' },
  draft: { label: 'Rascunho', tone: 'warning' },
  archived: { label: 'Arquivado', tone: 'muted' },
};

type AnamnesisRow = {
  data: AnamnesisAnswers;
  created_at: string;
};

function Answer({ label, value }: { label: string; value?: string | null }) {
  const theme = useTheme();

  if (!value) return null;

  return (
    <View style={styles.answerRow}>
      <Text style={[styles.answerLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.answerValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function AnamnesisSectionTitle({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <Text style={[styles.anamnesisSection, { color: theme.textSecondary }]}>
      {children}
    </Text>
  );
}

function InfoRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const content = (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name={icon} size={16} color={Brand.primary} />
      </View>
      <View style={styles.infoText}>
        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {onPress ? <Ionicons name="open-outline" size={16} color={theme.textSecondary} /> : null}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

function asNumber(value: string) {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export default function StudentDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [student, setStudent] = useState<Profile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [anamnesis, setAnamnesis] = useState<AnamnesisRow | null>(null);
  const [assessments, setAssessments] = useState<PhysicalAssessment[]>([]);
  const [goals, setGoals] = useState<StudentGoal[]>([]);
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [sessions, setSessions] = useState<WorkoutSessionWithDetails[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<WeeklyCheckin[]>([]);
  const [recentChallenges, setRecentChallenges] = useState<DailyChallengeLog[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [accessBusy, setAccessBusy] = useState<'reset' | 'resend' | null>(null);
  const [accessMessage, setAccessMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');
  const [arm, setArm] = useState('');
  const [assessmentNotes, setAssessmentNotes] = useState('');

  const [goalTitle, setGoalTitle] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;

    const sessionsQuery = (select: string) =>
      supabase
        .from('workout_sessions')
        .select(select)
        .eq('student_id', id)
        .order('performed_at', { ascending: false })
        .limit(20);

    const [
      { data: profileData },
      { data: workoutData },
      sessionResult,
      { count },
      { data: anamnesisData },
      { data: assessmentData },
      { data: goalsData },
      { data: notesData },
      checkinsRes,
      challengesRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('workouts')
        .select('*')
        .eq('student_id', id)
        .order('created_at', { ascending: false }),
      sessionsQuery('*, workout:workouts(name), session_exercises(*)'),
      supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', id),
      supabase
        .from('anamnesis')
        .select('data, created_at')
        .eq('student_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('physical_assessments')
        .select('*')
        .eq('student_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('student_goals')
        .select('*')
        .eq('student_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('coach_notes')
        .select('*')
        .eq('student_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      fetchRecentCheckins(id, 4),
      fetchRecentChallengeLogs(id, 7),
    ]);

    let sessionData = sessionResult.data;

    if (sessionResult.error) {
      const fallback = await sessionsQuery('*, workout:workouts(name)');
      sessionData = fallback.data;
    }

    setStudent((profileData as Profile) ?? null);
    setWorkouts((workoutData as Workout[]) ?? []);
    setAnamnesis((anamnesisData as AnamnesisRow | null) ?? null);
    setAssessments((assessmentData as PhysicalAssessment[]) ?? []);
    setGoals((goalsData as StudentGoal[]) ?? []);
    setNotes((notesData as CoachNote[]) ?? []);
    setRecentCheckins(checkinsRes.checkins);
    setRecentChallenges(challengesRes.logs);
    setTotalSessions(count ?? 0);

    const list = (sessionData as unknown as WorkoutSessionWithDetails[]) ?? [];
    setSessions(list);
    setTotalSeconds(list.reduce((sum, session) => sum + (session.duration_seconds ?? 0), 0));
    setLoading(false);
  }, [id]);

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

  async function handleToggleStatus(workout: Workout) {
    setStatusUpdatingId(workout.id);
    setActionError(null);

    const nextStatus = workout.status === 'archived' ? 'active' : 'archived';
    const result = await updateWorkoutStatus(workout.id, nextStatus);

    setStatusUpdatingId(null);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    await load();
  }

  async function handleResetPassword() {
    if (!student?.email) return;

    setAccessBusy('reset');
    setAccessMessage(null);

    const result = await sendStudentPasswordReset(student.email);

    setAccessBusy(null);

    if (result.error) {
      setAccessMessage({ type: 'error', text: result.error });
      return;
    }

    setAccessMessage({
      type: 'success',
      text: `Enviamos um link de redefinição de senha para ${student.email}.`,
    });
  }

  async function handleResendConfirmation() {
    if (!student?.email) return;

    setAccessBusy('resend');
    setAccessMessage(null);

    const result = await resendStudentConfirmation(student.email);

    setAccessBusy(null);

    if (result.error) {
      setAccessMessage({ type: 'error', text: result.error });
      return;
    }

    if (result.alreadyConfirmed) {
      setAccessMessage({
        type: 'success',
        text: 'Este email já está confirmado. Se o aluno esqueceu a senha, envie o link de redefinição.',
      });
      return;
    }

    setAccessMessage({
      type: 'success',
      text: `Reenviamos o email de confirmação para ${student.email}.`,
    });
  }

  async function handleAddAssessment() {
    if (!profile || !student) return;

    const weightValue = asNumber(weight);
    const heightValue = asNumber(height);
    const bodyFatValue = asNumber(bodyFat);

    if (!weightValue && !heightValue && !bodyFatValue && !waist && !chest && !hip && !arm) {
      setAssessmentError('Preencha ao menos um campo da avaliação.');
      return;
    }

    setSavingAssessment(true);
    setAssessmentError(null);

    const measurements: Record<string, string | number | null> = {};
    const chestValue = asNumber(chest);
    const waistValue = asNumber(waist);
    const hipValue = asNumber(hip);
    const armValue = asNumber(arm);
    if (chestValue != null) measurements.chest_cm = chestValue;
    if (waistValue != null) measurements.waist_cm = waistValue;
    if (hipValue != null) measurements.hip_cm = hipValue;
    if (armValue != null) measurements.arm_cm = armValue;
    if (assessmentNotes.trim()) measurements.notes = assessmentNotes.trim();

    const { error } = await supabase.from('physical_assessments').insert({
      coach_id: profile.id,
      student_id: student.id,
      weight_kg: weightValue,
      height_cm: heightValue,
      body_fat_pct: bodyFatValue,
      measurements,
    });

    setSavingAssessment(false);

    if (error) {
      setAssessmentError(error.message);
      return;
    }

    setWeight('');
    setHeight('');
    setBodyFat('');
    setChest('');
    setWaist('');
    setHip('');
    setArm('');
    setAssessmentNotes('');
    setShowAssessmentForm(false);
    await load();
  }


  async function handleAddGoal() {
    if (!profile || !student || !goalTitle.trim()) return;
    setSavingGoal(true);
    await supabase.from('student_goals').insert({
      coach_id: profile.id,
      student_id: student.id,
      title: goalTitle.trim(),
      status: 'active',
    });
    setGoalTitle('');
    setSavingGoal(false);
    await load();
  }

  async function toggleGoal(goal: StudentGoal) {
    const next = goal.status === 'done' ? 'active' : 'done';
    await updateStudentGoal(goal.id, { status: next, progress: next === 'done' ? 100 : (goal.progress ?? 0) < 100 ? goal.progress ?? 0 : 0 });
    await load();
  }

  async function changeGoalProgress(goal: StudentGoal, delta: number) {
    const next = Math.max(0, Math.min(100, (goal.progress ?? 0) + delta));
    await updateStudentGoal(goal.id, { progress: next });
    await load();
  }

  async function removeGoal(id: string) {
    await supabase.from('student_goals').delete().eq('id', id);
    await load();
  }

  async function handleAddNote() {
    if (!profile || !student || !noteText.trim()) return;
    setSavingNote(true);
    await supabase.from('coach_notes').insert({
      coach_id: profile.id,
      student_id: student.id,
      content: noteText.trim(),
    });
    setNoteText('');
    setSavingNote(false);
    await load();
  }

  async function removeNote(id: string) {
    await supabase.from('coach_notes').delete().eq('id', id);
    await load();
  }

  async function handleQuickContact() {
    if (!student) return;
    const actions: { label: string; action: () => void }[] = [];

    if (student.phone) {
      const digits = student.phone.replace(/\D/g, '');
      actions.push({
        label: 'Abrir WhatsApp',
        action: () => Linking.openURL(`https://wa.me/55${digits}`),
      });
      actions.push({
        label: 'Ligar',
        action: () => Linking.openURL(`tel:${student.phone}`),
      });
    }
    if (student.email) {
      actions.push({
        label: 'Enviar e-mail',
        action: () => Linking.openURL(`mailto:${student.email}`),
      });
      actions.push({
        label: 'Compartilhar e-mail',
        action: async () => {
          await Share.share({ message: student.email ?? '' });
        },
      });
    }

    if (actions.length === 0) return;

    if (Platform.OS === 'web') {
      actions[0].action();
      return;
    }

    Alert.alert('Contato', student.full_name ?? 'Aluno', [
      ...actions.map((item) => ({ text: item.label, onPress: item.action })),
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  const lastActivity = sessions[0]?.performed_at ?? null;
  const latestAssessment = assessments[0] ?? null;

  const bmi = useMemo(() => {
    if (!latestAssessment?.weight_kg || !latestAssessment?.height_cm) return null;
    const h = latestAssessment.height_cm / 100;
    if (h <= 0) return null;
    return Math.round((latestAssessment.weight_kg / (h * h)) * 10) / 10;
  }, [latestAssessment]);

  if (loading) {
    return <Loading label="Carregando ficha do aluno..." />;
  }

  if (!student) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Aluno não encontrado"
          message="Talvez o vínculo tenha sido removido."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const activeWorkouts = workouts.filter((workout) => workout.status === 'active').length;
  const averageMinutes = sessions.length
    ? Math.round((totalSeconds / sessions.length / 60) * 10) / 10
    : 0;

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PhotoHero source={Images.student} height={240} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Ficha do aluno</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.heroRow}>
          <Avatar name={student.full_name} size={76} ring />
          <View style={styles.heroTexts}>
            <Text style={styles.heroName} numberOfLines={2}>
              {student.full_name ?? 'Aluno sem nome'}
            </Text>
            <Text style={styles.heroMeta} numberOfLines={1}>
              {student.email ?? 'Sem email'}
            </Text>
            <View style={styles.heroPills}>
              <View style={styles.heroPill}>
                <Ionicons name="checkmark-done" size={13} color="#FFFFFF" />
                <Text style={styles.heroPillText}>{totalSessions} sessões</Text>
              </View>
              <View style={styles.heroPill}>
                <Ionicons name="barbell" size={13} color="#FFFFFF" />
                <Text style={styles.heroPillText}>{activeWorkouts} ativos</Text>
              </View>
            </View>
          </View>
        </View>
      </PhotoHero>

      <View style={styles.quickActions}>
        <Pressable
          style={[styles.quickAction, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          onPress={() =>
            router.push({ pathname: '/personal/novo-treino' as any, params: { student: student.id } })
          }>
          <View style={[styles.quickIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="add" size={18} color={Brand.primary} />
          </View>
          <Text style={[styles.quickLabel, { color: theme.text }]}>Novo treino</Text>
        </Pressable>
        <Pressable
          style={[styles.quickAction, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          onPress={handleQuickContact}
          disabled={!student.phone && !student.email}>
          <View style={[styles.quickIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={Brand.primary} />
          </View>
          <Text style={[styles.quickLabel, { color: theme.text }]}>Contato</Text>
        </Pressable>
        <Pressable
          style={[styles.quickAction, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          onPress={() => setShowAssessmentForm((v) => !v)}>
          <View style={[styles.quickIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="body-outline" size={18} color={Brand.primary} />
          </View>
          <Text style={[styles.quickLabel, { color: theme.text }]}>Avaliação</Text>
        </Pressable>
        <Pressable
          style={[styles.quickAction, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          onPress={() =>
            router.push({
              pathname: '/personal/plano-alimentar' as any,
              params: { student: student.id },
            })
          }>
          <View style={[styles.quickIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="restaurant-outline" size={18} color={Brand.primary} />
          </View>
          <Text style={[styles.quickLabel, { color: theme.text }]}>Alimentação</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <StatTile icon="checkmark-done" label="Sessões" value={totalSessions} tone="primary" />
        <StatTile icon="barbell" label="Treinos ativos" value={activeWorkouts} tone="accent" />
        <StatTile icon="timer" label="Duração média" value={`${averageMinutes} min`} tone="warning" />
        <StatTile
          icon="calendar"
          label="Última atividade"
          value={lastActivity ? formatDate(lastActivity) : '—'}
          tone="success"
        />
      </View>

      <Card>
        <SectionHeader title="Dados do aluno" subtitle="Informações de cadastro e vínculo" />
        <InfoRow icon="person-outline" label="Nome" value={student.full_name ?? 'Não informado'} />
        <InfoRow
          icon="mail-outline"
          label="E-mail"
          value={student.email ?? 'Não informado'}
          onPress={student.email ? () => Linking.openURL(`mailto:${student.email}`) : undefined}
        />
        <InfoRow
          icon="call-outline"
          label="Telefone"
          value={student.phone ?? 'Não informado'}
          onPress={student.phone ? () => Linking.openURL(`tel:${student.phone}`) : undefined}
        />
        <InfoRow
          icon="calendar-outline"
          label="Nascimento"
          value={student.birth_date ? formatDate(student.birth_date) : 'Não informado'}
        />
        <InfoRow icon="time-outline" label="Aluno desde" value={formatDate(student.created_at)} />
      </Card>

      {anamnesis ? (
        <Card>
          <SectionHeader
            title="Anamnese do aluno"
            subtitle={`Respostas do convite em ${formatDate(anamnesis.created_at)}`}
          />
          <View style={styles.anamnesisSummary}>
            {anamnesis.data.goal ? <Badge label={anamnesis.data.goal} tone="primary" /> : null}
            {anamnesis.data.experience ? <Badge label={anamnesis.data.experience} tone="muted" /> : null}
            {anamnesis.data.frequency ? <Badge label={anamnesis.data.frequency} tone="success" /> : null}
          </View>
          <AnamnesisSectionTitle>Treino</AnamnesisSectionTitle>
          <Answer label="Objetivo" value={anamnesis.data.goal} />
          <Answer label="Experiência" value={anamnesis.data.experience} />
          <Answer label="Frequência semanal" value={anamnesis.data.frequency} />
          <Answer label="Duração da sessão" value={anamnesis.data.sessionLength} />
          <Answer label="Local de treino" value={anamnesis.data.location} />
          <Answer label="Disponibilidade" value={anamnesis.data.availability} />
          <Answer
            label="Equipamentos"
            value={anamnesis.data.equipment?.length ? anamnesis.data.equipment.join(', ') : null}
          />
          <AnamnesisSectionTitle>Saúde</AnamnesisSectionTitle>
          <Answer
            label="Condições de saúde"
            value={
              anamnesis.data.healthConditions?.length
                ? anamnesis.data.healthConditions.join(', ')
                : null
            }
          />
          <Answer label="Usa medicação" value={anamnesis.data.medicationUse} />
          <Answer label="Medicamentos" value={anamnesis.data.medications} />
          <Answer label="Histórico de fratura" value={anamnesis.data.fractureHistory} />
          <Answer label="Lesões" value={anamnesis.data.injuries} />
          <Answer label="Dores" value={anamnesis.data.pain} />
          <Answer label="Liberação médica" value={anamnesis.data.medicalClearance} />
          <Answer label="Saúde / restrições" value={anamnesis.data.health} />
          <AnamnesisSectionTitle>Estilo de vida</AnamnesisSectionTitle>
          <Answer label="Qualidade da dieta" value={anamnesis.data.dietQuality} />
          <Answer label="Refeições por dia" value={anamnesis.data.mealsPerDay} />
          <Answer label="Acompanhamento alimentar" value={anamnesis.data.dietFollow} />
          <Answer label="Consumo de água" value={anamnesis.data.waterIntake} />
          <Answer label="Álcool" value={anamnesis.data.alcohol} />
          <Answer label="Tabagismo" value={anamnesis.data.smoking} />
          <Answer label="Sono" value={anamnesis.data.sleep} />
          <Answer label="Estresse" value={anamnesis.data.stress} />
          <Answer label="Suplementos" value={anamnesis.data.supplements} />
          <Answer label="Observações" value={anamnesis.data.notes} />
        </Card>
      ) : (
        <Card>
          <SectionHeader
            title="Anamnese do aluno"
            subtitle="Aguardando respostas do convite"
          />
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            O aluno ainda não preencheu a anamnese. Os dados aparecerão aqui quando ele aceitar
            o convite.
          </Text>
        </Card>
      )}

      <Card>
        <SectionHeader
          title="Avaliações físicas"
          subtitle="Acompanhe medidas e evolução corporal"
          actionLabel={showAssessmentForm ? 'Fechar' : 'Nova avaliação'}
          onAction={() => setShowAssessmentForm((v) => !v)}
        />

        {latestAssessment ? (
          <View style={styles.latestAssessment}>
            <View style={styles.assessmentStats}>
              <View style={styles.assessmentStat}>
                <Text style={[styles.assessmentStatValue, { color: theme.text }]}>
                  {latestAssessment.weight_kg != null ? `${latestAssessment.weight_kg} kg` : '—'}
                </Text>
                <Text style={[styles.assessmentStatLabel, { color: theme.textSecondary }]}>Peso</Text>
              </View>
              <View style={styles.assessmentStat}>
                <Text style={[styles.assessmentStatValue, { color: theme.text }]}>
                  {latestAssessment.height_cm != null ? `${latestAssessment.height_cm} cm` : '—'}
                </Text>
                <Text style={[styles.assessmentStatLabel, { color: theme.textSecondary }]}>Altura</Text>
              </View>
              <View style={styles.assessmentStat}>
                <Text style={[styles.assessmentStatValue, { color: theme.text }]}>
                  {latestAssessment.body_fat_pct != null ? `${latestAssessment.body_fat_pct}%` : '—'}
                </Text>
                <Text style={[styles.assessmentStatLabel, { color: theme.textSecondary }]}>Gordura</Text>
              </View>
              <View style={styles.assessmentStat}>
                <Text style={[styles.assessmentStatValue, { color: Brand.primary }]}>
                  {bmi != null ? bmi : '—'}
                </Text>
                <Text style={[styles.assessmentStatLabel, { color: theme.textSecondary }]}>IMC</Text>
              </View>
            </View>
            <Text style={[styles.assessmentDate, { color: theme.textSecondary }]}>
              Última: {formatDate(latestAssessment.created_at)}
            </Text>
          </View>
        ) : !showAssessmentForm ? (
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            Nenhuma avaliação registrada. Adicione medidas para acompanhar a evolução.
          </Text>
        ) : null}

        {showAssessmentForm ? (
          <View style={styles.assessmentForm}>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <TextField label="Peso (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Ex.: 78.5" />
              </View>
              <View style={styles.formCol}>
                <TextField label="Altura (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="Ex.: 175" />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <TextField label="% Gordura" value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" placeholder="Ex.: 18" />
              </View>
              <View style={styles.formCol}>
                <TextField label="Cintura (cm)" value={waist} onChangeText={setWaist} keyboardType="decimal-pad" placeholder="Ex.: 82" />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <TextField label="Peitoral (cm)" value={chest} onChangeText={setChest} keyboardType="decimal-pad" />
              </View>
              <View style={styles.formCol}>
                <TextField label="Quadril (cm)" value={hip} onChangeText={setHip} keyboardType="decimal-pad" />
              </View>
            </View>
            <TextField label="Braço (cm)" value={arm} onChangeText={setArm} keyboardType="decimal-pad" />
            <TextField label="Observações" value={assessmentNotes} onChangeText={setAssessmentNotes} placeholder="Notas da avaliação" multiline />
            {assessmentError ? <Text style={[styles.errorText, { color: Brand.danger }]}>{assessmentError}</Text> : null}
            <Button title="Salvar avaliação" onPress={handleAddAssessment} loading={savingAssessment} />
          </View>
        ) : null}

        {assessments.length > 1 ? (
          <View style={styles.assessmentHistory}>
            <Text style={[styles.historyTitle, { color: theme.text }]}>Histórico recente</Text>
            {assessments.slice(1, 5).map((item) => (
              <View key={item.id} style={[styles.historyRow, { borderColor: theme.border }]}>
                <Text style={[styles.historyDate, { color: theme.textSecondary }]}>
                  {formatDate(item.created_at)}
                </Text>
                <Text style={[styles.historyValues, { color: theme.text }]}>
                  {[
                    item.weight_kg != null ? `${item.weight_kg}kg` : null,
                    item.body_fat_pct != null ? `${item.body_fat_pct}% gordura` : null,
                  ]
                    .filter(Boolean)
                    .join(" • ") || "Medidas registradas"}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="Metas do aluno" subtitle="Objetivos e progresso" />
        <View style={styles.inlineForm}>
          <View style={{ flex: 1 }}>
            <TextField
              value={goalTitle}
              onChangeText={setGoalTitle}
              placeholder="Ex.: Perder 5kg, correr 5km..."
            />
          </View>
          <Pressable
            onPress={handleAddGoal}
            disabled={savingGoal || !goalTitle.trim()}
            style={[styles.addBtn, { backgroundColor: Brand.primary, opacity: savingGoal || !goalTitle.trim() ? 0.5 : 1 }]}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
        {goals.length === 0 ? (
          <Text style={[styles.meta, { color: theme.textSecondary }]}>Nenhuma meta definida ainda.</Text>
        ) : (
          goals.map((goal) => {
            const done = goal.status === 'done';
            const progress = goal.progress ?? (done ? 100 : 0);
            return (
              <View key={goal.id} style={[styles.goalRow, { borderColor: theme.border }]}>
                <Pressable onPress={() => toggleGoal(goal)} hitSlop={8}>
                  <Ionicons
                    name={done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={done ? Brand.success : theme.textSecondary}
                  />
                </Pressable>
                <View style={styles.goalBody}>
                  <View style={styles.goalTop}>
                    <Text
                      style={[
                        styles.goalTitle,
                        { color: theme.text },
                        done && { textDecorationLine: 'line-through', color: theme.textSecondary },
                      ]}>
                      {goal.title}
                    </Text>
                    <Text style={[styles.goalPct, { color: Brand.primary }]}>{progress}%</Text>
                  </View>
                  <ProgressBar value={progress / 100} />
                  <View style={styles.goalActions}>
                    <Pressable onPress={() => changeGoalProgress(goal, -10)} style={[styles.stepBtn, { borderColor: theme.border }]}>
                      <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>-10%</Text>
                    </Pressable>
                    <Pressable onPress={() => changeGoalProgress(goal, 10)} style={[styles.stepBtn, { borderColor: theme.border }]}>
                      <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>+10%</Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable onPress={() => removeGoal(goal.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
            );
          })
        )}
      </Card>

      <Card>
        <SectionHeader title="Engajamento" subtitle="Check-ins semanais e desafios" />
        <Text style={[styles.subLabel, { color: theme.textSecondary }]}>Check-ins recentes</Text>
        {recentCheckins.length === 0 ? (
          <Text style={[styles.meta, { color: theme.textSecondary }]}>Nenhum check-in ainda.</Text>
        ) : (
          recentCheckins.map((ci) => (
            <View key={ci.id} style={[styles.checkinRow, { borderColor: theme.border }]}>
              <Text style={[styles.checkinWeek, { color: theme.text }]}>
                Semana {formatDate(ci.week_start)}
              </Text>
              <View style={styles.checkinBadges}>
                <Badge label={`Motivação ${ci.motivation ?? '-'}/5`} tone="primary" />
                {ci.notes ? <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>{ci.notes}</Text> : null}
              </View>
            </View>
          ))
        )}
        <Text style={[styles.subLabel, { color: theme.textSecondary, marginTop: Spacing.two }]}>
          Desafios (últimos 7 dias)
        </Text>
        <View style={styles.challengeStats}>
          <Badge
            label={`${recentChallenges.filter((c) => c.completed).length} concluídos`}
            tone="success"
          />
          <Badge label={`${recentChallenges.length} registros`} tone="muted" />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Notas do personal" subtitle="Anotações privadas sobre o aluno" />
        <TextField
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Escreva uma observação..."
          multiline
        />
        <Button title="Adicionar nota" variant="secondary" onPress={handleAddNote} loading={savingNote} disabled={!noteText.trim()} />
        {notes.length === 0 ? (
          <Text style={[styles.meta, { color: theme.textSecondary }]}>Nenhuma nota registrada.</Text>
        ) : (
          notes.map((note) => (
            <View key={note.id} style={[styles.noteRow, { backgroundColor: theme.backgroundSelected }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.noteText, { color: theme.text }]}>{note.content}</Text>
                <Text style={[styles.noteDate, { color: theme.textSecondary }]}>{formatDate(note.created_at)}</Text>
              </View>
              <Pressable onPress={() => removeNote(note.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionHeader title="Acesso do aluno" subtitle={student.email ?? 'Aluno sem email cadastrado'} />
        <Text style={[styles.accessHint, { color: theme.textSecondary }]}>
          Envie um link para o aluno redefinir a senha ou reenviar o email de confirmação.
        </Text>
        <Button
          title="Enviar link de redefinição de senha"
          variant="secondary"
          onPress={handleResetPassword}
          loading={accessBusy === 'reset'}
          disabled={!student.email || accessBusy !== null}
        />
        <Button
          title="Reenviar confirmação de email"
          variant="secondary"
          onPress={handleResendConfirmation}
          loading={accessBusy === 'resend'}
          disabled={!student.email || accessBusy !== null}
        />
        {accessMessage ? (
          <Text
            style={[
              styles.accessMessage,
              { color: accessMessage.type === 'success' ? Brand.success : Brand.danger },
            ]}>
            {accessMessage.text}
          </Text>
        ) : null}
      </Card>

      <Button
        title="+ Novo treino para este aluno"
        onPress={() => router.push({ pathname: '/personal/novo-treino' as any, params: { student: student.id } })}
      />

      <SectionHeader title="Treinos" subtitle={`${workouts.length} no total`} />

      {actionError ? <Text style={[styles.errorText, { color: Brand.danger }]}>{actionError}</Text> : null}

      {workouts.length === 0 ? (
        <EmptyState icon="barbell-outline" title="Nenhum treino" message="Monte o primeiro treino deste aluno." />
      ) : (
        workouts.map((workout) => {
          const status = statusMeta[workout.status] ?? statusMeta.draft;
          return (
            <Card key={workout.id} style={styles.workoutCard}>
              <View style={[styles.workoutIcon, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="barbell" size={18} color={Brand.primary} />
              </View>
              <View style={styles.workoutInfo}>
                <Text style={[styles.workoutName, { color: theme.text }]}>{workout.name}</Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  Criado em {formatDate(workout.created_at)}
                  {workout.status === 'archived' ? ' • oculto para o aluno' : ''}
                </Text>
              </View>
              <Badge label={status.label} tone={status.tone} />
              {statusUpdatingId === workout.id ? (
                <ActivityIndicator size="small" color={Brand.primary} />
              ) : (
                <Pressable
                  onPress={() => handleToggleStatus(workout)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={workout.status === 'archived' ? `Reativar ${workout.name}` : `Arquivar ${workout.name}`}>
                  <Ionicons
                    name={workout.status === 'archived' ? 'arrow-undo-outline' : 'archive-outline'}
                    size={22}
                    color={Brand.primary}
                  />
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push({ pathname: '/personal/novo-treino' as any, params: { edit: workout.id } })}
                hitSlop={8}
                accessibilityLabel={`Editar ${workout.name}`}>
                <Ionicons name="create-outline" size={22} color={Brand.primary} />
              </Pressable>
            </Card>
          );
        })
      )}

      <SectionHeader title="Últimas sessões" subtitle={`${totalSessions} registrada(s)`} />

      {sessions.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Sem sessões"
          message="Quando o aluno concluir um treino, o registro aparecerá aqui."
        />
      ) : (
        sessions.map((session) => {
          const expanded = openSession === session.id;
          const date = new Date(session.performed_at);
          const exercises = [...(session.session_exercises ?? [])].sort((a, b) => a.order_index - b.order_index);

          return (
            <Card key={session.id} style={styles.sessionCard}>
              <Pressable
                onPress={() => setOpenSession(expanded ? null : session.id)}
                style={styles.sessionHeader}>
                <View style={[styles.dateBlock, { backgroundColor: theme.primarySoft }]}>
                  <Text style={[styles.dateDay, { color: Brand.primary }]}>
                    {String(date.getDate()).padStart(2, '0')}
                  </Text>
                  <Text style={[styles.dateMonth, { color: Brand.primary }]}>
                    {date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                  </Text>
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={[styles.sessionName, { color: theme.text }]}>
                    {session.workout?.name ?? 'Treino'}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textSecondary }]}>
                    {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {session.duration_seconds ? ` • ${formatDuration(session.duration_seconds)}` : ''}
                    {exercises.length > 0 ? ` • ${exercises.length} exercícios` : ''}
                  </Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
              </Pressable>

              {expanded ? (
                <View style={styles.sessionDetails}>
                  {exercises.length === 0 ? (
                    <Text style={[styles.meta, { color: theme.textSecondary }]}>
                      Sem detalhes de exercícios registrados.
                    </Text>
                  ) : (
                    exercises.map((exercise) => (
                      <View key={exercise.id} style={[styles.logRow, { backgroundColor: theme.backgroundSelected }]}>
                        <View style={styles.logInfo}>
                          <Text style={[styles.logName, { color: theme.text }]}>{exercise.name}</Text>
                          {exercise.completed ? (
                            <Text style={[styles.logStatus, { color: Brand.success }]}>Concluído</Text>
                          ) : null}
                        </View>
                        <View style={styles.logBadges}>
                          {exercise.sets_done != null ? <Badge label={`${exercise.sets_done} séries`} tone="muted" /> : null}
                          {exercise.reps_done ? <Badge label={`${exercise.reps_done} reps`} tone="muted" /> : null}
                          {exercise.weight_kg != null ? <Badge label={`${exercise.weight_kg} kg`} tone="primary" /> : null}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroTexts: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroMeta: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 13,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 4,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  heroPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  quickAction: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    padding: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  latestAssessment: {
    gap: Spacing.two,
  },
  assessmentStats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  assessmentStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  assessmentStatValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  assessmentStatLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  assessmentDate: {
    fontSize: 12,
  },
  assessmentForm: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  formCol: {
    flex: 1,
  },
  assessmentHistory: {
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  historyDate: {
    fontSize: 12,
  },
  historyValues: {
    fontSize: 12,
    fontWeight: '600',
  },
  anamnesisSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  anamnesisSection: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: Spacing.three,
  },
  answerRow: {
    gap: 2,
    paddingTop: Spacing.two,
  },
  answerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  answerValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  accessHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  accessMessage: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  workoutIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutInfo: {
    flex: 1,
    gap: 2,
  },
  workoutName: {
    fontSize: 15,
    fontWeight: '700',
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
    fontSize: 15,
    fontWeight: '700',
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
    fontSize: 13,
    fontWeight: '600',
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
  inlineForm: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  goalBody: {
    flex: 1,
    gap: 6,
  },
  goalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  goalTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  goalPct: {
    fontSize: 12,
    fontWeight: '800',
  },
  goalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepBtn: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  checkinRow: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  checkinWeek: {
    fontSize: 13,
    fontWeight: '700',
  },
  checkinBadges: {
    gap: 4,
  },
  challengeStats: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  noteDate: {
    fontSize: 11,
  },
});
