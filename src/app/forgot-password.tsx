import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/ui/auth-shell';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      setError('Informe seu email.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Supabase não configurado.');
      return;
    }

    setError(null);
    setInfo(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('/reset-password'),
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setInfo(
      'Se existir uma conta com esse email, enviamos um link para redefinir a senha. Confira sua caixa de entrada e o spam.',
    );
  }

  return (
    <AuthShell
      eyebrow="RECUPERAR ACESSO"
      title="Esqueceu a"
      highlight="senha?"
      subtitle="Informe o email da sua conta. Enviaremos um link para você criar uma nova senha."
      onBack={() => router.back()}
      footer={
        <View style={styles.footer}>
          <Pressable onPress={() => router.replace('/login')}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Lembrou a senha? <Text style={{ color: Brand.primary }}>Entrar</Text>
            </Text>
          </Pressable>
        </View>
      }>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="voce@email.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />

      {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}
      {info ? <Text style={[styles.info, { color: Brand.success }]}>{info}</Text> : null}

      <Button title="Enviar link" onPress={handleSubmit} loading={loading} />
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
    lineHeight: 19,
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  footerText: {
    fontSize: 14,
  },
});
