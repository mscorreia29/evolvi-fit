import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';

import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { PaymentDue, Profile } from '@/lib/types';

type Row = PaymentDue & { student?: Profile | null };
type PaymentStatus = PaymentDue['status'];
type Draft = {
  description: string;
  amount: string;
  due_date: string;
  status: PaymentStatus;
  notes: string;
};

const emptyDraft: Draft = {
  description: '',
  amount: '',
  due_date: new Date().toISOString().slice(0, 10),
  status: 'pending',
  notes: '',
};

export default function AdminPagamentos() {
  const router = useRouter();
  const theme = useTheme();

  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'late'>('pending');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);

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

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function openEdit(row: Row) {
    setEditing(row);
    setFormError(null);
    setDraft({
      description: row.description,
      amount: row.amount == null ? '' : String(row.amount),
      due_date: row.due_date,
      status: row.status,
      notes: row.notes ?? '',
    });
  }

  function closeEdit() {
    if (actionId) return;
    setEditing(null);
    setFormError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    const description = draft.description.trim();
    const amount = Number(draft.amount.replace(',', '.'));
    const dueDate = draft.due_date.trim();

    if (!description) {
      setFormError('Informe a descrição da cobrança.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Informe um valor válido maior que zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) {
      setFormError('Informe a data de vencimento no formato AAAA-MM-DD.');
      return;
    }

    setFormError(null);
    setActionId(editing.id);
    const paidAt = draft.status === 'paid' ? editing.paid_at ?? new Date().toISOString() : null;
    const { error: updateError } = await supabase
      .from('payment_dues')
      .update({
        description,
        amount,
        due_date: dueDate,
        status: draft.status,
        notes: draft.notes.trim() || null,
        paid_at: paidAt,
      })
      .eq('id', editing.id);
    setActionId(null);
    if (updateError) {
      setFormError(updateError.message);
      return;
    }
    setEditing(null);
    await load();
  }

  async function removeRow(row: Row) {
    setActionId(row.id);
    const { error: deleteError } = await supabase
      .from('payment_dues')
      .delete()
      .eq('id', row.id);
    setActionId(null);
    if (deleteError) {
      setError(deleteError.message);
      Alert.alert('Não foi possível excluir', deleteError.message);
      return;
    }
    await load();
  }

  function confirmDelete(row: Row) {
    const message = `Excluir a cobrança "${row.description}" de ${row.student?.full_name ?? 'Aluno'}?`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) void removeRow(row);
      return;
    }
    Alert.alert('Excluir cobrança', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void removeRow(row) },
    ]);
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
                {row.notes ? (
                  <Text style={[styles.desc, { color: theme.textSecondary }]} numberOfLines={2}>
                    {row.notes}
                  </Text>
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
                  title="Cancelar cobrança"
                  variant="secondary"
                  onPress={() => markCancelled(row)}
                  disabled={actionId !== null}
                />
              </View>
            )}
            <View style={styles.actions}>
              <Button
                title="Editar"
                variant="secondary"
                onPress={() => openEdit(row)}
                disabled={actionId !== null}
              />
              <Button
                title="Excluir"
                variant="danger"
                onPress={() => confirmDelete(row)}
                disabled={actionId !== null}
              />
            </View>
            {actionId === row.id ? <ActivityIndicator size="small" color={Brand.primary} /> : null}
          </Card>
        ))
      ) : null}

      <Modal
        visible={Boolean(editing)}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeEdit}>
            <Pressable
              style={[
                styles.modalCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
              onPress={() => undefined}>
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Editar cobrança</Text>
                  <Pressable onPress={closeEdit} hitSlop={8}>
                    <Ionicons name="close" size={22} color={theme.textSecondary} />
                  </Pressable>
                </View>
                <Text style={[styles.modalStudent, { color: theme.textSecondary }]}>
                  {editing?.student?.full_name ?? 'Aluno'} • {editing?.student?.email ?? ''}
                </Text>
                <TextField
                  label="Descrição"
                  value={draft.description}
                  onChangeText={(value) => updateDraft('description', value)}
                  placeholder="Mensalidade"
                />
                <TextField
                  label="Valor (R$)"
                  value={draft.amount}
                  onChangeText={(value) => updateDraft('amount', value)}
                  placeholder="149,90"
                  keyboardType="decimal-pad"
                />
                <TextField
                  label="Vencimento (AAAA-MM-DD)"
                  value={draft.due_date}
                  onChangeText={(value) => updateDraft('due_date', value)}
                  placeholder="2026-11-20"
                />
                <Text style={[styles.sectionLabel, { color: theme.text }]}>Status</Text>
                <View style={styles.filterRow}>
                  {([
                    ['pending', 'Pendente'],
                    ['paid', 'Pago'],
                    ['late', 'Atrasado'],
                    ['cancelled', 'Cancelado'],
                  ] as const).map(([value, label]) => (
                    <Pressable
                      key={value}
                      onPress={() => updateDraft('status', value)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: draft.status === value ? Brand.primary : theme.backgroundElement,
                          borderColor: draft.status === value ? Brand.primary : theme.border,
                        },
                      ]}>
                      <Text
                        style={{
                          color: draft.status === value ? '#FFFFFF' : theme.text,
                          fontWeight: '700',
                          fontSize: 12,
                        }}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextField
                  label="Observações"
                  value={draft.notes}
                  onChangeText={(value) => updateDraft('notes', value)}
                  placeholder="Detalhes opcionais"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                {formError ? (
                  <Text style={[styles.errorText, { color: Brand.danger }]}>{formError}</Text>
                ) : null}
                <View style={styles.actions}>
                  <Button title="Cancelar" variant="secondary" onPress={closeEdit} style={styles.modalButton} />
                  <Button
                    title="Salvar alterações"
                    onPress={() => void saveEdit()}
                    loading={Boolean(actionId)}
                    disabled={Boolean(actionId)}
                    style={styles.modalButton}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalBackdrop: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  modalContent: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalStudent: {
    fontSize: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalButton: {
    flex: 1,
  },
});
