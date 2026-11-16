import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/ui/loading';
import { useAuth } from '@/providers/auth-provider';

export default function PersonalLayout() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return <Loading label="Carregando..." />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (profile?.role !== 'personal') {
    return <Redirect href="/aluno" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="aluno/[id]" />
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

