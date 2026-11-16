import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/ui/loading';
import { useAuth } from '@/providers/auth-provider';

export default function AdminLayout() {
  const { loading, session, isAdmin } = useAuth();

  if (loading) {
    return <Loading label="Carregando..." />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!isAdmin) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="personais" />
      <Stack.Screen name="alunos" />
      <Stack.Screen name="auditoria" />
      <Stack.Screen name="pagamentos" />
      <Stack.Screen name="configuracoes" />
    </Stack>
  );
}
