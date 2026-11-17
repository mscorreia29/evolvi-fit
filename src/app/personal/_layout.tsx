import { Redirect, Stack, usePathname } from 'expo-router';

import { Loading } from '@/components/ui/loading';
import { useAuth } from '@/providers/auth-provider';

export default function PersonalLayout() {
  const pathname = usePathname();
  const { loading, session, profile, hasAccess } = useAuth();

  if (loading) {
    return <Loading label="Carregando..." />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (profile?.role === 'aluno') {
    return <Redirect href="/aluno" />;
  }

  if (profile?.role === 'admin') {
    return <Redirect href={'/admin' as never} />;
  }

  if (profile?.role !== 'personal') {
    return <Redirect href="/login" />;
  }

  if (!hasAccess && pathname !== '/personal/bloqueado') {
    return <Redirect href={'/personal/bloqueado' as never} />;
  }

  if (hasAccess && pathname === '/personal/bloqueado') {
    return <Redirect href={'/personal' as never} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="aluno/[id]" />
      <Stack.Screen name="ajuda" />
      <Stack.Screen name="convites" />
      <Stack.Screen name="feedbacks" />
      <Stack.Screen name="financeiro" />
      <Stack.Screen name="mensagem/[id]" />
      <Stack.Screen name="novo-aluno" />
      <Stack.Screen name="novo-treino" />
      <Stack.Screen name="plano-alimentar" />
    </Stack>
  );
}

