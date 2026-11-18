import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { getMyCoachId } from '@/lib/comms';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { PaymentDue, StudentFeedback } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

const categories = [
  { key: 'geral', label: 'Geral' },
  { key: 'treino', label: 'Treino' },
  { key: 'app', label: 'App' },
  { key: 'sugestao', label: 'Sugestão' },
];

export default function StudentSupportScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const isAutonomous = Boolean(
    (profile as unknown as { is_autonomous?: boolean } | null)?.is_autonomous,
  );
  const [coachId, setCoachId] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<StudentFeedback[]>([]);
  const [dues, setDues] = useState<PaymentDue[]>([]);
  const [category, setCategory] = useState('geral');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const cid = await getMyCoachId(profile.id);
    setCoachId(cid);
    const [{ data: fb }, { data: pd }] = await Promise.all([
      supabase
        .from('student_feedback')
        .select('*')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('payment_dues')
        .select('*')
        .eq('student_id', profile.id)
        .order('due_date', { ascending: false })
        .limit(24),
    ]);
    setFeedbacks((fb as StudentFeedback[]) ?? []);
    setDues((pd as PaymentDue[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSendFeedback() {
    if (!profile || !message.trim()) return;
    setSending(true);
    setNotice(null);
    setError(null);
    const { error: sendError } = await supabase.from('student_feedback').insert({
      coach_id: coachId ?? profile.id,
      student_id: profile.id,
      category,
      message: message.trim(),
      status: 'open',
    });
    setSending(false);
    if (sendError) {
      setError('Não foi possível enviar o feedback. Tente novamente.');
      return;
    }
    setMessage('');
    setNotice(
      isAutonomous
        ? 'Feedback enviado! Nossa equipe poderá ver no suporte.'
        : 'Feedback enviado! Seu personal poderá ver no acesso dele.',
    );
    await load();
  }

  const statusLabel: Record<string, { label: string; tone: 'success' | 'warning' | 'muted' }> = {
    open: { label: 'Enviado', tone: 'warning' },
    read: { label: 'Lido', tone: 'muted' },
    resolved: { label: 'Respondido', tone: 'success' },
  };
  const dueLabel: Record<string, { label: string; tone: 'success' | 'warning' | 'muted' }> = {
    pending: { label: 'Pendente', tone: 'warning' },
    paid: { label: 'Pago', tone: 'success' },
    late: { label: 'Atrasado', tone: 'warning' },
    cancelled: { label: 'Cancelado', tone: 'muted' },
  };

  if (!coachId && profile && !isAutonomous) {
    return (
      <Screen>
        <PhotoHero source={Images.student} height={180} glowColor={Brand.accent}>
          <Text style={styles.heroTitle}>Suporte</Text>
          <Text style={styles.heroSub}>Feedback e mensalidades</Text>
        </PhotoHero>
        <EmptyState icon="alert-circle-outline" title="Sem personal vinculado" message="Vincule-se a um personal para usar esta área." />
      </Screen>
    );
  }

  return (
    <Screen>
      <PhotoHero source={Images.student} height={180} glowColor={Brand.accent}>
        <Text style={styles.heroTitle}>Suporte</Text>
        <Text style={styles.heroSub}>Feedback, solicitações e mensalidades</Text>
      </PhotoHero>

      <Card>
        <SectionHeader
          title="Enviar feedback"
          subtitle={isAutonomous ? 'Solicitações e sugestões para o suporte' : 'Solicitações e sugestões para seu personal'}
        />
        <View style={styles.catRow}>
          {categories.map((c) => {
            const sel = category === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setCategory(c.key)}
                style={[
                  styles.catPill,
                  {
                    backgroundColor: sel ? Brand.primary : theme.backgroundSelected,
                    borderColor: sel ? Brand.primary : theme.border,
                  },
                ]}>
                <Text style={{ color: sel ? '#fff' : theme.text, fontSize: 12, fontWeight: '700' }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextField value={message} onChangeText={setMessage} placeholder="Descreva seu feedback ou solicitação..." multiline />
        {error ? (
          <Text style={{ color: Brand.danger, fontSize: 13, fontWeight: '600' }}>{error}</Text>
        ) : null}
        {notice ? <Text style={{ color: Brand.success, fontSize: 13, fontWeight: '600' }}>{notice}</Text> : null}
        <Button title="Enviar feedback" onPress={handleSendFeedback} loading={sending} disabled={!message.trim()} />
      </Card>

      <Card>
        <SectionHeader title="Mensalidade" subtitle="Lembretes e status de pagamento" />
        {dues.length === 0 ? (
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {isAutonomous ? 'Você não possui cobranças registradas.' : 'Nenhuma cobrança registrada pelo seu personal.'}
          </Text>
        ) : (
          dues.map((due) => {
            const meta = dueLabel[due.status] ?? dueLabel.pending;
            const dueDate = new Date(due.due_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const days = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
            const soon = due.status === 'pending' && days >= 0 && days <= 5;
            return (
              <View key={due.id} style={[styles.dueRow, { borderColor: theme.border }, soon && { borderColor: Brand.warning }]}>
                <View style={[styles.dueIcon, { backgroundColor: theme.primarySoft }]}>
                  <Ionicons name="card-outline" size={18} color={Brand.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{due.description}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    Vencimento: {formatDate(due.due_date)}
                    {due.amount != null ? ` • R$ ${Number(due.amount).toFixed(2)}` : ''}
                    {soon ? ' • vence em breve' : ''}
                  </Text>
                </View>
                <Badge label={meta.label} tone={meta.tone} />
              </View>
            );
          })
        )}
      </Card>

      <SectionHeader title="Meus feedbacks" subtitle="Histórico de solicitações enviadas" />
      {feedbacks.length === 0 ? (
        <EmptyState icon="chatbox-ellipses-outline" title="Nenhum feedback" message="Seus feedbacks enviados aparecerão aqui." />
      ) : (
        feedbacks.map((fb) => {
          const meta = statusLabel[fb.status] ?? statusLabel.open;
          return (
            <Card key={fb.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{formatDate(fb.created_at)} • {fb.category}</Text>
                <Badge label={meta.label} tone={meta.tone} />
              </View>
              <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>{fb.message}</Text>
              {fb.coach_reply ? (
                <View style={[styles.reply, { backgroundColor: theme.backgroundSelected }]}>
                  <Text style={{ color: Brand.primary, fontSize: 11, fontWeight: '800' }}>RESPOSTA DO PERSONAL</Text>
                  <Text style={{ color: theme.text, fontSize: 13 }}>{fb.coach_reply}</Text>
                </View>
              ) : null}
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
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  catPill: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  dueIcon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  reply: { padding: Spacing.two, borderRadius: Radius.md, gap: 2 },
});
