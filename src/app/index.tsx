import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui/loading';
import { useAuth } from '@/providers/auth-provider';

export default function Index() {
  const { loading, session, profile, hasAccess } = useAuth();

  if (loading) {
    return <Loading label="Carregando..." />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Loading label="Carregando perfil..." />;
  }

  if (profile.role === 'admin') {
    return <Redirect href={'/admin' as never} />;
  }

  if (profile.role === 'personal' && !hasAccess) {
    return <Redirect href={'/personal/bloqueado' as never} />;
  }

  return <Redirect href={profile.role === 'personal' ? '/personal' : '/aluno'} />;
}
