import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
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
import {
  fetchAiSettings,
  fetchAiStudents,
  saveAiSettings,
  unlockAiRegeneration,
  type AiProvider,
  type AiSettings,
  type AiStudent,
} from '@/lib/ai';

export default function AdminIaScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [students, setStudents] = useState<{ autonomous: AiStudent[]; linked: AiStudent[] }>({
    autonomous: [],
    linked: [],
  });
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [promptBase, setPromptBase] = useState('');
  const [intervalDays, setIntervalDays] = useState('30');
  const [manualRegeneration, setManualRegeneration] = useState(false);
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [settingsData, studentsData] = await Promise.all([fetchAiSettings(), fetchAiStudents()]);
      setSettings(settingsData);
      setStudents(studentsData);
      if (settingsData) {
        setEnabled(settingsData.enabled);
        setProvider(settingsData.provider);
        setPromptBase(settingsData.prompt_base);
        setIntervalDays(String(settingsData.generation_interval_days));
        setManualRegeneration(settingsData.allow_manual_regeneration);
        setModel(settingsData.model ?? '');
      }
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Execute supabase/upgrade_ai_autonomo.sql para habilitar este módulo.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSave() {
    const days = parseInt(intervalDays, 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      setError('O intervalo deve estar entre 1 e 365 dias.');
      return;
    }

    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await saveAiSettings({
        enabled,
        provider,
        apiKey,
        clearApiKey,
        promptBase,
        generationIntervalDays: days,
        allowManualRegeneration: manualRegeneration,
        model,
      });
      setApiKey('');
      setClearApiKey(false);
      setMessage('Configurações de IA salvas.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlock(studentId: string) {
    setError(null);
    setMessage(null);
    try {
      await unlockAiRegeneration(studentId);
      setMessage('Regeneração liberada para o aluno.');
      await load();
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Não foi possível liberar.');
    }
  }

  if (loading) {
    return <Loading label="Carregando configurações de IA..." />;
  }

  return (
    <Screen>
      <PhotoHero source={Images.coach} height={180} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Alunos com IA</Text>
            <Text style={styles.heroSub}>Cadastro autônomo e geração de treinos</Text>
          </View>
        </View>
      </PhotoHero>

      {error ? <Text style={[styles.message, { color: Brand.danger }]}>{error}</Text> : null}
      {message ? <Text style={[styles.message, { color: Brand.success }]}>{message}</Text> : null}

      <Card>
        <SectionHeader
          title="Módulo de IA"
          subtitle="Ative o cadastro autônomo e configure o provedor"
        />
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[styles.toggleTitle, { color: theme.text }]}>Habilitar cadastro com IA</Text>
            <Text style={[styles.toggleHint, { color: theme.textSecondary }]}>
              Quando desativado, o cadastro autônomo fica bloqueado.
            </Text>
          </View>
          <Pressable
            onPress={() => setEnabled((value) => !value)}
            style={[styles.toggle, { backgroundColor: enabled ? Brand.primary : theme.backgroundSelected }]}>
            <View style={[styles.toggleKnob, { transform: [{ translateX: enabled ? 18 : 0 }] }]} />
          </Pressable>
        </View>

        <Text style={[styles.label, { color: theme.textSecondary }]}>Provedor</Text>
        <View style={styles.providerRow}>
          {(['gemini', 'openai'] as AiProvider[]).map((option) => (
            <Pressable
              key={option}
              onPress={() => setProvider(option)}
              style={[
                styles.providerButton,
                {
                  borderColor: provider === option ? Brand.primary : theme.border,
                  backgroundColor: provider === option ? theme.primarySoft : theme.backgroundSelected,
                },
              ]}>
              <Text
                style={[
                  styles.providerText,
                  { color: provider === option ? Brand.primary : theme.textSecondary },
                ]}>
                {option === 'gemini' ? 'Gemini' : 'OpenAI'}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextField
          label="Chave de API"
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={settings?.api_key ? 'Chave configurada — deixe vazio para manter' : 'Cole sua chave'}
          secureTextEntry
          autoCapitalize="none"
        />
        {settings?.api_key ? (
          <Pressable onPress={() => setClearApiKey((value) => !value)} style={styles.checkRow}>
            <Ionicons
              name={clearApiKey ? 'checkbox' : 'square-outline'}
              size={18}
              color={clearApiKey ? Brand.primary : theme.textSecondary}
            />
            <Text style={[styles.checkText, { color: theme.textSecondary }]}>Limpar chave salva</Text>
          </Pressable>
        ) : null}

        <TextField
          label="Modelo (opcional)"
          value={model}
          onChangeText={setModel}
          placeholder={provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'}
          autoCapitalize="none"
        />
        <TextField
          label="Intervalo entre gerações (dias)"
          value={intervalDays}
          onChangeText={setIntervalDays}
          keyboardType="number-pad"
        />

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[styles.toggleTitle, { color: theme.text }]}>Regeneração livre</Text>
            <Text style={[styles.toggleHint, { color: theme.textSecondary }]}>
              Se ativo, o aluno pode gerar outro treino sem respeitar o intervalo.
            </Text>
          </View>
          <Pressable
            onPress={() => setManualRegeneration((value) => !value)}
            style={[
              styles.toggle,
              { backgroundColor: manualRegeneration ? Brand.primary : theme.backgroundSelected },
            ]}>
            <View
              style={[styles.toggleKnob, { transform: [{ translateX: manualRegeneration ? 18 : 0 }] }]}
            />
          </Pressable>
        </View>

        <TextField
          label="Prompt base"
          value={promptBase}
          onChangeText={setPromptBase}
          placeholder="Instruções para a IA"
          multiline
          style={styles.textArea}
        />

        <Button title="Salvar configurações de IA" onPress={handleSave} loading={saving} />
      </Card>

      <Card>
        <SectionHeader
          title="Alunos autônomos"
          subtitle={`${students.autonomous.length} aluno(s) gerado(s) por IA`}
        />
        {students.autonomous.length ? (
          students.autonomous.map((student) => (
            <View key={student.id} style={[styles.studentRow, { borderColor: theme.border }]}>
              <View style={styles.studentInfo}>
                <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>
                  {student.full_name || student.email || 'Sem nome'}
                </Text>
                <Text style={[styles.studentMeta, { color: theme.textSecondary }]}>
                  {student.ai_generation_count} geração(ões)
                  {student.ai_last_generated_at
                    ? ` · ${new Date(student.ai_last_generated_at).toLocaleDateString('pt-BR')}`
                    : ' · ainda sem treino'}
                </Text>
              </View>
              <Badge
                label={student.ai_regeneration_unlocked ? 'Liberado' : 'Bloqueado'}
                tone={student.ai_regeneration_unlocked ? 'success' : 'muted'}
              />
              {!student.ai_regeneration_unlocked ? (
                <Pressable onPress={() => handleUnlock(student.id)} style={styles.unlockButton}>
                  <Ionicons name="lock-open-outline" size={16} color={Brand.primary} />
                </Pressable>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>
            Nenhum aluno autônomo cadastrado ainda.
          </Text>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Alunos vinculados"
          subtitle={`${students.linked.length} aluno(s) com personal trainer`}
        />
        {students.linked.length ? (
          students.linked.slice(0, 20).map((student) => (
            <View key={student.id} style={styles.linkedRow}>
              <Text style={[styles.linkedName, { color: theme.text }]} numberOfLines={1}>
                {student.full_name || student.email || 'Sem nome'}
              </Text>
              <Badge label="Personal" tone="warning" />
            </View>
          ))
        ) : (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>
            Nenhum aluno vinculado encontrado.
          </Text>
        )}
      </Card>
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
  message: {
    fontSize: 13,
    fontWeight: '600',
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
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  providerRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  providerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  providerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  checkText: {
    fontSize: 12,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: 1,
    paddingVertical: Spacing.two,
  },
  studentInfo: {
    flex: 1,
    gap: 2,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
  },
  studentMeta: {
    fontSize: 11,
  },
  unlockButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  linkedName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    fontSize: 12,
    paddingVertical: Spacing.two,
  },
});
