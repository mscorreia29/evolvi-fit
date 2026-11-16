import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { Images } from '@/constants/images';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type Row = { student: Profile; unread: number; last?: string };

export default function CoachMessagesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data: links } = await supabase
      .from('coach_students')
      .select('student_id')
      .eq('coach_id', profile.id);
    const ids = (links ?? []).map((l) => l.student_id);
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    const [{ data: students }, { data: msgs }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', ids),
      supabase
        .from('messages')
        .select('student_id, sender_id, content, created_at, read_at')
        .eq('coach_id', profile.id)
        .in('student_id', ids)
        .order('created_at', { ascending: false }),
    ]);
    const byStudent: Record<string, { unread: number; last?: string }> = {};
    (msgs ?? []).forEach((m: any) => {
      if (!byStudent[m.student_id]) byStudent[m.student_id] = { unread: 0, last: m.content };
      if (m.sender_id !== profile.id && !m.read_at) byStudent[m.student_id].unread += 1;
    });
    const list = ((students as Profile[]) ?? [])
      .map((s) => ({ student: s, unread: byStudent[s.id]?.unread ?? 0, last: byStudent[s.id]?.last }))
      .sort((a, b) => b.unread - a.unread || (a.student.full_name ?? '').localeCompare(b.student.full_name ?? ''));
    setRows(list);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}>
      <PhotoHero source={Images.coach} height={170} glowColor={Brand.primary}>
        <Text style={styles.heroTitle}>Mensagens</Text>
        <Text style={styles.heroSub}>Converse com seus alunos pelo app</Text>
      </PhotoHero>

      {rows.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="Sem conversas" message="Vincule alunos para iniciar conversas." />
      ) : (
        rows.map((row) => (
          <Pressable key={row.student.id} onPress={() => router.push(`/personal/mensagem/${row.student.id}` as never)}>
            <Card style={styles.row}>
              <Avatar name={row.student.full_name} size={46} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
                  {row.student.full_name ?? 'Aluno'}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {row.last ?? 'Toque para abrir o chat'}
                </Text>
              </View>
              {row.unread > 0 ? <Badge label={`${row.unread} nova(s)`} tone="warning" /> : <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});

