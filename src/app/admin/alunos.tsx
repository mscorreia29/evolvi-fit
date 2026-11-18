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
  const [filter, setFilter] = useState<'all' | 'linked' | 'autonomous'>('all');
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

  const autonomousCount = alunos.filter((a) => a.is_autonomous).length;
  const filtered = alunos.filter((a) =>
    filter === 'all' ? true : filter === 'autonomous' ? Boolean(a.is_autonomous) : !a.is_autonomous,
  );

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PhotoHero source={Images.student} height={180} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Alunos</Text>
            <Text style={styles.heroSub}>
              {alunos.length} aluno(s) • {autonomousCount} autônomo(s)
            </Text>
          </View>
        </View>
      </PhotoHero>

      <View style={styles.filterRow}>
        {([
          ['all', 'Todos'],
          ['linked', 'Vinculados'],
          ['autonomous', 'Autônomos'],
        ] as const).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setFilter(value)}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === value ? Brand.primary : theme.backgroundElement,
                borderColor: filter === value ? Brand.primary : theme.border,
              },
            ]}>
            <Text
              style={{
                color: filter === value ? '#FFFFFF' : theme.text,
                fontWeight: '700',
                fontSize: 12,
              }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="school-outline"
          title="Nenhum aluno"
          message="Nenhum cadastro com este filtro."
        />
      ) : (
        filtered.map((a) => (
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
                <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={2}>
                  {a.is_autonomous
                    ? `Cadastro IA • treinos ${a.ai_generation_count ?? 0}x • plano ${a.ai_meal_generation_count ?? 0}x`
                    : `Personal: ${coaches[a.id] ?? '—'}`}{' '}
                  • {new Date(a.created_at).toLocaleDateString('pt-BR')}
                </Text>
              </View>
              <Badge
                label={a.is_autonomous ? 'Autônomo' : 'Aluno'}
                tone={a.is_autonomous ? 'primary' : 'muted'}
              />
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
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
