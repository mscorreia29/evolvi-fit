import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Profile, StudentFeedback } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type Row = StudentFeedback & { student?: Profile | null };

export default function CoachFeedbacksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [replying, setReplying] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('student_feedback')
      .select('*, student:profiles!student_feedback_student_id_fkey(id, full_name)')
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(80);
    if (error) console.warn('feedbacks load error:', error.message);
    setRows((data as any[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function markRead(id: string) {
    await supabase.from('student_feedback').update({ status: 'read' }).eq('id', id).eq('status', 'open');
    await load();
  }

  async function resolve(id: string) {
    await supabase
      .from('student_feedback')
      .update({ status: 'resolved', coach_reply: replyText.trim() || null })
      .eq('id', id);
    setReplying(null);
    setReplyText('');
    await load();
  }

  const statusMeta: Record<string, { label: string; tone: 'success' | 'warning' | 'muted' }> = {
    open: { label: 'Novo', tone: 'warning' },
    read: { label: 'Lido', tone: 'muted' },
    resolved: { label: 'Respondido', tone: 'success' },
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}>
      <PhotoHero source={Images.coach} height={180} glowColor={Brand.accent}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.heroTitle}>Feedbacks</Text>
        <Text style={styles.heroSub}>Solicitações e sugestões dos alunos</Text>
      </PhotoHero>

      <SectionHeader title="Recebidos" subtitle="Notificações de feedback dos seus alunos" />
      {rows.length === 0 ? (
        <EmptyState icon="chatbox-ellipses-outline" title="Nenhum feedback" message="Quando alunos enviarem feedback, aparecerá aqui." />
      ) : (
        rows.map((fb) => {
          const meta = statusMeta[fb.status] ?? statusMeta.open;
          const isReplying = replying === fb.id;
          return (
            <Card key={fb.id} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{fb.student?.full_name ?? 'Aluno'}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                    {formatDate(fb.created_at)} • {fb.category}
                  </Text>
                </View>
                <Badge label={meta.label} tone={meta.tone} />
              </View>
              <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>{fb.message}</Text>
              {fb.coach_reply ? (
                <View style={[styles.reply, { backgroundColor: theme.backgroundSelected }]}>
                  <Text style={{ color: Brand.primary, fontSize: 11, fontWeight: '800' }}>SUA RESPOSTA</Text>
                  <Text style={{ color: theme.text, fontSize: 13 }}>{fb.coach_reply}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' }}>
                {fb.status === 'open' ? (
                  <Pressable onPress={() => markRead(fb.id)} style={[styles.smallBtn, { backgroundColor: theme.backgroundSelected }]}>
                    <Ionicons name="checkmark-done-outline" size={14} color={theme.text} />
                    <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Marcar lido</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => {
                    setReplying(isReplying ? null : fb.id);
                    setReplyText(fb.coach_reply ?? '');
                  }}
                  style={[styles.smallBtn, { backgroundColor: theme.primarySoft }]}>
                  <Ionicons name="return-up-forward-outline" size={14} color={Brand.primary} />
                  <Text style={{ color: Brand.primary, fontSize: 12, fontWeight: '700' }}>Responder</Text>
                </Pressable>
              </View>
              {isReplying ? (
                <View style={{ gap: Spacing.one }}>
                  <TextField value={replyText} onChangeText={setReplyText} placeholder="Escreva uma resposta..." multiline />
                  <Button title="Salvar resposta" onPress={() => resolve(fb.id)} />
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
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  reply: { padding: Spacing.two, borderRadius: Radius.md, gap: 2 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
});

