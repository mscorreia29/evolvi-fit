import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { TextField } from '@/components/ui/text-field';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { PaymentDue, Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type Row = PaymentDue & { student?: Profile | null };

function monthInput(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-05`;
}

export default function CoachFinanceiroScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [description, setDescription] = useState('Mensalidade');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(monthInput());
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data: links } = await supabase.from('coach_students').select('student_id').eq('coach_id', profile.id);
    const ids = (links ?? []).map((l) => l.student_id);
    const [{ data: st }, { data: dues }] = await Promise.all([
      ids.length ? supabase.from('profiles').select('*').in('id', ids) : Promise.resolve({ data: [] as any[] }),
      supabase
        .from('payment_dues')
        .select('*, student:profiles!payment_dues_student_id_fkey(id, full_name)')
        .eq('coach_id', profile.id)
        .order('due_date', { ascending: false })
        .limit(120),
    ]);
    const list = ((st as Profile[]) ?? []).sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));
    setStudents(list);
    setRows((dues as any[]) ?? []);
    setStudentId((prev) => prev ?? list[0]?.id ?? null);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function createDue() {
    if (!profile || !studentId || !description.trim() || !dueDate) return;
    setSaving(true);
    setNotice(null);
    const { error } = await supabase.from('payment_dues').insert({
      coach_id: profile.id,
      student_id: studentId,
      description: description.trim(),
      amount: amount ? Number(amount.replace(',', '.')) : null,
      due_date: dueDate,
      status: 'pending',
    });
    setSaving(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice('Cobrança criada. O aluno verá o lembrete no app.');
    setAmount('');
    await load();
  }

  async function setStatus(id: string, status: PaymentDue['status']) {
    await supabase.from('payment_dues').update({ status }).eq('id', id);
    await load();
  }

  const dueMeta: Record<string, { label: string; tone: 'success' | 'warning' | 'muted' }> = {
    pending: { label: 'Pendente', tone: 'warning' },
    paid: { label: 'Pago', tone: 'success' },
    late: { label: 'Atrasado', tone: 'warning' },
    cancelled: { label: 'Cancelado', tone: 'muted' },
  };

  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'pending' || r.status === 'late').length, [rows]);

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}>
      <PhotoHero source={Images.coach} height={180} glowColor={Brand.warning}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.heroTitle}>Financeiro</Text>
        <Text style={styles.heroSub}>Mensalidades e lembretes de pagamento</Text>
      </PhotoHero>

      <Card>
        <SectionHeader title="Nova cobrança" subtitle={`Pendentes/atrasadas: ${pendingCount}`} />
        {students.length === 0 ? (
          <Text style={{ color: theme.textSecondary }}>Nenhum aluno vinculado.</Text>
        ) : (
          <View style={{ gap: Spacing.two }}>
            <View style={styles.catRow}>
              {students.map((s) => {
                const sel = s.id === studentId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setStudentId(s.id)}
                    style={[
                      styles.catPill,
                      { backgroundColor: sel ? Brand.primary : theme.backgroundSelected, borderColor: sel ? Brand.primary : theme.border },
                    ]}>
                    <Text style={{ color: sel ? '#fff' : theme.text, fontSize: 12, fontWeight: '700' }}>
                      {s.full_name ?? 'Aluno'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextField label="Descrição" value={description} onChangeText={setDescription} placeholder="Mensalidade" />
            <TextField label="Valor (R$)" value={amount} onChangeText={setAmount} placeholder="150,00" keyboardType="decimal-pad" />
            <TextField label="Vencimento (AAAA-MM-DD)" value={dueDate} onChangeText={setDueDate} placeholder="2026-11-05" />
            {notice ? <Text style={{ color: notice.includes('criada') ? Brand.success : Brand.danger, fontSize: 13 }}>{notice}</Text> : null}
            <Button title="Criar lembrete" onPress={createDue} loading={saving} disabled={!studentId} />
          </View>
        )}
      </Card>

      <SectionHeader title="Cobranças" subtitle="Gerencie status e acompanhe vencimentos" />
      {rows.length === 0 ? (
        <EmptyState icon="card-outline" title="Nenhuma cobrança" message="Crie cobranças para enviar lembretes mensais aos alunos." />
      ) : (
        rows.map((due) => {
          const meta = dueMeta[due.status] ?? dueMeta.pending;
          return (
            <Card key={due.id} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{due.student?.full_name ?? 'Aluno'}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    {due.description} • {formatDate(due.due_date)}
                    {due.amount != null ? ` • R$ ${Number(due.amount).toFixed(2)}` : ''}
                  </Text>
                </View>
                <Badge label={meta.label} tone={meta.tone} />
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' }}>
                {due.status !== 'paid' ? (
                  <Pressable onPress={() => setStatus(due.id, 'paid')} style={[styles.smallBtn, { backgroundColor: theme.primarySoft }]}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={Brand.primary} />
                    <Text style={{ color: Brand.primary, fontSize: 12, fontWeight: '700' }}>Marcar pago</Text>
                  </Pressable>
                ) : null}
                {due.status === 'pending' ? (
                  <Pressable onPress={() => setStatus(due.id, 'late')} style={[styles.smallBtn, { backgroundColor: theme.backgroundSelected }]}>
                    <Ionicons name="alert-circle-outline" size={14} color={theme.text} />
                    <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Atrasado</Text>
                  </Pressable>
                ) : null}
                {due.status !== 'cancelled' ? (
                  <Pressable onPress={() => setStatus(due.id, 'cancelled')} style={[styles.smallBtn, { backgroundColor: theme.backgroundSelected }]}>
                    <Ionicons name="close-circle-outline" size={14} color={theme.textSecondary} />
                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>Cancelar</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  catPill: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
});

