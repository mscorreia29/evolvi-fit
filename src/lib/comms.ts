import { supabase } from '@/lib/supabase';

export async function getMyCoachId(studentId: string) {
  const { data } = await supabase
    .from('coach_students')
    .select('coach_id')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.coach_id as string | undefined) ?? null;
}
