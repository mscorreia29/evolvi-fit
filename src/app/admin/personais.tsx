import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
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

import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { TextField } from '@/components/ui/text-field';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';


type PersonalRow = Profile & { students_count?: number };

export default function AdminPersonais() {
  const router = useRouter();
  const theme = useTheme();

  const [personals, setPersonals] = useState<PersonalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'personal')
      .order('created_at', { ascending: false });

    const list = (data as PersonalRow[]) ?? [];

    // count students per personal
    const { data: links } = await supabase.from('coach_students').select('coach_id');
    const counts: Record<string, number> = {};
    (links ?? []).forEach((l: any) => {
      counts[l.coach_id] = (counts[l.coach_id] ?? 0) + 1;
    });
    list.forEach((p) => {
      p.students_count = counts[p.id] ?? 0;
    });

    setPersonals(list);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function setStatus(p: PersonalRow, status: 'approved' | 'rejected' | 'trial' | 'blocked', trialDays?: number, reason?: string) {
    setActionId(p.id);
    if (status === 'blocked') {
      await supabase.rpc('admin_block_account', { p_user_id: p.id, p_reason: reason ?? null });
    } else if (p.status === 'blocked') {
      await supabase.rpc('admin_unblock_account', { p_user_id: p.id });
      if (status !== 'approved') {
        await supabase.rpc('admin_set_account_status', { p_user_id: p.id, p_status: status, p_trial_days: trialDays ?? null });
      }
    } else {
      await supabase.rpc('admin_set_account_status', { p_user_id: p.id, p_status: status, p_trial_days: trialDays ?? null });
    }
    setActionId(null);
    await load();
  }

  async function handleApprove(p: PersonalRow) {
    await setStatus(p, 'approved');
  }

  async function handleReject(p: PersonalRow) {
    if (Platform.OS === 'web') {
      await setStatus(p, 'rejected');
      return;
    }
    Alert.alert('Rejeitar conta', `Rejeitar ${p.full_name ?? p.email}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Rejeitar', style: 'destructive', onPress: () => setStatus(p, 'rejected') },
    ]);
  }

  async function handleExtendTrial(p: PersonalRow) {
    await setStatus(p, 'trial', 7);
  }

  async function handleGrantAccess(p: PersonalRow, days = 30) {
    setActionId(p.id);
    await supabase.rpc('admin_grant_access', { p_user_id: p.id, p_days: days, p_notes: null });
    setActionId(null);
    await load();
  }

  async function handleRevokeAccess(p: PersonalRow) {
    setActionId(p.id);
    await supabase.rpc('admin_revoke_access', { p_user_id: p.id, p_reason: 'Acesso expirado / não pago' });
    setActionId(null);
    await load();
  }

  async function handleCreate() {
    if (!newName.trim() || !newEmail.trim() || newPassword.length < 6) {
      setCreateError('Preencha nome, email e senha (mín. 6 caracteres).');
      return;
    }
    setCreateError(null);
    setCreating(true);

    const { error } = await supabase.auth.signUp({
      email: newEmail.trim().toLowerCase(),
      password: newPassword,
      options: {
        data: {
          full_name: newName.trim(),
          role: 'personal',
          admin_created: true,
        },
      },
    });

    setCreating(false);

    if (error) {
      setCreateError(error.message);
      return;
    }

    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setShowCreate(false);
    await load();
  }

  function statusBadge(status: string) {
    if (status === 'approved') return <Badge label="Aprovado" tone="success" />;
    if (status === 'trial') return <Badge label="Teste" tone="warning" />;
    if (status === 'rejected') return <Badge label="Rejeitado" tone="danger" />;
    if (status === 'blocked') return <Badge label="Bloqueado" tone="danger" />;
    return <Badge label="Pendente" tone="muted" />;
  }

  if (loading) return <Loading label="Carregando personais..." />;

  return (
    <Screen>
      <PhotoHero source={Images.coach} height={180} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Personais</Text>
            <Text style={styles.heroSub}>{personals.length} cadastrado(s)</Text>
          </View>
          <Pressable onPress={() => setShowCreate(true)} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </PhotoHero>

      {personals.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Nenhum personal"
          message="Crie a primeira conta de personal ou aguarde cadastros."
          actionLabel="Criar personal"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        personals.map((p) => (
          <Card key={p.id} style={styles.card}>
            <View style={styles.row}>
              <Avatar name={p.full_name} size={44} />
              <View style={styles.info}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {p.full_name ?? 'Sem nome'}
                </Text>
                <Text style={[styles.email, { color: theme.textSecondary }]} numberOfLines={1}>
                  {p.email}
                </Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  {p.students_count} aluno(s) • {new Date(p.created_at).toLocaleDateString('pt-BR')}
                </Text>
                {p.status === 'trial' && p.trial_ends_at ? (
                  <Text style={[styles.trial, { color: Brand.warning }]}>
                    Teste até {new Date(p.trial_ends_at).toLocaleDateString('pt-BR')}
                  </Text>
                ) : null}
                {p.status === 'approved' && p.paid_until ? (
                  <Text style={[styles.trial, { color: Brand.primary }]}>
                    Acesso até {new Date(p.paid_until).toLocaleDateString('pt-BR')}
                    {p.last_payment_at ? ` • pago em ${new Date(p.last_payment_at).toLocaleDateString('pt-BR')}` : ''}
                  </Text>
                ) : null}
                {p.status === 'approved' && !p.paid_until ? (
                  <Text style={[styles.trial, { color: Brand.success }]}>Acesso ilimitado</Text>
                ) : null}
              </View>
              {statusBadge(p.status)}
            </View>

            <View style={styles.actions}>
              <Button
                title="Liberar 30 dias"
                onPress={() => handleGrantAccess(p, 30)}
                loading={actionId === p.id}
                disabled={actionId !== null}
              />
              {p.status !== 'approved' && p.status !== 'blocked' ? (
                <Button
                  title="Aprovar"
                  onPress={() => handleApprove(p)}
                  loading={actionId === p.id}
                  disabled={actionId !== null}
                />
              ) : null}
              {p.status === 'trial' ? (
                <Button
                  title="+7 dias teste"
                  variant="secondary"
                  onPress={() => handleExtendTrial(p)}
                  disabled={actionId !== null}
                />
              ) : null}
              {p.status !== 'rejected' && p.status !== 'blocked' ? (
                <Button
                  title="Rejeitar"
                  variant="danger"
                  onPress={() => handleReject(p)}
                  disabled={actionId !== null}
                />
              ) : null}
              {p.status === 'blocked' ? (
                <Button
                  title="Desbloquear"
                  variant="secondary"
                  onPress={() => setStatus(p, 'approved')}
                  disabled={actionId !== null}
                />
              ) : (
                <Button
                  title="Bloquear"
                  variant="danger"
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      const reason = window.prompt('Motivo do bloqueio (opcional):') ?? undefined;
                      setStatus(p, 'blocked', undefined, reason || undefined);
                    } else {
                      setStatus(p, 'blocked');
                    }
                  }}
                  disabled={actionId !== null}
                />
              )}
              {p.status === 'approved' && p.paid_until ? (
                <Button
                  title="Revogar acesso"
                  variant="danger"
                  onPress={() => handleRevokeAccess(p)}
                  disabled={actionId !== null}
                />
              ) : null}
            </View>
            {p.block_reason ? (
              <Text style={[styles.blockReason, { color: Brand.danger }]}>Motivo: {p.block_reason}</Text>
            ) : null}
            {actionId === p.id ? <ActivityIndicator size="small" color={Brand.primary} /> : null}
          </Card>
        ))
      )}

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Novo personal (aprovado)</Text>
              <Pressable onPress={() => setShowCreate(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <TextField label="Nome completo" value={newName} onChangeText={setNewName} placeholder="Nome" />
            <TextField label="Email" value={newEmail} onChangeText={setNewEmail} placeholder="email@ex.com" autoCapitalize="none" keyboardType="email-address" />
            <TextField label="Senha inicial" value={newPassword} onChangeText={setNewPassword} placeholder="mín. 6 caracteres" secureTextEntry />
            {createError ? <Text style={[styles.error, { color: Brand.danger }]}>{createError}</Text> : null}
            <Button title="Criar conta" onPress={handleCreate} loading={creating} />
          </View>
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
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
    fontSize: 16,
    fontWeight: '800',
  },
  email: {
    fontSize: 13,
  },
  meta: {
    fontSize: 12,
  },
  trial: {
    fontSize: 12,
    fontWeight: '700',
  },
  blockReason: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
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
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
});
