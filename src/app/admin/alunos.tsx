import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';

import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';


export default function AdminAlunos() {
  const router = useRouter();
  const theme = useTheme();


  const [alunos, setAlunos] = useState<Profile[]>([]);
  const [coaches, setCoaches] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'aluno')
      .order('created_at', { ascending: false });
    const list = (data as Profile[]) ?? [];
    setAlunos(list);

    const ids = list.map((a) => a.id);
    if (ids.length) {
      const { data: links } = await supabase.from('coach_students').select('student_id, coach_id').in('student_id', ids);
      const coachIds = Array.from(new Set((links ?? []).map((l: any) => l.coach_id)));
      const { data: coachProfiles } = coachIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', coachIds)
        : { data: [] };
      const coachMap: Record<string, string> = {};
      const linkMap: Record<string, string> = {};
      (links ?? []).forEach((l: any) => { linkMap[l.student_id] = l.coach_id; });
      (coachProfiles as { id: string; full_name: string | null }[] | null)?.forEach((c) => {
        coachMap[c.id] = c.full_name ?? 'Personal';
      });
      const result: Record<string, string> = {};
      list.forEach((a) => {
        const cid = linkMap[a.id];
        if (cid) result[a.id] = coachMap[cid] ?? 'Personal';
      });
      setCoaches(result);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) return <Loading label="Carregando alunos..." />;

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PhotoHero source={Images.student} height={180} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Alunos</Text>
            <Text style={styles.heroSub}>{alunos.length} cadastrado(s)</Text>
          </View>
        </View>
      </PhotoHero>

      {alunos.length === 0 ? (
        <EmptyState icon="school-outline" title="Nenhum aluno" message="Alunos são criados pelos personais." />
      ) : (
        alunos.map((a) => (
          <Card key={a.id} style={styles.card}>
            <View style={styles.row}>
              <Avatar name={a.full_name} size={40} />
              <View style={styles.info}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {a.full_name ?? 'Sem nome'}
                </Text>
                <Text style={[styles.email, { color: theme.textSecondary }]} numberOfLines={1}>
                  {a.email}
                </Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  Personal: {coaches[a.id] ?? '—'} • {new Date(a.created_at).toLocaleDateString('pt-BR')}
                </Text>
              </View>
              <Badge label="Aluno" tone="muted" />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  heroTexts: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
  },
  email: {
    fontSize: 13,
  },
  meta: {
    fontSize: 12,
  },
});
