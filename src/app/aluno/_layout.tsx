import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/ui/loading';
import { useAuth } from '@/providers/auth-provider';

export default function StudentLayout() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return <Loading label="Carregando..." />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (profile?.role === 'personal') {
    return <Redirect href="/personal" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="treino/[id]" />
    </Stack>
  );
}
