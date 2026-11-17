import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';

import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { PaymentDue, Profile } from '@/lib/types';

type Row = PaymentDue & { student?: Profile | null };

export default function AdminPagamentos() {
  const router = useRouter();
  const theme = useTheme();

  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'late'>('pending');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: dues, error: duesError } = await supabase
      .from('payment_dues')
      .select('*')
      .order('due_date', { ascending: false })
      .limit(200);

    if (duesError) {
      setError(duesError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setError(null);
    const list = (dues as PaymentDue[]) ?? [];
    const studentIds = Array.from(new Set(list.map((d) => d.student_id)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']);
    const map: Record<string, Profile> = {};
    (profiles as Profile[] | null)?.forEach((p) => {
      map[p.id] = p;
    });

    setRows(list.map((d) => ({ ...d, student: map[d.student_id] ?? null })));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function markPaid(row: Row) {
    setActionId(row.id);
    const { error: updateError } = await supabase
      .from('payment_dues')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', row.id);
    setActionId(null);
    if (updateError) {
      setError(updateError.message);
      Alert.alert('Não foi possível atualizar', updateError.message);
      return;
    }
    await load();
  }

  async function markCancelled(row: Row) {
    setActionId(row.id);
    const { error: updateError } = await supabase
      .from('payment_dues')
      .update({ status: 'cancelled' })
      .eq('id', row.id);
    setActionId(null);
    if (updateError) {
      setError(updateError.message);
      Alert.alert('Não foi possível atualizar', updateError.message);
      return;
    }
    await load();
  }

  if (loading) return <Loading label="Carregando pagamentos..." />;

  const filtered = rows.filter((r) => (filter === 'all' ? true : r.status === filter));
  const totalPending = rows.filter((r) => r.status === 'pending' || r.status === 'late').reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <Screen>
      <PhotoHero source={Images.coach} height={180} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Pagamentos</Text>
            <Text style={styles.heroSub}>
              Pendente: R$ {totalPending.toFixed(2)} • {rows.length} registro(s)
            </Text>
          </View>
        </View>
      </PhotoHero>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={22} color={Brand.danger} />
          <View style={styles.errorInfo}>
            <Text style={[styles.errorTitle, { color: theme.text }]}>Falha nos pagamentos</Text>
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
          </View>
          <Button title="Tentar novamente" variant="secondary" onPress={load} />
        </Card>
      ) : null}

      {!error ? <View style={styles.filterRow}>
        {(['all', 'pending', 'paid', 'late'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === f ? Brand.primary : theme.backgroundElement,
                borderColor: filter === f ? Brand.primary : theme.border,
              },
            ]}>
            <Text style={{ color: filter === f ? '#FFFFFF' : theme.text, fontWeight: '700', fontSize: 12 }}>
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : f === 'paid' ? 'Pagos' : 'Atrasados'}
            </Text>
          </Pressable>
        ))}
      </View> : null}

      {!error ? filtered.length === 0 ? (
        <EmptyState icon="card-outline" title="Nenhum pagamento" message="Nenhum registro com este filtro." />
      ) : (
        filtered.map((row) => (
          <Card key={row.id} style={styles.card}>
            <View style={styles.row}>
              <Avatar name={row.student?.full_name} size={40} />
              <View style={styles.info}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {row.student?.full_name ?? 'Aluno'}
                </Text>
                <Text style={[styles.desc, { color: theme.textSecondary }]} numberOfLines={1}>
                  {row.description} • vence {formatDate(row.due_date)}
                </Text>
                {row.amount != null ? (
                  <Text style={[styles.amount, { color: Brand.primary }]}>R$ {Number(row.amount).toFixed(2)}</Text>
                ) : null}
              </View>
              <Badge
                label={row.status === 'paid' ? 'Pago' : row.status === 'late' ? 'Atrasado' : row.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                tone={row.status === 'paid' ? 'success' : row.status === 'late' ? 'danger' : 'warning'}
              />
            </View>

            {(row.status === 'pending' || row.status === 'late') && (
              <View style={styles.actions}>
                <Button
                  title="Marcar pago"
                  onPress={() => markPaid(row)}
                  loading={actionId === row.id}
                  disabled={actionId !== null}
                />
                <Button
                  title="Cancelar"
                  variant="secondary"
                  onPress={() => markCancelled(row)}
                  disabled={actionId !== null}
                />
              </View>
            )}
            {actionId === row.id ? <ActivityIndicator size="small" color={Brand.primary} /> : null}
          </Card>
        ))
      ) : null}
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
  desc: {
    fontSize: 12,
  },
  amount: {
    fontSize: 14,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
