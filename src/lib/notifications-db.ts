import { supabase } from '@/lib/supabase';
import type { AppNotification } from '@/lib/types';

export async function fetchNotifications(userId: string, limit = 60) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { error: error.message, notifications: [] as AppNotification[] };
  return { error: null, notifications: (data as AppNotification[]) ?? [] };
}

export async function countUnreadNotifications(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) return 0;
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);

  return { error: error?.message ?? null };
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  return { error: error?.message ?? null };
}
