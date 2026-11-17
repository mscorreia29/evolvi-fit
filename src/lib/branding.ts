import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export async function resolveBrandCoverUrl(profile: Profile | null): Promise<string | null> {
  if (!profile) return null;

  if (profile.role === 'personal') {
    return profile.cover_url ?? null;
  }

  if (profile.role !== 'aluno') return null;

  const { data: link } = await supabase
    .from('coach_students')
    .select('coach_id')
    .eq('student_id', profile.id)
    .maybeSingle();

  if (!link?.coach_id) return null;

  const { data: coach } = await supabase
    .from('profiles')
    .select('cover_url')
    .eq('id', link.coach_id as string)
    .maybeSingle();

  return (coach as { cover_url?: string | null } | null)?.cover_url ?? null;
}
