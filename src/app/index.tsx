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

  if (profile.role === 'admin') {
    return <Redirect href={'/admin' as never} />;
  }

  if (profile.role === 'personal' && (profile.status === 'rejected' || profile.status === 'pending' || profile.status === 'blocked')) {
    return <Redirect href={'/personal/bloqueado' as never} />;
  }

  // eslint-disable-next-line react-hooks/purity
  if (profile.role === 'personal' && profile.status === 'trial' && profile.trial_ends_at && new Date(profile.trial_ends_at).getTime() < Date.now()) {
    return <Redirect href={'/personal/bloqueado' as never} />;
  }

  return <Redirect href={profile.role === 'personal' ? '/personal' : '/aluno'} />;
}
