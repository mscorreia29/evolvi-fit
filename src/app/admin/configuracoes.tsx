import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { TextField } from '@/components/ui/text-field';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { AdminSettings } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useFocusEffect } from 'expo-router';

export default function AdminConfiguracoes() {
  const router = useRouter();
  const theme = useTheme();
  const { profile } = useAuth();

  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [trialDays, setTrialDays] = useState('7');
  const [autoBlock, setAutoBlock] = useState(true);
  const [selfSignup, setSelfSignup] = useState(true);
  const [maxStudents, setMaxStudents] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('admin_settings').select('*').maybeSingle();
    const s = (data as AdminSettings | null) ?? null;
    setSettings(s);
    if (s) {
      setTrialDays(String(s.default_trial_days));
      setAutoBlock(s.auto_block_expired_trials);
      setSelfSignup(s.allow_self_signup);
      setMaxStudents(s.max_students_per_personal != null ? String(s.max_students_per_personal) : '');
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSave() {
    const td = parseInt(trialDays, 10);
    if (!Number.isFinite(td) || td < 1 || td > 90) {
      setError('Dias de teste deve ser entre 1 e 90.');
      return;
    }
    const ms = maxStudents.trim() ? parseInt(maxStudents, 10) : null;
    if (ms != null && (!Number.isFinite(ms) || ms < 1)) {
      setError('Máx. alunos por personal inválido.');
      return;
    }
    setError(null);
    setMessage(null);
    setSaving(true);
    const { error: rpcError } = await supabase.rpc('admin_update_settings', {
      p_default_trial_days: td,
      p_auto_block_expired_trials: autoBlock,
      p_allow_self_signup: selfSignup,
      p_max_students_per_personal: ms,
    });
    setSaving(false);
    if (rpcError) {
      setError('Não foi possível salvar. Verifique o SQL de admin v2.');
      return;
    }
    setMessage('Configurações salvas.');
    await load();
  }

  if (loading) return <Loading label="Carregando configurações..." />;

  return (
    <Screen>
      <PhotoHero source={Images.coach} height={180} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Configurações</Text>
            <Text style={styles.heroSub}>Regras globais do sistema</Text>
          </View>
        </View>
      </PhotoHero>

      <Card>
        <SectionHeader title="Período de teste" subtitle="Aplicado a novos personais cadastrados" />
        <TextField
          label="Dias de teste padrão"
          value={trialDays}
          onChangeText={setTrialDays}
          keyboardType="number-pad"
        />
      </Card>

      <Card>
        <SectionHeader title="Cadastro" subtitle="Controle de auto-cadastro de personais" />
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[styles.toggleTitle, { color: theme.text }]}>Permitir auto-cadastro</Text>
            <Text style={[styles.toggleHint, { color: theme.textSecondary }]}>
              Se desativado, novos personais entram como &quot;pendente&quot; e precisam de aprovação manual.
            </Text>
          </View>
          <Pressable
            onPress={() => setSelfSignup((v) => !v)}
            style={[styles.toggle, { backgroundColor: selfSignup ? Brand.primary : theme.backgroundSelected }]}>
            <View style={[styles.toggleKnob, { transform: [{ translateX: selfSignup ? 18 : 0 }] }]} />
          </Pressable>
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[styles.toggleTitle, { color: theme.text }]}>Bloquear teste expirado automaticamente</Text>
            <Text style={[styles.toggleHint, { color: theme.textSecondary }]}>
              Personais com teste vencido perdem acesso até aprovação.
            </Text>
          </View>
          <Pressable
            onPress={() => setAutoBlock((v) => !v)}
            style={[styles.toggle, { backgroundColor: autoBlock ? Brand.primary : theme.backgroundSelected }]}>
            <View style={[styles.toggleKnob, { transform: [{ translateX: autoBlock ? 18 : 0 }] }]} />
          </Pressable>
        </View>
      </Card>

      <Card>
        <SectionHeader title="Limites" subtitle="Restrições opcionais" />
        <TextField
          label="Máx. alunos por personal (vazio = sem limite)"
          value={maxStudents}
          onChangeText={setMaxStudents}
          keyboardType="number-pad"
          placeholder="Ex.: 30"
        />
      </Card>

      {error ? <Text style={[styles.msg, { color: Brand.danger }]}>{error}</Text> : null}
      {message ? <Text style={[styles.msg, { color: Brand.success }]}>{message}</Text> : null}

      <Button title="Salvar configurações" onPress={handleSave} loading={saving} />

      {settings ? (
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          Última atualização: {new Date(settings.updated_at).toLocaleString('pt-BR')}
        </Text>
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: Radius.full,
    padding: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
  },
  msg: {
    fontSize: 13,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    textAlign: 'center',
  },
});
