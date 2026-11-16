import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Hero } from '@/components/ui/hero';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Brand, Gradients, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  createStudentInvite,
  dateInputToISO,
  maskDateInput,
  type CreatedInvite,
} from '@/lib/invites';
import { useAuth } from '@/providers/auth-provider';

type SentInvite = CreatedInvite & {
  email: string;
  birthDate: string;
};

function formatExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR');
}

export default function NewStudentScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();

  const [email, setEmail] = useState('');
  const [birthInput, setBirthInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState<SentInvite | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!profile) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Informe um email válido.');
      return;
    }

    const birthDate = dateInputToISO(birthInput);

    if (!birthDate) {
      setError('Informe a data de nascimento no formato DD/MM/AAAA.');
      return;
    }

    const parsed = new Date(`${birthDate}T00:00:00`);
    if (parsed.getTime() > Date.now()) {
      setError('A data de nascimento não pode estar no futuro.');
      return;
    }

    setError(null);
    setSaving(true);

    const result = await createStudentInvite({
      coachId: profile.id,
      email: normalizedEmail,
      birthDate,
    });

    setSaving(false);

    if (result.error || !result.invite) {
      setError(result.error ?? 'Não foi possível gerar o convite.');
      return;
    }

    setSent({ ...result.invite, email: normalizedEmail, birthDate });
  }

  async function handleShare() {
    if (!sent) return;

    await Share.share({
      message: [
        `Olá! Seu acesso ao Evolvi Fit está pronto.`,
        ``,
        `Abra o link para criar sua senha e responder sua anamnese:`,
        sent.url,
      ].join('\n'),
      url: sent.url,
    });
  }

  async function handleCopy() {
    if (!sent) return;

    const clipboard = (
      globalThis as {
        navigator?: { clipboard?: { writeText: (text: string) => Promise<void> } };
      }
    ).navigator?.clipboard;

    if (!clipboard) {
      setError('Copie o link manualmente selecionando o texto abaixo.');
      return;
    }

    await clipboard.writeText(sent.url);
    setError(null);
    setCopied(true);
  }

  function handleCreateAnother() {
    setSent(null);
    setEmail('');
    setBirthInput('');
    setError(null);
    setCopied(false);
  }

  if (sent) {
    const expiry = formatExpiry(sent.expiresAt);

    return (
      <Screen key="success">
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={[
              styles.backButton,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>Convite pronto</Text>
        </View>

        <Hero colors={Gradients.success} contentStyle={styles.heroContent}>
          <View style={styles.successIcon}>
            <Ionicons name="paper-plane" size={28} color="#FFFFFF" />
          </View>
          <Text style={[styles.heroTitle, styles.centerText]}>Agora é só enviar o link</Text>
          <Text style={[styles.heroSubtitle, styles.centerText]}>
            {sent.email} abre o convite, cria a própria senha e responde a anamnese antes de
            entrar.
          </Text>
        </Hero>

        <Card>
          <View style={styles.credentialHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Link do convite</Text>
            <Badge label="Aguardando aluno" tone="warning" />
          </View>

          <View
            style={[
              styles.linkBox,
              { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
            ]}>
            <Text selectable style={[styles.linkText, { color: theme.text }]}>
              {sent.url}
            </Text>
          </View>

          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            {expiry
              ? `Este link pode ser usado uma única vez e expira em ${expiry}.`
              : 'Este link pode ser usado uma única vez.'}
          </Text>

          {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}

          {Platform.OS === 'web' ? (
            <Button title={copied ? 'Link copiado' : 'Copiar link'} onPress={handleCopy} />
          ) : (
            <Button title="Compartilhar convite" onPress={handleShare} />
          )}
          <Button title="Criar outro convite" variant="secondary" onPress={handleCreateAnother} />
          <Button
            title="Voltar para a lista"
            variant="ghost"
            onPress={() => router.back()}
          />
        </Card>

        <Card style={styles.tipCard}>
          <Ionicons name="information-circle-outline" size={20} color={Brand.primary} />
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            O aluno só aparece na sua lista depois de aceitar o convite. Se ele já tiver conta no
            app, pode entrar com a senha atual usando o mesmo link.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen key="form">
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={[
            styles.backButton,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Novo aluno</Text>
      </View>

      <Hero contentStyle={styles.heroContent}>
        <View style={styles.heroRow}>
          <View style={styles.heroTexts}>
            <Text style={styles.heroLabel}>CONVITE DE ALUNO</Text>
            <Text style={styles.heroTitle}>Cadastre só o essencial</Text>
            <Text style={styles.heroSubtitle}>
              Informe email e data de nascimento. O aluno recebe o link, cria a senha e responde
              a anamnese.
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="link" size={26} color="#FFFFFF" />
          </View>
        </View>
      </Hero>

      <Card>
        <TextField
          label="Email do aluno"
          value={email}
          onChangeText={setEmail}
          placeholder="aluno@email.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <TextField
          label="Data de nascimento"
          value={birthInput}
          onChangeText={(value) => setBirthInput(maskDateInput(value))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
        />

        {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}

        <Button
          title="Gerar link de convite"
          onPress={handleCreate}
          loading={saving}
          disabled={!profile}
        />
      </Card>

      <Card style={styles.tipCard}>
        <Ionicons name="information-circle-outline" size={20} color={Brand.primary} />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Você não precisa criar senha nem confirmar email. O convite fica válido por 14 dias e
          vincula o aluno automaticamente quando ele concluir o onboarding.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroContent: {
    gap: Spacing.two,
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
  heroLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 19,
  },
  centerText: {
    textAlign: 'center',
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
  },
  credentialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  linkBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.three,
  },
  linkText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});

