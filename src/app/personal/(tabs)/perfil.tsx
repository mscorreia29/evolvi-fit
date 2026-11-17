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

type InstallPlatform = 'ios' | 'android';
type IllustrationKind =
  | 'ios-share'
  | 'ios-sheet'
  | 'ios-home'
  | 'android-menu'
  | 'android-install'
  | 'android-allow'
  | 'android-settings';

function MockBrowser({ right, children }: { right?: ReactNode; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.mockWindow, { borderColor: theme.border, backgroundColor: theme.backgroundSelected }]}>
      <View style={styles.mockBrowserBar}>
        <View style={styles.mockDots}>
          <View style={[styles.mockDot, { backgroundColor: Brand.danger }]} />
          <View style={[styles.mockDot, { backgroundColor: Brand.warning }]} />
          <View style={[styles.mockDot, { backgroundColor: Brand.success }]} />
        </View>
        <View style={[styles.mockUrl, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.mockUrlText, { color: theme.textSecondary }]}>evolvi-fit.vercel.app</Text>
        </View>
        <View style={styles.mockBarRight}>{right}</View>
      </View>
      <View style={styles.mockBrowserBody}>{children}</View>
    </View>
  );
}

function GuideIllustration({ kind }: { kind: IllustrationKind }) {
  const theme = useTheme();

  if (kind === 'ios-share') {
    return (
      <MockBrowser
        right={
          <View style={[styles.mockHighlight, { borderColor: Brand.primary }]}>
            <Ionicons name="share-outline" size={15} color={Brand.primary} />
          </View>
        }>
        <View style={styles.mockCenterRow}>
          <Text style={[styles.mockHint, { color: theme.textSecondary }]}>Toque no ícone de compartilhar acima</Text>
        </View>
      </MockBrowser>
    );
  }

  if (kind === 'ios-sheet') {
    return (
      <View style={[styles.mockSheet, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={[styles.mockSheetHandle, { backgroundColor: theme.border }]} />
        <View style={styles.mockSheetRow}>
          <Ionicons name="share-outline" size={15} color={theme.textSecondary} />
          <Text style={[styles.mockSheetText, { color: theme.textSecondary }]}>Compartilhar</Text>
        </View>
        <View style={[styles.mockSheetRow, styles.mockSheetRowActive, { backgroundColor: theme.primarySoft, borderColor: Brand.primary }]}>
          <Ionicons name="add-circle-outline" size={15} color={Brand.primary} />
          <Text style={[styles.mockSheetText, { color: Brand.primary }]}>Adicionar à Tela de Início</Text>
        </View>
        <View style={styles.mockSheetRow}>
          <Ionicons name="copy-outline" size={15} color={theme.textSecondary} />
          <Text style={[styles.mockSheetText, { color: theme.textSecondary }]}>Copiar link</Text>
        </View>
      </View>
    );
  }

  if (kind === 'ios-home') {
    return (
      <View style={[styles.mockHome, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
        <View style={[styles.mockAppIcon, { backgroundColor: Brand.primary }]}>
          <Ionicons name="apps-outline" size={22} color="#FFFFFF" />
        </View>
        <Text style={[styles.mockHomeLabel, { color: theme.text }]}>Evolvi Fit</Text>
        <View style={[styles.mockCheck, { borderColor: Brand.primary }]}>
          <Ionicons name="checkmark-outline" size={14} color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (kind === 'android-menu') {
    return (
      <MockBrowser
        right={
          <View style={[styles.mockHighlight, { borderColor: Brand.primary }]}>
            <Ionicons name="ellipsis-vertical" size={15} color={Brand.primary} />
          </View>
        }>
        <View style={styles.mockCenterRow}>
          <Text style={[styles.mockHint, { color: theme.textSecondary }]}>Toque nos três pontos acima</Text>
        </View>
      </MockBrowser>
    );
  }

  if (kind === 'android-install') {
    return (
      <View style={[styles.mockMenu, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.mockMenuRow}>
          <Ionicons name="share-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.mockMenuText, { color: theme.textSecondary }]}>Compartilhar</Text>
        </View>
        <View style={[styles.mockMenuRow, styles.mockMenuRowActive, { backgroundColor: theme.primarySoft, borderColor: Brand.primary }]}>
          <Ionicons name="download-outline" size={14} color={Brand.primary} />
          <Text style={[styles.mockMenuText, { color: Brand.primary }]}>Instalar app</Text>
        </View>
        <View style={styles.mockMenuRow}>
          <Ionicons name="add-circle-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.mockMenuText, { color: theme.textSecondary }]}>Adicionar à tela inicial</Text>
        </View>
      </View>
    );
  }

  if (kind === 'android-allow') {
    return (
      <View style={[styles.mockDialog, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Ionicons name="notifications-outline" size={20} color={Brand.primary} />
        <Text style={[styles.mockDialogTitle, { color: theme.text }]}>Permitir notificações?</Text>
        <Text style={[styles.mockDialogText, { color: theme.textSecondary }]}>Avisos de treinos, mensagens e feedbacks.</Text>
        <View style={styles.mockDialogActions}>
          <View style={[styles.mockDialogGhost, { borderColor: theme.border }]}>
            <Text style={[styles.mockDialogButtonText, { color: theme.textSecondary }]}>Não permitir</Text>
          </View>
          <View style={[styles.mockDialogPrimary, { backgroundColor: Brand.primary }]}>
            <Text style={[styles.mockDialogButtonText, { color: '#FFFFFF' }]}>Permitir</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.mockSettings, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.mockSettingsRow}>
        <Ionicons name="notifications-outline" size={15} color={Brand.primary} />
        <Text style={[styles.mockSettingsText, { color: theme.text }]}>Notificações</Text>
        <View style={[styles.mockToggle, { backgroundColor: Brand.primary }]}>
          <View style={styles.mockToggleKnob} />
        </View>
      </View>
      <View style={styles.mockSettingsRow}>
        <Ionicons name="globe-outline" size={15} color={theme.textSecondary} />
        <Text style={[styles.mockSettingsText, { color: theme.textSecondary }]}>evolvi-fit.vercel.app</Text>
        <Text style={[styles.mockSettingsValue, { color: Brand.success }]}>Permitido</Text>
      </View>
    </View>
  );
}

function InstallStep({
  number,
  title,
  description,
  illustration,
}: {
  number: number;
  title: string;
  description: string;
  illustration: IllustrationKind;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.installStepCard, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
      <View style={styles.installStepHeader}>
        <View style={[styles.installStepNumber, { backgroundColor: Brand.primary }]}>
          <Text style={styles.installStepNumberText}>{number}</Text>
        </View>
        <View style={styles.installStepTexts}>
          <Text style={[styles.installStepTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.installStepDescription, { color: theme.textSecondary }]}>{description}</Text>
        </View>
      </View>
      <GuideIllustration kind={illustration} />
    </View>
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

  const [installOpen, setInstallOpen] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<InstallPlatform>('android');

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

      <Card>
        <SectionTitle icon="download-outline" title="Instalar o app" />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Abra o guia e siga as telas destacadas para colocar o Evolvi Fit na tela inicial.
        </Text>
        <Button
          title={installOpen ? 'Ocultar guia' : 'Ver passo a passo'}
          variant="secondary"
          onPress={() => setInstallOpen((open) => !open)}
        />

        {installOpen ? (
          <View style={styles.installGuide}>
            <View style={[styles.platformTabs, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
              <Pressable
                onPress={() => setInstallPlatform('ios')}
                style={[styles.platformTab, installPlatform === 'ios' ? { backgroundColor: Brand.primary } : null]}>
                <Text style={[styles.platformTabText, { color: installPlatform === 'ios' ? '#FFFFFF' : theme.textSecondary }]}>
                  iPhone
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setInstallPlatform('android')}
                style={[styles.platformTab, installPlatform === 'android' ? { backgroundColor: Brand.primary } : null]}>
                <Text style={[styles.platformTabText, { color: installPlatform === 'android' ? '#FFFFFF' : theme.textSecondary }]}>
                  Android
                </Text>
              </Pressable>
            </View>

            {installPlatform === 'ios' ? (
              <View style={styles.installSteps}>
                <InstallStep
                  number={1}
                  title="Abra no Safari"
                  description="Entre no site pelo Safari e toque no ícone de compartilhar no topo."
                  illustration="ios-share"
                />
                <InstallStep
                  number={2}
                  title="Adicionar à tela inicial"
                  description="Na lista que abre, escolha Adicionar à Tela de Início."
                  illustration="ios-sheet"
                />
                <InstallStep
                  number={3}
                  title="Confirmar"
                  description="Toque em Adicionar. O app aparece na tela inicial."
                  illustration="ios-home"
                />
              </View>
            ) : (
              <View style={styles.installSteps}>
                <InstallStep
                  number={1}
                  title="Abra no Chrome"
                  description="Entre no site pelo Chrome e toque no menu de três pontos."
                  illustration="android-menu"
                />
                <InstallStep
                  number={2}
                  title="Instalar o app"
                  description="Escolha Instalar app e confirme a instalação."
                  illustration="android-install"
                />
                <InstallStep
                  number={3}
                  title="Permitir notificações"
                  description="Ao abrir o app, toque em Permitir para receber avisos."
                  illustration="android-allow"
                />
                <InstallStep
                  number={4}
                  title="Se não aparecer o pedido"
                  description="Ative Notificações em Informações do app ou permita o site no Chrome."
                  illustration="android-settings"
                />
              </View>
            )}

            <Text style={[styles.installFooter, { color: theme.textSecondary }]}>
              Depois de instalar, abra o app pelo ícone na tela inicial.
            </Text>
          </View>
        ) : null}
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
  installGuide: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  platformTabs: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  platformTab: {
    flex: 1,
    borderRadius: Radius.full,
    paddingVertical: 7,
    alignItems: 'center',
  },
  platformTabText: {
    fontSize: 12,
    fontWeight: '800',
  },
  installSteps: {
    gap: Spacing.two,
  },
  installStepCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  installStepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  installStepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  installStepNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  installStepTexts: {
    flex: 1,
    gap: 2,
  },
  installStepTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  installStepDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  installFooter: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  mockWindow: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  mockBrowserBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  mockDots: {
    flexDirection: 'row',
    gap: 3,
  },
  mockDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  mockUrl: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  mockUrlText: {
    fontSize: 8,
  },
  mockBarRight: {
    width: 22,
    alignItems: 'center',
  },
  mockHighlight: {
    borderWidth: 2,
    borderRadius: 9,
    padding: 2,
  },
  mockBrowserBody: {
    minHeight: 54,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockCenterRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockHint: {
    fontSize: 10,
    textAlign: 'center',
  },
  mockSheet: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 8,
    gap: 6,
  },
  mockSheetHandle: {
    width: 28,
    height: 3,
    borderRadius: 2,
    alignSelf: 'center',
  },
  mockSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mockSheetRowActive: {
    borderWidth: 1,
  },
  mockSheetText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mockHome: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  mockAppIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockHomeLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  mockCheck: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 2,
  },
  mockMenu: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 8,
    gap: 4,
  },
  mockMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mockMenuRowActive: {
    borderWidth: 1,
  },
  mockMenuText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mockDialog: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 12,
    alignItems: 'center',
    gap: 5,
  },
  mockDialogTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  mockDialogText: {
    fontSize: 10,
    textAlign: 'center',
  },
  mockDialogActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  mockDialogGhost: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  mockDialogPrimary: {
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  mockDialogButtonText: {
    fontSize: 10,
    fontWeight: '800',
  },
  mockSettings: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: 10,
    gap: 8,
  },
  mockSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mockSettingsText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
  },
  mockSettingsValue: {
    fontSize: 10,
    fontWeight: '800',
  },
  mockToggle: {
    width: 26,
    height: 15,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  mockToggleKnob: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-end',
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

