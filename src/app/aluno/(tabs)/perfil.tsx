import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PhotoHero } from '@/components/ui/photo-hero';
import { PasswordField } from '@/components/ui/password-field';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  disableReminder,
  enableReminder,
  getReminder,
  type ReminderConfig,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { AnamnesisAnswers } from '@/lib/invites';
import type { PhysicalAssessment, StudentGoal } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';

type Coach = { id: string; full_name: string | null; email: string | null };

type AnamnesisRow = { data: AnamnesisAnswers; created_at: string };

type NotifPrefs = {
  dailyReminder: boolean;
  workoutAvailable: boolean;
  waterReminder: boolean;
  nextMeal: boolean;
  weeklyCheckin: boolean;
  messages: boolean;
  goalProgress: boolean;
};

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  dailyReminder: false,
  workoutAvailable: true,
  waterReminder: false,
  nextMeal: false,
  weeklyCheckin: true,
  messages: true,
  goalProgress: true,
};

const NOTIF_KEY = '@evolvi/notif-prefs';

const TIME_OPTIONS = [
  { hour: 6, minute: 0, label: '06:00' },
  { hour: 7, minute: 0, label: '07:00' },
  { hour: 12, minute: 0, label: '12:00' },
  { hour: 18, minute: 0, label: '18:00' },
  { hour: 19, minute: 0, label: '19:00' },
  { hour: 20, minute: 0, label: '20:00' },
];

function ageFromBirthDate(value?: string | null) {
  if (!value) return null;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age > 0 && age < 130 ? age : null;
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionIcon, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name={icon} size={16} color={Brand.primary} />
      </View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
    </View>
  );
}

