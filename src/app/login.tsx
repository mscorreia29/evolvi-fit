import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/ui/auth-shell';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { signIn, session } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session, router]);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Informe email e senha.');
      return;
    }

    setError(null);
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <AuthShell
      eyebrow="ACESSO"
      title="Entrar na sua"
      highlight="conta"
      subtitle="Acompanhe alunos, treinos e resultados em um só lugar."
      footer={
        <View style={styles.footer}>
          <Pressable onPress={() => router.push('/signup')}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              É personal trainer?{' '}
              <Text style={{ color: Brand.primary, fontWeight: '700' }}>Criar conta</Text>
            </Text>
          </Pressable>
          <Text style={[styles.studentHint, { color: theme.textSecondary }]}>
            É aluno? Peça ao seu personal para enviar o convite de acesso.
          </Text>
        </View>
      }>
      {!isSupabaseConfigured ? (
        <View
          style={[
            styles.warning,
            { backgroundColor: theme.dangerSoft, borderColor: Brand.danger },
          ]}>
          <Text style={[styles.warningTitle, { color: Brand.danger }]}>
            Supabase não configurado
          </Text>
          <Text style={[styles.warningText, { color: theme.textSecondary }]}>
            Preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env e
            execute o script supabase/schema.sql no seu projeto.
          </Text>
        </View>
      ) : null}

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
        placeholder="Sua senha"
      />

      <Pressable onPress={() => router.push('/forgot-password')} style={styles.forgot}>
        <Text style={[styles.forgotText, { color: Brand.primary }]}>Esqueci minha senha</Text>
      </Pressable>

      {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}

      <Button title="Entrar" onPress={handleLogin} loading={loading} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  warning: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  warningText: {
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  forgot: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  footerText: {
    fontSize: 14,
  },
  studentHint: {
    fontSize: 12,
    textAlign: 'center',
  },
});
