import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { fetchCoachSettings, upsertCoachSettings } from '@/lib/engagement';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

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

function Message({ children, tone }: { children: ReactNode; tone: 'error' | 'success' }) {
  return (
    <Text style={[styles.message, { color: tone === 'error' ? Brand.danger : Brand.success }]}>
      {children}
    </Text>
  );
}

export default function PersonalProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile, signOut, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [feedbackInterval, setFeedbackInterval] = useState('14');
  const [paymentReminderDays, setPaymentReminderDays] = useState('3');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!profile) return;
    const { settings } = await fetchCoachSettings(profile.id);
    if (settings) {
      setFeedbackInterval(String(settings.feedback_interval_days));
      setPaymentReminderDays(String(settings.payment_reminder_days_before));
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings]),
  );

  async function handleSaveSettings() {
    if (!profile) return;
    const feedback = parseInt(feedbackInterval, 10);
    const payment = parseInt(paymentReminderDays, 10);
    if (!Number.isFinite(feedback) || feedback < 1 || feedback > 90) {
      setSettingsError('Intervalo de feedback deve ser entre 1 e 90 dias.');
      return;
    }
    if (!Number.isFinite(payment) || payment < 0 || payment > 30) {
      setSettingsError('Lembrete de pagamento deve ser entre 0 e 30 dias.');
      return;
    }
    setSettingsError(null);
    setSettingsMessage(null);
    setSavingSettings(true);
    const { error } = await upsertCoachSettings(profile.id, {
      feedback_interval_days: feedback,
      payment_reminder_days_before: payment,
    });
    setSavingSettings(false);
    if (error) {
      setSettingsError('Não foi possível salvar. Execute o SQL de engajamento no Supabase.');
      return;
    }
    setSettingsMessage('Configurações salvas.');
  }

  async function handleSaveProfile() {
    if (!profile) return;

    if (!fullName.trim()) {
      setProfileError('Informe seu nome.');
      setProfileMessage(null);
      return;
    }

    setProfileMessage(null);
    setProfileError(null);
    setSavingProfile(true);

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq('id', profile.id);

    setSavingProfile(false);

    if (error) {
      setProfileError(error.message);
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

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setSavingPassword(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage('Senha alterada com sucesso!');
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <Screen>
      <PhotoHero source={Images.coach} height={240} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Avatar name={profile?.full_name} size={76} ring />
          <View style={styles.heroTexts}>
            <Text style={styles.heroName} numberOfLines={2}>
              {profile?.full_name ?? 'Personal'}
            </Text>
            <Text style={styles.heroEmail} numberOfLines={1}>
              {profile?.email ?? ''}
            </Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>PERSONAL TRAINER</Text>
            </View>
          </View>
        </View>
      </PhotoHero>

      <Card>
        <SectionTitle icon="flash-outline" title="Ações rápidas" />
        <View style={styles.quickGrid}>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/personal/mensagens' as never)}>
            <Ionicons name="chatbubbles-outline" size={20} color={Brand.primary} />
            <Text style={[styles.quickText, { color: theme.text }]}>Mensagens</Text>
          </Pressable>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/personal/feedbacks' as never)}>
            <Ionicons name="chatbox-ellipses-outline" size={20} color={Brand.primary} />
            <Text style={[styles.quickText, { color: theme.text }]}>Feedbacks</Text>
          </Pressable>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/personal/financeiro' as never)}>
            <Ionicons name="card-outline" size={20} color={Brand.primary} />
            <Text style={[styles.quickText, { color: theme.text }]}>Financeiro</Text>
          </Pressable>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/personal/convites' as never)}>
            <Ionicons name="mail-outline" size={20} color={Brand.primary} />
            <Text style={[styles.quickText, { color: theme.text }]}>Convites</Text>
          </Pressable>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/personal/novo-treino' as never)}>
            <Ionicons name="barbell-outline" size={20} color={Brand.primary} />
            <Text style={[styles.quickText, { color: theme.text }]}>Novo treino</Text>
          </Pressable>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/personal/alunos')}>
            <Ionicons name="people-outline" size={20} color={Brand.primary} />
            <Text style={[styles.quickText, { color: theme.text }]}>Meus alunos</Text>
          </Pressable>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/personal/ajuda' as never)}>
            <Ionicons name="help-circle-outline" size={20} color={Brand.primary} />
            <Text style={[styles.quickText, { color: theme.text }]}>Ajuda</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <SectionTitle icon="settings-outline" title="Engajamento" />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Configure intervalos para acompanhar feedbacks e cobranças dos alunos.
        </Text>
        <TextField
          label="Intervalo de feedback (dias)"
          value={feedbackInterval}
          onChangeText={setFeedbackInterval}
          keyboardType="number-pad"
        />
        <TextField
          label="Lembrete de pagamento (dias antes)"
          value={paymentReminderDays}
          onChangeText={setPaymentReminderDays}
          keyboardType="number-pad"
        />
        {settingsError ? <Message tone="error">{settingsError}</Message> : null}
        {settingsMessage ? <Message tone="success">{settingsMessage}</Message> : null}
        <Button title="Salvar configurações" variant="secondary" onPress={handleSaveSettings} loading={savingSettings} />
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
        {profileError ? <Message tone="error">{profileError}</Message> : null}
        {profileMessage ? <Message tone="success">{profileMessage}</Message> : null}
        <Button title="Salvar dados" variant="secondary" onPress={handleSaveProfile} loading={savingProfile} />
      </Card>

      <Card>
        <SectionTitle icon="lock-closed-outline" title="Alterar senha" />
        <PasswordField label="Senha atual" value={currentPassword} onChangeText={setCurrentPassword} />
        <PasswordField label="Nova senha" value={newPassword} onChangeText={setNewPassword} />
        <PasswordField label="Confirmar nova senha" value={confirmPassword} onChangeText={setConfirmPassword} />
        {passwordError ? <Message tone="error">{passwordError}</Message> : null}
        {passwordMessage ? <Message tone="success">{passwordMessage}</Message> : null}
        <Button title="Alterar senha" variant="secondary" onPress={handleChangePassword} loading={savingPassword} />
      </Card>

      <Badge label="Conta segura e sincronizada" tone="muted" style={styles.footerBadge} />
      <Button title="Sair da conta" onPress={handleSignOut} variant="danger" />
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
    gap: 4,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroEmail: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 13,
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    marginTop: 2,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerBadge: {
    alignSelf: 'center',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  quickItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  quickText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

