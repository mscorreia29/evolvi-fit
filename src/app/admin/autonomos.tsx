import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
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
import { unlockAiMealRegeneration, unlockAiRegeneration } from '@/lib/ai';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type Status = 'approved' | 'rejected' | 'trial' | 'blocked';

export default function AdminAutonomos() {
  const router = useRouter();
  const theme = useTheme();

  const [alunos, setAlunos] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const [account, setAccount] = useState<Profile | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountNotes, setAccountNotes] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountMsg, setAccountMsg] = useState<string | null>(null);

  const [grant, setGrant] = useState<Profile | null>(null);
  const [grantDays, setGrantDays] = useState(30);
  const [grantAmount, setGrantAmount] = useState('');
  const [grantNotes, setGrantNotes] = useState('');
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_autonomous', true)
      .order('created_at', { ascending: false });
    if (error) setPageError(error.message);
    else {
      setPageError(null);
      setAlunos((data as Profile[]) ?? []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function setStatus(aluno: Profile, status: Status, reason?: string) {
    setActionId(aluno.id);
    setPageError(null);
    if (status === 'blocked') {
      const { error } = await supabase.rpc('admin_block_account', {
        p_user_id: aluno.id,
        p_reason: reason ?? null,
      });
      if (error) setPageError(error.message);
    } else if (aluno.status === 'blocked') {
      const { error } = await supabase.rpc('admin_unblock_account', { p_user_id: aluno.id });
      if (error) setPageError(error.message);
      if (status !== 'approved') {
        const { error: statusError } = await supabase.rpc('admin_set_account_status', {
          p_user_id: aluno.id,
          p_status: status,
          p_trial_days: status === 'trial' ? 7 : null,
        });
        if (statusError) setPageError(statusError.message);
      }
    } else {
      const { error } = await supabase.rpc('admin_set_account_status', {
        p_user_id: aluno.id,
        p_status: status,
        p_trial_days: status === 'trial' ? 7 : null,
      });
      if (error) setPageError(error.message);
    }
    setActionId(null);
    await load();
  }

  function askBlock(aluno: Profile) {
    if (Platform.OS === 'web') {
      const reason = window.prompt('Motivo do bloqueio (opcional):') ?? undefined;
      void setStatus(aluno, 'blocked', reason || undefined);
      return;
    }
    Alert.alert('Bloquear autônomo', `Bloquear ${aluno.full_name ?? aluno.email}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Bloquear', style: 'destructive', onPress: () => void setStatus(aluno, 'blocked') },
    ]);
  }

  async function revokeAccess(aluno: Profile) {
    setActionId(aluno.id);
    const { error } = await supabase.rpc('admin_revoke_access', {
      p_user_id: aluno.id,
      p_reason: 'Assinatura vencida ou não paga',
    });
    setActionId(null);
    if (error) setPageError(error.message);
    await load();
  }

  async function unlockAi(aluno: Profile) {
    setActionId(aluno.id);
    setPageError(null);
    try {
      await Promise.all([
        unlockAiRegeneration(aluno.id),
        unlockAiMealRegeneration(aluno.id),
      ]);
    } catch (unlockError) {
      setPageError(
        unlockError instanceof Error ? unlockError.message : 'Não foi possível destravar a IA.',
      );
    }
    setActionId(null);
    await load();
  }

  function openAccount(aluno: Profile) {
    setAccount(aluno);
    setAccountName(aluno.full_name ?? '');
    setAccountEmail(aluno.email ?? '');
    setAccountPassword('');
    setAccountNotes(aluno.payment_notes ?? '');
    setAccountError(null);
    setAccountMsg(null);
  }

  async function saveAccount() {
    if (!account) return;
    if (!accountName.trim() || !accountEmail.trim()) {
      setAccountError('Informe nome e email.');
      return;
    }
    if (accountPassword && accountPassword.length < 6) {
      setAccountError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setAccountBusy(true);
    setAccountError(null);
    setAccountMsg(null);

    const { error: nameError } = await supabase
      .from('profiles')
      .update({ full_name: accountName.trim() })
      .eq('id', account.id);
    if (nameError) {
      setAccountBusy(false);
      setAccountError(nameError.message);
      return;
    }

    if (accountEmail.trim() !== (account.email ?? '')) {
      const { error } = await supabase.rpc('admin_update_user_email', {
        p_user_id: account.id,
        p_new_email: accountEmail.trim().toLowerCase(),
      });
      if (error) {
        setAccountBusy(false);
        setAccountError('Não foi possível alterar o email.');
        return;
      }
    }

    if (accountPassword) {
      const { error } = await supabase.rpc('admin_reset_user_password', {
        p_user_id: account.id,
        p_new_password: accountPassword,
      });
      if (error) {
        setAccountBusy(false);
        setAccountError('Não foi possível redefinir a senha.');
        return;
      }
    }

    if (accountNotes !== (account.payment_notes ?? '')) {
      const { error } = await supabase.rpc('admin_set_payment_notes', {
        p_user_id: account.id,
        p_notes: accountNotes.trim() || null,
      });
      if (error) {
        setAccountBusy(false);
        setAccountError('Não foi possível salvar as observações.');
        return;
      }
    }

    setAccountBusy(false);
    setAccountMsg('Dados salvos com sucesso.');
    setAccountPassword('');
    await load();
  }

  function openGrant(aluno: Profile) {
    setGrant(aluno);
    setGrantDays(30);
    setGrantAmount('');
    setGrantNotes('Pagamento recebido');
    setGrantError(null);
  }

  async function confirmGrant() {
    if (!grant) return;
    const amount = Number(grantAmount.replace(',', '.'));
    if (grantAmount.trim() && (!Number.isFinite(amount) || amount <= 0)) {
      setGrantError('Informe um valor válido ou deixe em branco.');
      return;
    }

    setGrantBusy(true);
    setGrantError(null);
    const notes = grantNotes.trim() || 'Pagamento recebido';
    const { error } = await supabase.rpc('admin_grant_access', {
      p_user_id: grant.id,
      p_days: grantDays,
      p_notes: notes,
    });
    if (error) {
      setGrantBusy(false);
      setGrantError(error.message);
      return;
    }

    if (amount > 0) {
      const { error: dueError } = await supabase.from('payment_dues').insert({
        coach_id: grant.id,
        student_id: grant.id,
        description: `Assinatura autônoma (${grantDays} dias)`,
        amount,
        due_date: new Date().toISOString().slice(0, 10),
        status: 'paid',
        paid_at: new Date().toISOString(),
        notes,
      });
      if (dueError) {
        setGrantBusy(false);
        setGrantError(`Acesso liberado, mas falhou ao registrar a cobrança: ${dueError.message}`);
        await load();
        return;
      }
    }

    setGrantBusy(false);
    setGrant(null);
    await load();
  }

  function statusBadge(status: string) {
    if (status === 'approved') return <Badge label="Ativo" tone="success" />;
    if (status === 'trial') return <Badge label="Teste" tone="warning" />;
    if (status === 'blocked') return <Badge label="Bloqueado" tone="danger" />;
    if (status === 'rejected') return <Badge label="Rejeitado" tone="danger" />;
    return <Badge label="Pendente" tone="muted" />;
  }

  if (loading) return <Loading label="Carregando autônomos..." />;

  return (
    <Screen>
      <PhotoHero source={Images.student} height={180} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Alunos autônomos</Text>
            <Text style={styles.heroSub}>{alunos.length} cadastro(s) com IA</Text>
          </View>
        </View>
      </PhotoHero>

      {pageError ? <Text style={[styles.pageError, { color: Brand.danger }]}>{pageError}</Text> : null}

      {alunos.length === 0 ? (
        <EmptyState
          icon="sparkles-outline"
          title="Nenhum autônomo"
          message="Os cadastros feitos pelo formulário de IA aparecem aqui."
        />
      ) : (
        alunos.map((aluno) => (
          <Card key={aluno.id} style={styles.card}>
            <View style={styles.row}>
              <Avatar name={aluno.full_name} size={44} />
              <View style={styles.info}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {aluno.full_name ?? 'Sem nome'}
                </Text>
                <Text style={[styles.email, { color: theme.textSecondary }]} numberOfLines={1}>
                  {aluno.email}
                </Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={2}>
                  Treinos {aluno.ai_generation_count ?? 0}x • plano IA{' '}
                  {aluno.ai_meal_generation_count ?? 0}x • desde{' '}
                  {new Date(aluno.created_at).toLocaleDateString('pt-BR')}
                </Text>
                {aluno.status === 'trial' && aluno.trial_ends_at ? (
                  <Text style={[styles.access, { color: Brand.warning }]}>
                    Teste até {new Date(aluno.trial_ends_at).toLocaleDateString('pt-BR')}
                  </Text>
                ) : null}
                {aluno.status === 'approved' && aluno.paid_until ? (
                  <Text style={[styles.access, { color: Brand.primary }]}>
                    Assinatura até {new Date(aluno.paid_until).toLocaleDateString('pt-BR')}
                    {aluno.last_payment_at
                      ? ` • pago em ${new Date(aluno.last_payment_at).toLocaleDateString('pt-BR')}`
                      : ''}
                  </Text>
                ) : null}
                {aluno.payment_notes ? (
                  <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={2}>
                    {aluno.payment_notes}
                  </Text>
                ) : null}
                {aluno.block_reason ? (
                  <Text style={[styles.blockReason, { color: Brand.danger }]}>
                    Motivo: {aluno.block_reason}
                  </Text>
                ) : null}
              </View>
              {statusBadge(aluno.status)}
            </View>

            <View style={styles.actions}>
              <Button
                title="Editar"
                variant="secondary"
                onPress={() => openAccount(aluno)}
                disabled={actionId !== null}
              />
              <Button
                title="Registrar pagamento"
                onPress={() => openGrant(aluno)}
                disabled={actionId !== null}
              />
              {aluno.status === 'trial' ? (
                <Button
                  title="+7 dias teste"
                  variant="secondary"
                  onPress={() => setStatus(aluno, 'trial')}
                  disabled={actionId !== null}
                />
              ) : null}
              {aluno.status === 'blocked' ? (
                <Button
                  title="Desbloquear"
                  variant="secondary"
                  onPress={() => setStatus(aluno, 'approved')}
                  disabled={actionId !== null}
                />
              ) : (
                <Button
                  title="Bloquear"
                  variant="danger"
                  onPress={() => askBlock(aluno)}
                  disabled={actionId !== null}
                />
              )}
              {aluno.status === 'approved' && aluno.paid_until ? (
                <Button
                  title="Revogar acesso"
                  variant="danger"
                  onPress={() => revokeAccess(aluno)}
                  disabled={actionId !== null}
                />
              ) : null}
              <Button
                title="Destravar IA"
                variant="secondary"
                onPress={() => unlockAi(aluno)}
                loading={actionId === aluno.id}
                disabled={actionId !== null}
              />
            </View>
          </Card>
        ))
      )}

      <Modal visible={Boolean(account)} transparent animationType="fade" onRequestClose={() => setAccount(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAccount(null)}>
            <Pressable
              style={[
                styles.modalCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
              onPress={() => undefined}>
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Editar autônomo</Text>
                  <Pressable onPress={() => setAccount(null)} hitSlop={8}>
                    <Ionicons name="close" size={22} color={theme.textSecondary} />
                  </Pressable>
                </View>
                <TextField label="Nome" value={accountName} onChangeText={setAccountName} />
                <TextField
                  label="Email"
                  value={accountEmail}
                  onChangeText={setAccountEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextField
                  label="Nova senha (opcional)"
                  value={accountPassword}
                  onChangeText={setAccountPassword}
                  secureTextEntry
                  placeholder="mín. 6 caracteres"
                />
                <TextField
                  label="Observações de pagamento"
                  value={accountNotes}
                  onChangeText={setAccountNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                {accountError ? (
                  <Text style={[styles.modalError, { color: Brand.danger }]}>{accountError}</Text>
                ) : null}
                {accountMsg ? (
                  <Text style={[styles.modalError, { color: Brand.success }]}>{accountMsg}</Text>
                ) : null}
                <Button
                  title="Salvar alterações"
                  onPress={() => void saveAccount()}
                  loading={accountBusy}
                  disabled={accountBusy}
                />
              </ScrollView>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={Boolean(grant)} transparent animationType="fade" onRequestClose={() => setGrant(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setGrant(null)}>
            <Pressable
              style={[
                styles.modalCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
              onPress={() => undefined}>
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Registrar pagamento</Text>
                  <Pressable onPress={() => setGrant(null)} hitSlop={8}>
                    <Ionicons name="close" size={22} color={theme.textSecondary} />
                  </Pressable>
                </View>
                <Text style={[styles.modalStudent, { color: theme.textSecondary }]}>
                  {grant?.full_name ?? 'Aluno'} • {grant?.email ?? ''}
                </Text>
                <Text style={[styles.sectionLabel, { color: theme.text }]}>Período liberado</Text>
                <View style={styles.chipRow}>
                  {[7, 15, 30, 60, 90].map((days) => (
                    <Pressable
                      key={days}
                      onPress={() => setGrantDays(days)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: grantDays === days ? Brand.primary : theme.backgroundElement,
                          borderColor: grantDays === days ? Brand.primary : theme.border,
                        },
                      ]}>
                      <Text
                        style={{
                          color: grantDays === days ? '#FFFFFF' : theme.text,
                          fontSize: 12,
                          fontWeight: '700',
                        }}>
                        {days} dias
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextField
                  label="Valor recebido (R$ - opcional)"
                  value={grantAmount}
                  onChangeText={setGrantAmount}
                  keyboardType="decimal-pad"
                  placeholder="49,90"
                />
                <TextField
                  label="Observação"
                  value={grantNotes}
                  onChangeText={setGrantNotes}
                  placeholder="Pagamento recebido"
                />
                {grantError ? (
                  <Text style={[styles.modalError, { color: Brand.danger }]}>{grantError}</Text>
                ) : null}
                <Button
                  title="Liberar acesso"
                  onPress={() => void confirmGrant()}
                  loading={grantBusy}
                  disabled={grantBusy}
                />
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
  pageError: {
    fontSize: 13,
    fontWeight: '700',
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
  access: {
    fontSize: 12,
    fontWeight: '800',
  },
  blockReason: {
    fontSize: 12,
    fontWeight: '700',
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  modalError: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
});
