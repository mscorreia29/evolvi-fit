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
import type { AdminAuditLog, Profile } from '@/lib/types';


export default function AdminAuditoria() {
  const router = useRouter();
  const theme = useTheme();

  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    const list = (data as AdminAuditLog[]) ?? [];
    setLogs(list);

    const ids = Array.from(new Set(list.map((l) => l.admin_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
      const map: Record<string, Profile> = {};
      (profs as Profile[] | null)?.forEach((p) => {
        map[p.id] = p;
      });
      setProfiles(map);
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

  if (loading) return <Loading label="Carregando auditoria..." />;

  function actionLabel(action: string) {
    switch (action) {
      case 'block_account': return 'Bloqueou conta';
      case 'unblock_account': return 'Desbloqueou conta';
      case 'set_status': return 'Alterou status';
      case 'grant_access': return 'Liberou acesso';
      case 'revoke_access': return 'Revogou acesso';
      case 'update_email': return 'Alterou email';
      case 'reset_password': return 'Redefiniu senha';
      case 'update_settings': return 'Atualizou configurações';
      default: return action;
    }
  }

  function actionTone(action: string): 'success' | 'danger' | 'warning' | 'muted' {
    if (action.includes('block') || action.includes('revoke')) return 'danger';
    if (action.includes('grant') || action.includes('unblock')) return 'success';
    if (action.includes('reset') || action.includes('update')) return 'warning';
    return 'muted';
  }

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PhotoHero source={Images.coach} height={180} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Auditoria</Text>
            <Text style={styles.heroSub}>{logs.length} ação(ões) registrada(s)</Text>
          </View>
        </View>
      </PhotoHero>

      {logs.length === 0 ? (
        <EmptyState icon="list-outline" title="Nenhuma ação" message="As ações do admin aparecerão aqui." />
      ) : (
        logs.map((log) => (
          <Card key={log.id} style={styles.card}>
            <View style={styles.row}>
              <Avatar name={profiles[log.admin_id ?? '']?.full_name} size={36} />
              <View style={styles.info}>
                <Text style={[styles.action, { color: theme.text }]}>{actionLabel(log.action)}</Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  {profiles[log.admin_id ?? '']?.full_name ?? 'Admin'} • {new Date(log.created_at).toLocaleString('pt-BR')}
                </Text>
                {log.target_id ? (
                  <Text style={[styles.meta, { color: theme.textSecondary }]}>Alvo: {log.target_id.slice(0, 8)}...</Text>
                ) : null}
                {log.details ? (
                  <Text style={[styles.details, { color: theme.textSecondary }]}>
                    {JSON.stringify(log.details)}
                  </Text>
                ) : null}
              </View>
              <Badge label={log.action} tone={actionTone(log.action)} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  heroTexts: { flex: 1, gap: 2 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: 13 },
  backBtn: { width: 36, height: 36, borderRadius: Radius.full, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  info: { flex: 1, gap: 2 },
  action: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12 },
  details: { fontSize: 11, fontFamily: 'monospace' },
});
