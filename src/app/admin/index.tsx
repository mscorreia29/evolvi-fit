import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Overview = {
  personals_trial: number;
  personals_approved: number;
  personals_rejected: number;
  personals_pending: number;
  alunos_total: number;
  usuarios_total: number;
  pending_dues_count: number;
  pending_dues_amount: number;
  blocked_count: number;
  audit_count: number;
};

export default function AdminDashboard() {
  const router = useRouter();
  const theme = useTheme();
  const { profile, signOut } = useAuth();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error: loadError } = await supabase
        .from('admin_overview')
        .select('*')
        .maybeSingle();
      if (loadError) {
        setError(loadError.message);
        setOverview(null);
        return;
      }
      setError(null);
      setOverview((data as Overview | null) ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar o painel.');
      setOverview(null);
    } finally {
      setLoading(false);
    }
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

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  if (loading) return <Loading label="Carregando painel..." />;

  const o = overview ?? {
    personals_trial: 0,
    personals_approved: 0,
    personals_rejected: 0,
    personals_pending: 0,
    alunos_total: 0,
    usuarios_total: 0,
    pending_dues_count: 0,
    pending_dues_amount: 0,
    blocked_count: 0,
    audit_count: 0,
  };

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PhotoHero source={Images.coach} height={200} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Avatar name={profile?.full_name} size={64} ring />
          <View style={styles.heroTexts}>
            <Text style={styles.heroKicker}>PAINEL MASTER</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {profile?.full_name ?? 'Administrador'}
            </Text>
            <Text style={styles.heroSub}>Gestão de contas e aprovações</Text>
          </View>
        </View>
      </PhotoHero>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={24} color={Brand.danger} />
          <View style={styles.errorInfo}>
            <Text style={[styles.errorTitle, { color: theme.text }]}>Dados indisponíveis</Text>
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
          </View>
          <Button title="Tentar novamente" variant="secondary" onPress={handleRefresh} loading={refreshing} />
        </Card>
      ) : (
        <View style={styles.grid}>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Brand.primary }]}>{o.personals_approved}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Personais aprovados</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Brand.warning }]}>{o.personals_trial}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Em teste</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Brand.danger }]}>{o.personals_pending + o.personals_rejected}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pendentes/rejeitados</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Brand.danger }]}>{o.blocked_count}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Bloqueados</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Brand.success }]}>{o.alunos_total}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Alunos</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Brand.warning }]}>R$ {Number(o.pending_dues_amount).toFixed(0)}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>A receber ({o.pending_dues_count})</Text>
          </Card>
        </View>
      )}

      <Card>
        <SectionHeader title="Ações rápidas" />
        <View style={styles.quickGrid}>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/admin/personais' as never)}>
            <View style={[styles.quickIcon, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="people-outline" size={20} color={Brand.primary} />
            </View>
            <Text style={[styles.quickText, { color: theme.text }]}>Gerenciar personais</Text>
          </Pressable>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/admin/alunos' as never)}>
            <View style={[styles.quickIcon, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="school-outline" size={20} color={Brand.primary} />
            </View>
            <Text style={[styles.quickText, { color: theme.text }]}>Ver alunos</Text>
          </Pressable>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/admin/pagamentos' as never)}>
            <View style={[styles.quickIcon, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="card-outline" size={20} color={Brand.primary} />
            </View>
            <Text style={[styles.quickText, { color: theme.text }]}>Pagamentos</Text>
          </Pressable>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/admin/configuracoes' as never)}>
            <View style={[styles.quickIcon, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="settings-outline" size={20} color={Brand.primary} />
            </View>
            <Text style={[styles.quickText, { color: theme.text }]}>Configurações</Text>
          </Pressable>
          <Pressable style={[styles.quickItem, { borderColor: theme.border }]} onPress={() => router.push('/admin/auditoria' as never)}>
            <View style={[styles.quickIcon, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="list-outline" size={20} color={Brand.primary} />
            </View>
            <Text style={[styles.quickText, { color: theme.text }]}>Auditoria</Text>
          </Pressable>
        </View>
      </Card>

      {!error ? (
        <Card>
          <SectionHeader title="Resumo" subtitle={`${o.usuarios_total} usuários no total`} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Personais aprovados</Text>
            <Badge label={String(o.personals_approved)} tone="success" />
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Personais em teste</Text>
            <Badge label={String(o.personals_trial)} tone="warning" />
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Personais bloqueados</Text>
            <Badge label={String(o.blocked_count)} tone="danger" />
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Ações registradas</Text>
            <Badge label={String(o.audit_count)} tone="muted" />
          </View>
        </Card>
      ) : null}

      <Button title="Sair da conta" onPress={handleSignOut} variant="danger" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroTexts: {
    flex: 1,
    gap: 2,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  errorCard: {
    gap: Spacing.two,
    borderColor: Brand.danger,
  },
  errorInfo: {
    gap: 2,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  quickItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: {
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 14,
  },
});
