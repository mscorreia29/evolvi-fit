import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui/loading';
import { useAuth } from '@/providers/auth-provider';

export default function Index() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return <Loading label="Carregando..." />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Loading label="Carregando perfil..." />;
  }

  return <Redirect href={profile.role === 'personal' ? '/personal' : '/aluno'} />;
}
