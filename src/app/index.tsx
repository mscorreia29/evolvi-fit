import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Loading } from '@/components/ui/loading';
import { supabase } from '@/lib/supabase';
import { clearActiveWorkoutSession, loadActiveWorkoutSession } from '@/lib/workouts';
import { useAuth } from '@/providers/auth-provider';

export default function Index() {
  const { loading, session, profile, hasAccess } = useAuth();
  const router = useRouter();
  const isAutonomous = Boolean(
    (profile as unknown as { is_autonomous?: boolean } | null)?.is_autonomous,
  );
  const [checkedProfileId, setCheckedProfileId] = useState<string | null>(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [checkingWorkout, setCheckingWorkout] = useState(true);
  const checkingAutonomous = isAutonomous && Boolean(profile?.id) && checkedProfileId !== profile?.id;

  useEffect(() => {
    let active = true;
    if (!profile) return () => { active = false; };

    (async () => {
      const draft = await loadActiveWorkoutSession();
      if (!active) return;
      if (!draft) {
        setCheckingWorkout(false);
        return;
      }
      if (draft.studentId !== profile.id) {
        await clearActiveWorkoutSession();
        setCheckingWorkout(false);
        return;
      }
      setActiveWorkoutId(draft.workoutId);
      setCheckingWorkout(false);
    })();

    return () => {
      active = false;
    };
  }, [profile]);

  useEffect(() => {
    let active = true;
    if (!profile || !isAutonomous || !hasAccess || !checkingAutonomous || checkingWorkout || activeWorkoutId) {
      return () => {
        active = false;
      };
    }

    (async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('id')
        .eq('student_id', profile.id)
        .eq('generated_by_ai', true)
        .limit(1);
      if (!active) return;
      if (error) {
        setCheckedProfileId(profile.id);
        return;
      }
      if (!data?.length) {
        router.replace('/anamnese-ai' as never);
        return;
      }
      setCheckedProfileId(profile.id);
    })();

    return () => {
      active = false;
    };
  }, [profile, isAutonomous, hasAccess, checkingAutonomous, checkingWorkout, activeWorkoutId, router]);

  if (loading) {
    return <Loading label="Carregando..." />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Loading label="Carregando perfil..." />;
  }

  if (isAutonomous && !hasAccess) {
    return <Redirect href={'/aluno/bloqueado' as never} />;
  }

  if (checkingWorkout) {
    return <Loading label="Verificando treino..." />;
  }

  if (activeWorkoutId && profile.role !== 'personal' && profile.role !== 'admin') {
    return <Redirect href={`/aluno/treino/${activeWorkoutId}` as never} />;
  }

  if (isAutonomous && checkingAutonomous) {
    return <Loading label="Verificando seu treino..." />;
  }

  if (profile.role === 'admin') {
    return <Redirect href={'/admin' as never} />;
  }

  if (profile.role === 'personal' && !hasAccess) {
    return <Redirect href={'/personal/bloqueado' as never} />;
  }

  return <Redirect href={profile.role === 'personal' ? '/personal' : '/aluno'} />;
}