export default function StudentProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile, signOut, refreshProfile } = useAuth();

  const [coach, setCoach] = useState<Coach | null>(null);
  const [anamnesis, setAnamnesis] = useState<AnamnesisRow | null>(null);
  const [assessments, setAssessments] = useState<PhysicalAssessment[]>([]);
  const [goals, setGoals] = useState<StudentGoal[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [latestPayment, setLatestPayment] = useState<{ description: string; due_date: string } | null>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [reminder, setReminder] = useState<ReminderConfig>({ enabled: false, hour: 18, minute: 0 });
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadCoach = useCallback(async () => {
    if (!profile) return;

    const { data: link } = await supabase
      .from('coach_students')
      .select('coach_id, created_at')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (link?.coach_id) {
      setStartDate(link.created_at ?? null);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', link.coach_id)
        .maybeSingle();
      setCoach((data as Coach) ?? null);
    } else {
      setCoach(null);
    }

    // anamnesis
    const { data: an } = await supabase
      .from('anamnesis')
      .select('data, created_at')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setAnamnesis((an as AnamnesisRow | null) ?? null);

    // assessments
    const { data: as } = await supabase
      .from('physical_assessments')
      .select('*')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setAssessments((as as PhysicalAssessment[]) ?? []);

    // goals
    const { data: g } = await supabase
      .from('student_goals')
      .select('*')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false });
    setGoals((g as StudentGoal[]) ?? []);

    // latest payment due
    const { data: pd } = await supabase
      .from('payment_dues')
      .select('description, due_date')
      .eq('student_id', profile.id)
      .order('due_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatestPayment((pd as { description: string; due_date: string } | null) ?? null);

    // notif prefs
    const raw = await AsyncStorage.getItem(NOTIF_KEY);
    if (raw) {
      try {
        setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) });
      } catch {
        setNotifPrefs(DEFAULT_NOTIF_PREFS);
      }
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadCoach();
      getReminder().then(setReminder);
      setFullName(profile?.full_name ?? '');
      setPhone(profile?.phone ?? '');
      setBirthDate(profile?.birth_date ?? '');
    }, [loadCoach, profile]),
  );

  async function handleSaveProfile() {
    if (!profile) return;
    if (!fullName.trim()) {
      setProfileError('Informe seu nome.');
      setProfileMessage(null);
      return;
    }
    setProfileError(null);
    setProfileMessage(null);
    setSavingProfile(true);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        birth_date: birthDate.trim() || null,
      })
      .eq('id', profile.id);

    setSavingProfile(false);
    if (updateError) {
      setProfileError(updateError.message);
      return;
    }
    await refreshProfile();
    setProfileMessage('Dados atualizados!');
  }

  async function handleChangePassword() {
    if (!profile?.email) return;
    if (!currentPassword) {
      setPasswordError('Informe sua senha atual.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não conferem.');
      return;
    }
    setPasswordError(null);
    setPasswordMessage(null);
    setSavingPassword(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });
    if (authError) {
      setSavingPassword(false);
      setPasswordError('Senha atual incorreta.');
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (updateError) {
      setPasswordError(updateError.message);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage('Senha alterada com sucesso!');
  }

  async function handleToggleReminder(value: boolean) {
    if (value && Platform.OS === 'web') {
      setReminderMessage('Lembretes disponíveis apenas no app (Android/iOS).');
      return;
    }
    setSavingReminder(true);
    setReminderMessage(null);
    if (value) {
      const ok = await enableReminder(reminder.hour, reminder.minute);
      setSavingReminder(false);
      if (!ok) {
        setReminderMessage('Permissão de notificações negada. Ative nas configurações do sistema.');
        return;
      }
      setReminder((prev) => ({ ...prev, enabled: true }));
      setReminderMessage('Lembrete diário ativado!');
    } else {
      await disableReminder();
      setSavingReminder(false);
      setReminder((prev) => ({ ...prev, enabled: false }));
      setReminderMessage('Lembrete desativado.');
    }
  }

  async function handlePickTime(hour: number, minute: number) {
    setReminder((prev) => ({ ...prev, hour, minute }));
    setReminderMessage(null);
    if (!reminder.enabled) return;
    setSavingReminder(true);
    const ok = await enableReminder(hour, minute);
    setSavingReminder(false);
    setReminderMessage(ok ? 'Horário atualizado.' : 'Não foi possível atualizar o horário.');
  }

  async function updateNotifPref(key: keyof NotifPrefs, value: boolean) {
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    setSavingPrefs(true);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    setSavingPrefs(false);
  }

  async function handleExportData() {
    if (!profile) return;
    setExporting(true);
    try {
      const [
        { data: sessions },
        { data: assessmentsData },
        { data: goalsData },
        { data: notesData },
        { data: paymentsData },
        { data: mealsData },
        { data: feedbacksData },
        { data: messagesData },
        { data: notificationsData },
      ] = await Promise.all([
        supabase.from('workout_sessions').select('*, session_exercises(*)').eq('student_id', profile.id),
        supabase.from('physical_assessments').select('*').eq('student_id', profile.id),
        supabase.from('student_goals').select('*').eq('student_id', profile.id),
        supabase.from('coach_notes').select('*').eq('student_id', profile.id),
        supabase.from('payment_dues').select('*').eq('student_id', profile.id),
        supabase.from('meal_plans').select('*').eq('student_id', profile.id),
        supabase.from('student_feedback').select('*').eq('student_id', profile.id),
        supabase.from('messages').select('*').eq('student_id', profile.id),
        supabase.from('notifications').select('*').eq('user_id', profile.id),
      ]);

      const exportObj = {
        exported_at: new Date().toISOString(),
        profile,
        anamnesis: anamnesis?.data ?? null,
        sessions: sessions ?? [],
        assessments: assessmentsData ?? [],
        goals: goalsData ?? [],
        notes: notesData ?? [],
        payments: paymentsData ?? [],
        meal_plans: mealsData ?? [],
        feedbacks: feedbacksData ?? [],
        messages: messagesData ?? [],
        notifications: notificationsData ?? [],
      };

      const json = JSON.stringify(exportObj, null, 2);

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evolvi-dados-${profile.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: json, title: 'Meus dados Evolvi Fit' });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar os dados.');
    } finally {
      setExporting(false);
    }
  }

  async function handleRequestDeletion() {
    if (!profile) return;
    Alert.alert(
      'Excluir minha conta',
      'Tem certeza? Seus dados serão removidos permanentemente. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Solicitar exclusão',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            await supabase.from('student_feedback').insert({
              coach_id: (await getCoachId(profile.id)) ?? profile.id,
              student_id: profile.id,
              category: 'exclusao_conta',
              message: 'Solicitação de exclusão de conta e dados (LGPD).',
              status: 'open',
            });
            setDeleting(false);
            Alert.alert(
              'Solicitação enviada',
              'Seu personal e o administrador foram notificados. A exclusão será processada em até 15 dias.',
            );
          },
        },
      ],
    );
  }

  async function getCoachId(studentId: string) {
    const { data } = await supabase
      .from('coach_students')
      .select('coach_id')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle();
    return (data?.coach_id as string | undefined) ?? null;
  }

  async function handleGoogleConnect() {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) Alert.alert('Erro', error.message);
    } else {
      Alert.alert('Em breve', 'Login com Google estará disponível em breve.');
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  const age = ageFromBirthDate(profile?.birth_date);
  const activeGoals = goals.filter((g) => g.status === 'active').length;
  const doneGoals = goals.filter((g) => g.status === 'done').length;
  const latestAssessment = assessments[0] ?? null;
  const anamnesisDone = !!anamnesis;

  const notifToggle = (key: keyof NotifPrefs, label: string, desc?: string) => (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={[styles.toggleTitle, { color: theme.text }]}>{label}</Text>
        {desc ? <Text style={[styles.toggleHint, { color: theme.textSecondary }]}>{desc}</Text> : null}
      </View>
      <Switch
        value={notifPrefs[key]}
        onValueChange={(v) => updateNotifPref(key, v)}
        disabled={savingPrefs}
        trackColor={{ true: Brand.primaryDark, false: theme.backgroundSelected }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <Screen>
      <PhotoHero source={Images.student} height={240} imagePosition="top" glowColor={Brand.accent}>
        <View style={styles.heroRow}>
          <Avatar name={profile?.full_name} size={76} ring />
          <View style={styles.heroTexts}>
            <Text style={styles.heroName} numberOfLines={2}>
              {profile?.full_name ?? 'Aluno'}
            </Text>
            <Text style={styles.heroEmail} numberOfLines={1}>
              {profile?.email ?? ''}
            </Text>
            {age != null ? (
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>{age} anos</Text>
              </View>
            ) : null}
          </View>
        </View>
      </PhotoHero>

      {anamnesis?.data ? (
        <Card>
          <SectionTitle icon="flag-outline" title="Meu perfil" />
          <View style={styles.badgeRow}>
            {anamnesis.data.goal ? <Badge label={anamnesis.data.goal} tone="primary" /> : null}
            {anamnesis.data.experience ? <Badge label={anamnesis.data.experience} tone="muted" /> : null}
            {anamnesis.data.frequency ? <Badge label={anamnesis.data.frequency} tone="muted" /> : null}
            {anamnesis.data.location ? <Badge label={anamnesis.data.location} tone="muted" /> : null}
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionTitle icon="people-outline" title="Meu personal" />
        {coach ? (
          <>
            <View style={styles.coachRow}>
              <Avatar name={coach.full_name} size={44} />
              <View style={styles.coachInfo}>
                <Text style={[styles.coachName, { color: theme.text }]}>{coach.full_name ?? 'Personal'}</Text>
                <Text style={[styles.coachEmail, { color: theme.textSecondary }]}>{coach.email ?? ''}</Text>
              </View>
              <Badge label="Vinculado" tone="success" />
            </View>
          </>
        ) : (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Seu acesso é criado pelo seu personal. Peça ele para criar seu acesso no app.
          </Text>
        )}
      </Card>

      <Card>
        <SectionTitle icon="stats-chart-outline" title="Informações do acompanhamento" />
        <View style={styles.infoList}>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Plano</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {latestPayment?.description ?? 'Mensal'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Início</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {startDate ? formatDate(startDate) : '—'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Próxima avaliação</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {latestAssessment
                ? formatDate(
                    new Date(new Date(latestAssessment.created_at).getTime() + 30 * 86400000).toISOString(),
                  )
                : '—'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Anamnese</Text>
            <Text style={[styles.infoValue, { color: anamnesisDone ? Brand.success : theme.textSecondary }]}>
              {anamnesisDone ? 'Concluída' : 'Pendente'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Metas</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {activeGoals} ativa(s) • {doneGoals} concluída(s)
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionTitle icon="notifications-outline" title="Notificações" />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={[styles.switchTitle, { color: theme.text }]}>Avisos neste aparelho</Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              {reminder.enabled ? 'Ligados: os avisos chegam como notificação.' : 'Desligados.'}
            </Text>
          </View>
          <Switch
            value={reminder.enabled}
            onValueChange={handleToggleReminder}
            disabled={savingReminder}
            trackColor={{ true: Brand.primaryDark, false: theme.backgroundSelected }}
            thumbColor="#FFFFFF"
          />
        </View>

        <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Horário do lembrete diário</Text>
        <View style={styles.timeOptions}>
          {TIME_OPTIONS.map((option) => {
            const selected = reminder.hour === option.hour && reminder.minute === option.minute;
            return (
              <Pressable
                key={option.label}
                onPress={() => handlePickTime(option.hour, option.minute)}
                style={[
                  styles.timeChip,
                  {
                    borderColor: selected ? Brand.primaryDark : theme.backgroundSelected,
                    backgroundColor: selected ? Brand.primaryDark : 'transparent',
                  },
                ]}>
                <Text style={{ color: selected ? '#FFFFFF' : theme.text, fontWeight: '600', fontSize: 13 }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {reminderMessage ? <Text style={[styles.info, { color: theme.textSecondary }]}>{reminderMessage}</Text> : null}

        <View style={styles.divider} />

        {notifToggle('workoutAvailable', 'Treino disponível e horário do treino', 'Aviso quando um novo treino é publicado.')}
        {notifToggle('waterReminder', 'Lembretes para beber água')}
        {notifToggle('nextMeal', 'Próxima refeição')}
        {notifToggle('weeklyCheckin', 'Check-in e pesagem semanal')}
        {notifToggle('messages', 'Mensagens do personal')}
        {notifToggle('goalProgress', 'Meta diária quase concluída')}
      </Card>

      <Card>
        <SectionTitle icon="person-outline" title="Dados pessoais" />
        <TextField label="Nome completo" value={fullName} onChangeText={setFullName} placeholder="Seu nome" />
        <TextField
          label="Telefone"
          value={phone}
          onChangeText={setPhone}
          placeholder="(11) 99999-9999"
          keyboardType="phone-pad"
        />
        <TextField
          label="Data de nascimento"
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="AAAA-MM-DD"
        />
        {profileError ? <Text style={[styles.error, { color: Brand.danger }]}>{profileError}</Text> : null}
        {profileMessage ? <Text style={[styles.info, { color: Brand.success }]}>{profileMessage}</Text> : null}
        <Button title="Salvar dados" variant="secondary" onPress={handleSaveProfile} loading={savingProfile} />
      </Card>

      <Card>
        <SectionTitle icon="lock-closed-outline" title="Alterar senha" />
        <PasswordField label="Senha atual" value={currentPassword} onChangeText={setCurrentPassword} />
        <PasswordField label="Nova senha" value={newPassword} onChangeText={setNewPassword} />
        <PasswordField label="Confirmar nova senha" value={confirmPassword} onChangeText={setConfirmPassword} />
        {passwordError ? <Text style={[styles.error, { color: Brand.danger }]}>{passwordError}</Text> : null}
        {passwordMessage ? <Text style={[styles.info, { color: Brand.success }]}>{passwordMessage}</Text> : null}
        <Button title="Alterar senha" variant="secondary" onPress={handleChangePassword} loading={savingPassword} />
      </Card>

      <Card>
        <SectionTitle icon="logo-google" title="Conta Google" />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Conecte para entrar com um toque, sem senha.
        </Text>
        <Button title="Conectar conta Google" variant="secondary" onPress={handleGoogleConnect} />
      </Card>

      <Card>
        <SectionTitle icon="shield-checkmark-outline" title="Privacidade e dados (LGPD)" />
        <View style={styles.lgpdList}>
          <Pressable style={styles.lgpdItem} onPress={() => Alert.alert('Consentimentos', 'Seus consentimentos registrados estão armazenados no servidor. Para detalhes, exporte seus dados.')}>
            <Ionicons name="document-text-outline" size={18} color={Brand.primary} />
            <Text style={[styles.lgpdText, { color: theme.text }]}>Ver consentimentos registrados</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </Pressable>
          <Pressable style={styles.lgpdItem} onPress={handleExportData} disabled={exporting}>
            <Ionicons name="download-outline" size={18} color={Brand.primary} />
            <Text style={[styles.lgpdText, { color: theme.text }]}>
              {exporting ? 'Exportando...' : 'Exportar meus dados (JSON)'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </Pressable>
          <Pressable style={styles.lgpdItem} onPress={handleRequestDeletion} disabled={deleting}>
            <Ionicons name="trash-outline" size={18} color={Brand.danger} />
            <Text style={[styles.lgpdText, { color: Brand.danger }]}>
              {deleting ? 'Enviando...' : 'Excluir minha conta e dados'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
      </Card>

      <Button title="Sair da conta" onPress={handleSignOut} variant="danger" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  heroTexts: { flex: 1, gap: 4 },
  heroName: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  heroEmail: { color: 'rgba(255, 255, 255, 0.82)', fontSize: 13 },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    marginTop: 2,
  },
  roleText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.one },
  sectionIcon: { width: 30, height: 30, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 19 },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.two },
  coachInfo: { flex: 1, gap: 2 },
  coachName: { fontSize: 16, fontWeight: '600' },
  coachEmail: { fontSize: 13 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  infoList: { gap: Spacing.two },
  infoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  infoLabel: { fontSize: 13, fontWeight: '600' },
  infoValue: { fontSize: 14, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchText: { flex: 1, gap: 2 },
  switchTitle: { fontSize: 14, fontWeight: '600' },
  timeLabel: { fontSize: 13, fontWeight: '600', marginTop: Spacing.one },
  timeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  timeChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: Spacing.two },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 6 },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 14, fontWeight: '600' },
  toggleHint: { fontSize: 12, lineHeight: 17 },
  error: { fontSize: 13, fontWeight: '600' },
  info: { fontSize: 13, fontWeight: '600' },
  lgpdList: { gap: Spacing.one },
  lgpdItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  lgpdText: { flex: 1, fontSize: 14, fontWeight: '600' },
});
