import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthShell } from '@/components/ui/auth-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { PasswordField } from '@/components/ui/password-field';
import { Screen } from '@/components/ui/screen';
import { Brand } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Status = 'loading' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function handleUrl(url: string | null) {
      if (!url) {
        if (active) setStatus('invalid');
        return;
      }

      const normalized = url.replace('#', '?');
      let params: URLSearchParams;

      try {
        params = new URL(normalized).searchParams;
      } catch {
        if (active) setStatus('invalid');
        return;
      }

      const errorDescription = params.get('error_description') ?? params.get('error');
      if (errorDescription) {
        if (active) {
          setError(errorDescription.replace(/\+/g, ' '));
          setStatus('invalid');
        }
        return;
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const type = params.get('type');
      const fragment = url.includes('#') ? new URLSearchParams(url.split('#')[1]) : null;

      const access = accessToken ?? fragment?.get('access_token') ?? null;
      const refresh = refreshToken ?? fragment?.get('refresh_token') ?? null;
      const otpHash = tokenHash ?? fragment?.get('token_hash') ?? null;
      const otpType = type ?? fragment?.get('type') ?? null;

      if (access && refresh) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: access,
          refresh_token: refresh,
        });

        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
          setStatus('invalid');
        } else {
          setStatus('ready');
        }
        return;
      }

      if (otpHash && otpType) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: otpHash,
          type: otpType as 'recovery',
        });

        if (!active) return;
        if (otpError) {
          setError(otpError.message);
          setStatus('invalid');
        } else {
          setStatus('ready');
        }
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (!active) return;
        if (exchangeError) {
          setError(exchangeError.message);
          setStatus('invalid');
        } else {
          setStatus('ready');
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setStatus(data.session ? 'ready' : 'invalid');
    }

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  async function handleSave() {
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setError(null);
    setSaving(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage('Senha alterada com sucesso! Você já pode entrar com a nova senha.');
    setStatus('done');
    await supabase.auth.signOut();
  }

  if (status === 'loading') {
    return <Loading label="Validando link..." />;
  }

  if (status === 'invalid') {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Link inválido ou expirado"
          message={error ?? 'Solicite um novo link de recuperação de senha.'}
          actionLabel="Voltar ao login"
          onAction={() => router.replace('/login')}
        />
      </Screen>
    );
  }

  if (status === 'done') {
    return (
      <Screen>
        <EmptyState
          icon="checkmark-circle-outline"
          title="Tudo pronto!"
          message={message ?? 'Sua senha foi atualizada.'}
          actionLabel="Ir para o login"
          onAction={() => router.replace('/login')}
        />
      </Screen>
    );
  }

  return (
    <AuthShell
      eyebrow="NOVO ACESSO"
      title="Defina sua"
      highlight="nova senha."
      subtitle="Escolha uma nova senha para sua conta e volte a treinar."
      onBack={() => router.replace('/login')}>
      <PasswordField
        label="Nova senha"
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo de 6 caracteres"
      />
      <PasswordField
        label="Confirmar nova senha"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Repita a nova senha"
      />

      {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}

      <Button title="Salvar nova senha" onPress={handleSave} loading={saving} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
});
