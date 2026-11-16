import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

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
import { useAuth } from '@/providers/auth-provider';

type Coach = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const TIME_OPTIONS = [
  { hour: 6, minute: 0, label: '06:00' },
  { hour: 7, minute: 0, label: '07:00' },
  { hour: 12, minute: 0, label: '12:00' },
  { hour: 18, minute: 0, label: '18:00' },
  { hour: 19, minute: 0, label: '19:00' },
  { hour: 20, minute: 0, label: '20:00' },
];

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

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [reminder, setReminder] = useState<ReminderConfig>({
    enabled: false,
    hour: 18,
    minute: 0,
  });
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);

  const loadCoach = useCallback(async () => {
    if (!profile) return;

    const { data: link } = await supabase
      .from('coach_students')
      .select('coach_id')
      .eq('student_id', profile.id)
      .maybeSingle();

    if (!link) {
      setCoach(null);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', link.coach_id)
      .maybeSingle();

    setCoach((data as Coach) ?? null);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadCoach();
      getReminder().then(setReminder);
      setFullName(profile?.full_name ?? '');
      setPhone(profile?.phone ?? '');
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
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
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

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

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
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>ALUNO</Text>
            </View>
          </View>
        </View>
      </PhotoHero>

      <Card>
        <SectionTitle icon="people-outline" title="Meu personal" />
        {coach ? (
          <>
            <View style={styles.coachRow}>
              <Avatar name={coach.full_name} size={44} />
              <View style={styles.coachInfo}>
                <Text style={[styles.coachName, { color: theme.text }]}>
                  {coach.full_name ?? 'Personal'}
                </Text>
                <Text style={[styles.coachEmail, { color: theme.textSecondary }]}>
                  {coach.email ?? ''}
                </Text>
              </View>
              <Badge label="Vinculado" tone="success" />
            </View>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Seu acesso é criado pelo seu personal. Em caso dúvidas, fale com ele.
            </Text>
          </>
        ) : (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Seu acesso é criado pelo seu personal. Peça ele para criar seu acesso no app.
          </Text>
        )}
      </Card>

      <Card>
        <SectionTitle icon="notifications-outline" title="Lembretes de treino" />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={[styles.switchTitle, { color: theme.text }]}>Lembrete diário</Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Receba um aviso todos os dias no horário escolhido.
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

        <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Horário</Text>
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
                <Text
                  style={{
                    color: selected ? '#FFFFFF' : theme.text,
                    fontWeight: '600',
                    fontSize: 13,
                  }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {reminderMessage ? <Text style={[styles.info, { color: theme.textSecondary }]}>{reminderMessage}</Text> : null}
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

      <Card style={styles.tipCard}>
        <Ionicons name="information-circle-outline" size={20} color={Brand.primary} />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Os lembretes usam notificações locais do seu aparelho. Nenhum dado é enviado para fora.
        </Text>
      </Card>

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
  hint: {
    fontSize: 13,
    lineHeight: 19,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  coachInfo: {
    flex: 1,
    gap: 2,
  },
  coachName: {
    fontSize: 16,
    fontWeight: '600',
  },
  coachEmail: {
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: Spacing.one,
  },
  timeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  timeChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  info: {
    fontSize: 13,
    fontWeight: '600',
  },
});
