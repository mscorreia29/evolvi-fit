import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';
import { buildInviteUrl } from '@/lib/invites';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type InviteRow = {
  id: string;
  token: string;
  email: string;
  birth_date: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

type InviteState = 'pending' | 'accepted' | 'expired';

function getState(invite: InviteRow): InviteState {
  if (invite.accepted_at) return 'accepted';
  if (new Date(invite.expires_at).getTime() < Date.now()) return 'expired';
  return 'pending';
}

const stateMeta: Record<InviteState, { label: string; tone: 'success' | 'warning' | 'muted' }> = {
  pending: { label: 'Pendente', tone: 'warning' },
  accepted: { label: 'Aceito', tone: 'success' },
  expired: { label: 'Expirado', tone: 'muted' },
};

export default function InvitesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('student_invites')
      .select('id, token, email, birth_date, accepted_at, expires_at, created_at')
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: false });
    setInvites((data as InviteRow[]) ?? []);
  }, [profile]);

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

  async function handleShare(invite: InviteRow) {
    const url = buildInviteUrl(invite.token);
    await Share.share({
      message: `Olá! Seu acesso ao Evolvi Fit está pronto.\n\nAbra o link para criar sua senha e responder sua anamnese:\n${url}`,
      url,
    });
  }

  async function handleCopy(invite: InviteRow) {
    const url = buildInviteUrl(invite.token);
    const clipboard = (globalThis as { navigator?: { clipboard?: { writeText: (t: string) => Promise<void> } } })
      .navigator?.clipboard;
    if (!clipboard) {
      await Share.share({ message: url });
      return;
    }
    await clipboard.writeText(url);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDelete(invite: InviteRow) {
    setBusyId(invite.id);
    await supabase.from('student_invites').delete().eq('id', invite.id);
    setBusyId(null);
    await load();
  }

  const pending = invites.filter((i) => getState(i) === 'pending').length;

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PhotoHero source={Images.gym} height={180} imagePosition="center" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroLabel}>CONVITES</Text>
            <Text style={styles.heroTitle}>{invites.length} convite(s)</Text>
            <Text style={styles.heroHint}>{pending} pendente(s)</Text>
          </View>
        </View>
      </PhotoHero>

      <Button title="Gerar novo convite" onPress={() => router.push('/personal/novo-aluno')} />

      <SectionHeader title="Histórico de convites" subtitle="Gerencie links enviados aos alunos" />

      {invites.length === 0 ? (
        <EmptyState
          icon="mail-outline"
          title="Nenhum convite enviado"
          message="Gere um link de convite para cadastrar um novo aluno."
          actionLabel="Criar convite"
          onAction={() => router.push('/personal/novo-aluno')}
        />
      ) : (
        invites.map((invite) => {
          const state = getState(invite);
          const meta = stateMeta[state];
          const busy = busyId === invite.id;

          return (
            <Card key={invite.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}>
                  <Ionicons name="mail" size={18} color={Brand.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.email, { color: theme.text }]} numberOfLines={1}>
                    {invite.email}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textSecondary }]}>
                    Criado em {formatDate(invite.created_at)} • expira {formatDate(invite.expires_at)}
                  </Text>
                </View>
                <Badge label={meta.label} tone={meta.tone} />
              </View>

              {state === 'pending' ? (
                <View style={styles.actions}>
                  <Button
                    title={copiedId === invite.id ? 'Copiado!' : 'Copiar link'}
                    variant="secondary"
                    onPress={() => (Platform.OS === 'web' ? handleCopy(invite) : handleShare(invite))}
                    style={styles.actionBtn}
                  />
                  {Platform.OS === 'web' ? (
                    <Button title="Compartilhar" variant="secondary" onPress={() => handleShare(invite)} style={styles.actionBtn} />
                  ) : null}
                  <Pressable
                    onPress={() => handleDelete(invite)}
                    disabled={busy}
                    style={[styles.deleteBtn, { borderColor: theme.border }]}>
                    <Ionicons name="trash-outline" size={18} color={Brand.danger} />
                  </Pressable>
                </View>
              ) : state === 'expired' ? (
                <View style={styles.actions}>
                  <Button title="Gerar novo" variant="secondary" onPress={() => router.push('/personal/novo-aluno')} style={styles.actionBtn} />
                  <Pressable
                    onPress={() => handleDelete(invite)}
                    disabled={busy}
                    style={[styles.deleteBtn, { borderColor: theme.border }]}>
                    <Ionicons name="trash-outline" size={18} color={Brand.danger} />
                  </Pressable>
                </View>
              ) : (
                <Text style={[styles.meta, { color: Brand.success }]}>Aluno vinculado com sucesso.</Text>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroTexts: { flex: 1, gap: 2 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  heroHint: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  card: { gap: Spacing.two },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBox: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  email: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actionBtn: { flex: 1, minHeight: 42 },
  deleteBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

