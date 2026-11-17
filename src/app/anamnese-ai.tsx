import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
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
import {
  generateAiWorkout,
  saveAutonomousAnamnesis,
  type AutonomousAnamnesis,
} from '@/lib/ai';
import { useAuth } from '@/providers/auth-provider';

export default function AnamneseAiScreen() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  const [fullName, setFullName] = useState(
    profile?.full_name ?? session?.user.user_metadata?.full_name ?? '',
  );
  const [objective, setObjective] = useState('');
  const [level, setLevel] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('3');
  const [sessionMinutes, setSessionMinutes] = useState('50');
  const [location, setLocation] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [injuries, setInjuries] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [notes, setNotes] = useState('');
  const [anamnesisSaved, setAnamnesisSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAutonomous = Boolean(
    (profile as unknown as { is_autonomous?: boolean } | null)?.is_autonomous,
  );

  async function handleSubmit() {
    const days = parseInt(daysPerWeek, 10);
    const minutes = parseInt(sessionMinutes, 10);
    const studentAge = parseInt(age, 10);
    const weightKg = parseFloat(weight.replace(',', '.'));
    const heightCm = parseFloat(height.replace(',', '.'));

    if (
      !fullName.trim() ||
      !objective.trim() ||
      !level.trim() ||
      !location.trim() ||
      !restrictions.trim() ||
      !injuries.trim()
    ) {
      setError('Preencha todos os campos de texto da anamnese. Use "Nenhuma" quando não houver restrição ou lesão.');
      return;
    }
    if (!Number.isFinite(days) || days < 1 || days > 7) {
      setError('Informe de 1 a 7 dias de treino por semana.');
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 20 || minutes > 180) {
      setError('Informe uma duração entre 20 e 180 minutos.');
      return;
    }
    if (!Number.isFinite(studentAge) || studentAge < 12 || studentAge > 100) {
      setError('Informe uma idade válida.');
      return;
    }
    if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300) {
      setError('Informe um peso válido em kg.');
      return;
    }
    if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) {
      setError('Informe uma altura válida em cm.');
      return;
    }

    const payload: AutonomousAnamnesis = {
      full_name: fullName.trim(),
      objective: objective.trim(),
      level: level.trim(),
      days_per_week: days,
      session_minutes: minutes,
      location: location.trim(),
      restrictions: restrictions.trim(),
      injuries: injuries.trim(),
      age: studentAge,
      weight_kg: weightKg,
      height_cm: heightCm,
      notes: notes.trim(),
    };

    setError(null);
    setSaving(true);
    try {
      if (!anamnesisSaved && session?.user.id) {
        await saveAutonomousAnamnesis(session.user.id, payload);
        setAnamnesisSaved(true);
      }
      await generateAiWorkout(payload);
      router.replace('/aluno' as never);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Não foi possível gerar seu treino.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Loading label="Carregando..." />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Loading label="Carregando perfil..." />;
  }

  if (!isAutonomous) {
    return <Redirect href="/aluno" />;
  }

  return (
    <Screen>
      <PhotoHero source={Images.coach} height={180} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Anamnese com IA</Text>
            <Text style={styles.heroSub}>Seus dados viram um treino personalizado</Text>
          </View>
        </View>
      </PhotoHero>

      <Card>
        <SectionHeader title="Sobre você" subtitle="Usamos essas respostas para montar seu plano" />
        <TextField
          label="Nome completo"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Seu nome"
        />
        <View style={styles.row}>
          <View style={styles.field}>
            <TextField
              label="Idade"
              value={age}
              onChangeText={setAge}
              placeholder="Ex.: 32"
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.field}>
            <TextField
              label="Peso (kg)"
              value={weight}
              onChangeText={setWeight}
              placeholder="Ex.: 74"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.field}>
            <TextField
              label="Altura (cm)"
              value={height}
              onChangeText={setHeight}
              placeholder="Ex.: 175"
              keyboardType="number-pad"
            />
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader title="Objetivo e rotina" />
        <TextField
          label="Objetivo principal"
          value={objective}
          onChangeText={setObjective}
          placeholder="Ex.: ganhar massa muscular, emagrecer, melhorar condicionamento"
        />
        <TextField
          label="Nível de experiência"
          value={level}
          onChangeText={setLevel}
          placeholder="Ex.: iniciante, intermediário ou avançado"
        />
        <View style={styles.row}>
          <View style={styles.field}>
            <TextField
              label="Dias por semana"
              value={daysPerWeek}
              onChangeText={setDaysPerWeek}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.field}>
            <TextField
              label="Minutos por sessão"
              value={sessionMinutes}
              onChangeText={setSessionMinutes}
              keyboardType="number-pad"
            />
          </View>
        </View>
        <TextField
          label="Local de treino"
          value={location}
          onChangeText={setLocation}
          placeholder="Ex.: academia, casa, parque"
        />
      </Card>

      <Card>
        <SectionHeader title="Segurança" subtitle="Essencial para uma IA gerar treinos adequados" />
        <TextField
          label="Restrições"
          value={restrictions}
          onChangeText={setRestrictions}
          placeholder='Ex.: "Nenhuma" ou problemas de joelho'
        />
        <TextField
          label="Lesões ou dores"
          value={injuries}
          onChangeText={setInjuries}
          placeholder='Ex.: "Nenhuma" ou lombalgia'
        />
        <TextField
          label="Observações extras"
          value={notes}
          onChangeText={setNotes}
          placeholder="Ex.: tenho disponibilidade à noite, prefiro treinos sem impacto"
          multiline
          style={styles.textArea}
        />
      </Card>

      {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}
      {anamnesisSaved ? (
        <Text style={[styles.saved, { color: Brand.success }]}>
          Anamnese salva. Você pode tentar gerar o treino novamente.
        </Text>
      ) : null}

      <Button
        title={anamnesisSaved ? 'Gerar meu treino' : 'Salvar e gerar meu treino'}
        onPress={handleSubmit}
        loading={saving}
      />
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
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  field: {
    flex: 1,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  saved: {
    fontSize: 13,
    fontWeight: '600',
  },
});
