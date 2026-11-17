import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/ui/auth-shell';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isAiSignupEnabled, signUpAutonomous } from '@/lib/ai';
import { useAuth } from '@/providers/auth-provider';

export default function SignUpAutonomoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session, router]);

  useEffect(() => {
    let active = true;
    isAiSignupEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSignUp() {
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError('Preencha nome, email e uma senha com pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setError(null);
    setInfo(null);
    setLoading(true);
    const result = await signUpAutonomous(email, password, fullName);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.needsConfirmation) {
      setInfo('Conta criada! Confirme seu email para preencher a anamnese e gerar seu treino.');
      return;
    }

    router.replace('/anamnese-ai' as never);
  }

  return (
    <AuthShell
      eyebrow="TREINO COM IA"
      title="Treine do seu"
      highlight="jeito."
      subtitle="Cadastro direto para alunos autônomos. Responda a anamnese e receba um treino feito para você."
      footer={
        <View style={styles.footer}>
          <Pressable onPress={() => router.replace('/login')}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Já tem conta? <Text style={{ color: Brand.primary }}>Entrar</Text>
            </Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/signup')}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              É personal trainer? <Text style={{ color: Brand.primary }}>Criar conta</Text>
            </Text>
          </Pressable>
        </View>
      }>
      {enabled === false ? (
        <View
          style={[styles.warning, { backgroundColor: theme.dangerSoft, borderColor: Brand.danger }]}>
          <Text style={[styles.warningTitle, { color: Brand.danger }]}>
            Cadastro autônomo indisponível
          </Text>
          <Text style={[styles.warningText, { color: theme.textSecondary }]}>
            Ative o módulo de IA e execute o script supabase/upgrade_ai_autonomo.sql no Admin Master.
          </Text>
        </View>
      ) : null}

      <TextField
        label="Nome completo"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Seu nome"
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="voce@email.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <PasswordField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo de 6 caracteres"
      />
      <PasswordField
        label="Confirmar senha"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Repita a senha"
      />

      {error ? <Text style={[styles.message, { color: Brand.danger }]}>{error}</Text> : null}
      {info ? <Text style={[styles.message, { color: Brand.success }]}>{info}</Text> : null}

      <Button
        title="Criar conta autônoma"
        onPress={handleSignUp}
        loading={loading}
        disabled={enabled === false}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  warning: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.two,
    gap: 4,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  warningText: {
    fontSize: 12,
    lineHeight: 17,
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  footerText: {
    fontSize: 13,
  },
});
