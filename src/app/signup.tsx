import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/ui/auth-shell';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function SignUpScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { signUp, session } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session, router]);

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
    const result = await signUp({ email, password, fullName, role: 'personal' });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.needsConfirmation) {
      setInfo('Conta criada! Confirme seu email para entrar.');
    }
  }

  return (
    <AuthShell
      eyebrow="COMECE AGORA"
      title="Crie sua"
      highlight="conta."
      subtitle="Conta de personal trainer. Você cria o acesso dos seus alunos depois."
      footer={
        <View style={styles.footer}>
          <Pressable onPress={() => router.replace('/login')}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Já tem conta? <Text style={{ color: Brand.primary }}>Entrar</Text>
            </Text>
          </Pressable>
        </View>
      }>
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

      {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}
      {info ? <Text style={[styles.info, { color: Brand.success }]}>{info}</Text> : null}

      <Button title="Criar conta" onPress={handleSignUp} loading={loading} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  info: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  footerText: {
    fontSize: 14,
  },
});
