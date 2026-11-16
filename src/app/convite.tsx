import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/ui/auth-shell';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  dateInputToISO,
  getInvite,
  isoToDateInput,
  maskDateInput,
  registerWithInvite,
  type AnamnesisAnswers,
  type InviteInfo,
} from '@/lib/invites';

const GOALS = [
  'Hipertrofia',
  'Emagrecimento',
  'Condicionamento',
  'Força',
  'Saúde e mobilidade',
  'Reabilitação',
];

const EXPERIENCE = ['Nunca treinei', 'Menos de 6 meses', '6 meses a 2 anos', 'Mais de 2 anos'];

const FREQUENCY = [
  '1 a 2x por semana',
  '3 a 4x por semana',
  '5 a 6x por semana',
  'Todos os dias',
];

const LOCATIONS = ['Academia', 'Em casa', 'Ao ar livre', 'Misto'];

const SESSION_LENGTH = ['30 min', '45 min', '60 min', '90 min ou mais'];

const EQUIPMENT = [
  'Halteres',
  'Barra e anilhas',
  'Máquinas',
  'Elásticos',
  'Peso corporal',
  'Nenhum',
];

const HEALTH_CONDITIONS = [
  'Nenhuma',
  'Hipertensão',
  'Diabetes',
  'Colesterol alto',
  'Cardiopatia',
  'Asma ou problema respiratório',
  'Ansiedade ou depressão',
  'Problema na coluna',
  'Lesão articular',
  'Outra',
];

const YES_NO = ['Não', 'Sim'];

const MEDICAL_CLEARANCE = ['Sim', 'Não', 'Não sei'];

const DIET_QUALITY = ['Muito ruim', 'Ruim', 'Razoável', 'Boa', 'Excelente'];

const MEALS_PER_DAY = ['1 a 2', '3 a 4', '5 a 6', 'Mais de 6'];

const DIET_FOLLOW = ['Não sigo dieta', 'Acompanhamento com nutricionista', 'Por conta própria'];

const WATER_INTAKE = ['Menos de 1L', '1 a 2L', '2 a 3L', 'Mais de 3L'];

const ALCOHOL = ['Não bebo', 'Socialmente', 'Com frequência'];

const SMOKING = ['Não', 'Sim', 'Parei'];

const SLEEP = ['Menos de 6h', '6 a 7h', '7 a 8h', 'Mais de 8h'];

const STRESS = ['Baixo', 'Médio', 'Alto'];

const STEP_COUNT = 4;

function statusMessage(status: InviteInfo['status']) {
  switch (status) {
    case 'expired':
      return 'Este convite expirou. Peça um novo link ao seu personal.';
    case 'accepted':
      return 'Este convite já foi utilizado. Se a conta é sua, faça login com seu email e senha.';
    default:
      return 'Convite não encontrado. Confira o link com seu personal.';
  }
}

function Choice({
  question,
  options,
  value,
  onChange,
}: {
  question: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.question}>
      <Text style={[styles.questionLabel, { color: theme.text }]}>{question}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const active = value === option;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.primarySoft : theme.backgroundSelected,
                  borderColor: active ? Brand.primary : theme.border,
                },
              ]}>
              <Text
                style={[styles.chipText, { color: active ? Brand.primary : theme.text }]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MultiChoice({
  question,
  options,
  values,
  onToggle,
}: {
  question: string;
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.question}>
      <Text style={[styles.questionLabel, { color: theme.text }]}>{question}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const active = values.includes(option);
          return (
            <Pressable
              key={option}
              onPress={() => onToggle(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.primarySoft : theme.backgroundSelected,
                  borderColor: active ? Brand.primary : theme.border,
                },
              ]}>
              <Text
                style={[styles.chipText, { color: active ? Brand.primary : theme.text }]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function InviteScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ c?: string | string[] }>();
  const token = Array.isArray(params.c) ? params.c[0] : params.c;

  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'done'>(
    token ? 'loading' : 'error',
  );
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(
    token ? null : 'Link de convite incompleto. Abra o link completo enviado pelo seu personal.',
  );

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const [fullName, setFullName] = useState('');
  const [birthInput, setBirthInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [goal, setGoal] = useState('');
  const [experience, setExperience] = useState('');
  const [frequency, setFrequency] = useState('');
  const [location, setLocation] = useState('');
  const [sessionLength, setSessionLength] = useState('');
  const [availability, setAvailability] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);

  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [medicationUse, setMedicationUse] = useState('');
  const [medications, setMedications] = useState('');
  const [fractureHistory, setFractureHistory] = useState('');
  const [injuries, setInjuries] = useState('');
  const [pain, setPain] = useState('');
  const [medicalClearance, setMedicalClearance] = useState('');
  const [health, setHealth] = useState('');

  const [dietQuality, setDietQuality] = useState('');
  const [mealsPerDay, setMealsPerDay] = useState('');
  const [dietFollow, setDietFollow] = useState('');
  const [waterIntake, setWaterIntake] = useState('');
  const [alcohol, setAlcohol] = useState('');
  const [smoking, setSmoking] = useState('');
  const [sleep, setSleep] = useState('');
  const [stress, setStress] = useState('');
  const [supplements, setSupplements] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let active = true;

    if (!token) return;

    getInvite(token).then((info) => {
      if (!active) return;

      setInvite(info);

      if (info.status === 'valid') {
        setBirthInput(isoToDateInput(info.birth_date));
        setState('ready');
      } else {
        setLoadError(statusMessage(info.status));
        setState('error');
      }
    });

    return () => {
      active = false;
    };
  }, [token]);

  function toggleEquipment(value: string) {
    setEquipment((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function toggleHealthCondition(value: string) {
    setHealthConditions((current) => {
      if (value === 'Nenhuma') {
        return current.includes('Nenhuma') ? [] : ['Nenhuma'];
      }

      const withoutNone = current.filter((item) => item !== 'Nenhuma');

      return withoutNone.includes(value)
        ? withoutNone.filter((item) => item !== value)
        : [...withoutNone, value];
    });
  }

  function goNext() {
    setError(null);

    if (step === 0) {
      if (fullName.trim().length < 2) {
        setError('Informe seu nome completo.');
        return;
      }

      if (!dateInputToISO(birthInput)) {
        setError('Informe sua data de nascimento no formato DD/MM/AAAA.');
        return;
      }

      if (password.length < 6) {
        setError('A senha precisa ter pelo menos 6 caracteres.');
        return;
      }

      if (password !== confirmPassword) {
        setError('As senhas não conferem.');
        return;
      }

      setStep(1);
      return;
    }

    if (step === 1) {
      if (!goal || !experience || !frequency || !location || !sessionLength) {
        setError('Responda todas as perguntas para continuar.');
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      if (!healthConditions.length) {
        setError('Selecione ao menos uma opção de saúde.');
        return;
      }

      if (!medicationUse || !fractureHistory || !medicalClearance) {
        setError('Responda todas as perguntas de saúde para continuar.');
        return;
      }

      if (medicationUse === 'Sim' && medications.trim().length < 2) {
        setError('Informe quais medicamentos controlados você usa.');
        return;
      }

      setStep(3);
    }
  }

  function goBack() {
    setError(null);
    setStep((current) => Math.max(0, current - 1));
  }

  async function handleSubmit() {
    if (!token || !invite?.email) return;

    const birthDate = dateInputToISO(birthInput);

    if (!birthDate) {
      setError('Informe sua data de nascimento no formato DD/MM/AAAA.');
      return;
    }

    if (
      !dietQuality ||
      !mealsPerDay ||
      !dietFollow ||
      !waterIntake ||
      !alcohol ||
      !smoking ||
      !sleep ||
      !stress
    ) {
      setError('Responda todas as perguntas de estilo de vida para continuar.');
      return;
    }

    const anamnesis: AnamnesisAnswers = {
      goal,
      experience,
      frequency,
      location,
      sessionLength,
      availability: availability.trim(),
      equipment,
      healthConditions,
      medicationUse,
      medications: medications.trim(),
      fractureHistory,
      injuries: injuries.trim(),
      pain: pain.trim(),
      medicalClearance,
      health: health.trim(),
      dietQuality,
      mealsPerDay,
      dietFollow,
      waterIntake,
      alcohol,
      smoking,
      sleep,
      stress,
      supplements: supplements.trim(),
      notes: notes.trim(),
    };

    setError(null);
    setSaving(true);

    const result = await registerWithInvite({
      token,
      email: invite.email,
      password,
      fullName,
      birthDate,
      anamnesis,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNeedsConfirmation(result.needsConfirmation ?? false);
    setState('done');
  }

  if (state === 'loading') {
    return <Loading label="Carregando convite..." />;
  }

  if (state === 'error') {
    return (
      <AuthShell
        eyebrow="CONVITE"
        title="Convite"
        highlight="indisponível."
        subtitle={loadError ?? 'Não foi possível abrir este convite.'}
        footer={
          <Pressable onPress={() => router.replace('/login')}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Já tem conta? <Text style={{ color: Brand.primary }}>Entrar</Text>
            </Text>
          </Pressable>
        }>
        <Button title="Ir para o login" onPress={() => router.replace('/login')} />
      </AuthShell>
    );
  }

  if (state === 'done') {
    return (
      <AuthShell
        eyebrow="TUDO PRONTO"
        title={needsConfirmation ? 'Confirme seu' : 'Bem-vindo,'}
        highlight={needsConfirmation ? 'email.' : `${fullName.trim().split(' ')[0]}.`}
        subtitle={
          needsConfirmation
            ? 'Sua conta foi criada e seu convite já está vinculado. Confirme o email para entrar no app.'
            : 'Sua conta foi criada, o convite foi aceito e sua anamnese já está com seu personal.'
        }>
        <View style={[styles.successCircle, { backgroundColor: theme.successSoft }]}>
          <Ionicons name="checkmark" size={30} color={Brand.success} />
        </View>
        <Text style={[styles.doneText, { color: theme.textSecondary }]}>
          {needsConfirmation
            ? `Enviamos um link de confirmação para ${invite?.email ?? 'seu email'}.`
            : 'Agora é só começar. Seu treino aparece aqui assim que seu personal publicar.'}
        </Text>
        <Button
          title={needsConfirmation ? 'Fazer login' : 'Começar agora'}
          onPress={() => router.replace(needsConfirmation ? '/login' : '/')}
        />
      </AuthShell>
    );
  }

  const coachName = invite?.coach_name?.trim();

  const subtitle =
    step === 0
      ? coachName
        ? `Convite de ${coachName}. Crie sua senha para começar.`
        : 'Crie sua senha para começar.'
      : step === 1
        ? 'Conte sobre seu objetivo, experiência e rotina de treino.'
        : step === 2
          ? 'Agora informações importantes sobre saúde, lesões e medicamentos.'
          : 'Por fim, alimentação, sono e estilo de vida.';

  return (
    <AuthShell
      eyebrow={`CONVITE • ETAPA ${step + 1} DE ${STEP_COUNT}`}
      title="Seu acesso"
      highlight="está pronto."
      subtitle={subtitle}
      footer={
        <Pressable onPress={() => router.replace('/login')}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Já tem conta? <Text style={{ color: Brand.primary }}>Entrar</Text>
          </Text>
        </Pressable>
      }>
      <View style={styles.progressRow}>
        {Array.from({ length: STEP_COUNT }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressBar,
              {
                backgroundColor: index <= step ? Brand.primary : theme.backgroundSelected,
              },
            ]}
          />
        ))}
      </View>

      {step === 0 ? (
        <>
          <TextField
            label="Nome completo"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Seu nome"
            autoCapitalize="words"
            autoComplete="name"
          />
          <TextField
            label="Email"
            value={invite?.email ?? ''}
            editable={false}
            placeholder="Email do convite"
          />
          <TextField
            label="Data de nascimento"
            value={birthInput}
            onChangeText={(value) => setBirthInput(maskDateInput(value))}
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            maxLength={10}
          />
          <PasswordField
            label="Crie sua senha"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo de 6 caracteres"
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirmar senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repita a senha"
            autoComplete="new-password"
          />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Choice
            question="Qual é seu objetivo principal?"
            options={GOALS}
            value={goal}
            onChange={setGoal}
          />
          <Choice
            question="Quanto tempo de experiência você tem?"
            options={EXPERIENCE}
            value={experience}
            onChange={setExperience}
          />
          <Choice
            question="Quantas vezes por semana pretende treinar?"
            options={FREQUENCY}
            value={frequency}
            onChange={setFrequency}
          />
          <Choice
            question="Onde você vai treinar?"
            options={LOCATIONS}
            value={location}
            onChange={setLocation}
          />
          <Choice
            question="Quanto tempo por treino?"
            options={SESSION_LENGTH}
            value={sessionLength}
            onChange={setSessionLength}
          />
          <TextField
            label="Dias e horários que costuma treinar"
            value={availability}
            onChangeText={setAvailability}
            placeholder="Ex.: segundas e quartas às 19h"
          />
          <MultiChoice
            question="Quais equipamentos você tem disponíveis?"
            options={EQUIPMENT}
            values={equipment}
            onToggle={toggleEquipment}
          />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <MultiChoice
            question="Você tem alguma condição de saúde?"
            options={HEALTH_CONDITIONS}
            values={healthConditions}
            onToggle={toggleHealthCondition}
          />
          <Choice
            question="Usa algum medicamento controlado?"
            options={YES_NO}
            value={medicationUse}
            onChange={setMedicationUse}
          />
          {medicationUse === 'Sim' ? (
            <TextField
              label="Quais medicamentos?"
              value={medications}
              onChangeText={setMedications}
              placeholder="Nome e dosagem, se souber"
            />
          ) : null}
          <Choice
            question="Já quebrou algum osso ou teve lesão grave?"
            options={YES_NO}
            value={fractureHistory}
            onChange={setFractureHistory}
          />
          <TextField
            label="Fraturas, cirurgias e lesões"
            value={injuries}
            onChangeText={setInjuries}
            placeholder="Ex.: fraturei o punho em 2020; cirurgia no joelho em 2022..."
            multiline
            style={styles.multiline}
          />
          <TextField
            label="Sente dores frequentes?"
            value={pain}
            onChangeText={setPain}
            placeholder="Onde e quando a dor aparece?"
          />
          <Choice
            question="Tem liberação médica para treinar?"
            options={MEDICAL_CLEARANCE}
            value={medicalClearance}
            onChange={setMedicalClearance}
          />
          <TextField
            label="Outras condições ou observações de saúde"
            value={health}
            onChangeText={setHealth}
            placeholder="Ex.: hipertensão controlada, labirintite, ansiedade..."
            multiline
            style={styles.multiline}
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Choice
            question="Como você avalia sua alimentação?"
            options={DIET_QUALITY}
            value={dietQuality}
            onChange={setDietQuality}
          />
          <Choice
            question="Quantas refeições faz por dia?"
            options={MEALS_PER_DAY}
            value={mealsPerDay}
            onChange={setMealsPerDay}
          />
          <Choice
            question="Você segue alguma dieta?"
            options={DIET_FOLLOW}
            value={dietFollow}
            onChange={setDietFollow}
          />
          <Choice
            question="Quanto de água você bebe por dia?"
            options={WATER_INTAKE}
            value={waterIntake}
            onChange={setWaterIntake}
          />
          <Choice
            question="Consome bebida alcoólica?"
            options={ALCOHOL}
            value={alcohol}
            onChange={setAlcohol}
          />
          <Choice
            question="Fuma ou usa vape?"
            options={SMOKING}
            value={smoking}
            onChange={setSmoking}
          />
          <Choice
            question="Quantas horas você dorme por noite?"
            options={SLEEP}
            value={sleep}
            onChange={setSleep}
          />
          <Choice
            question="Como está seu nível de estresse?"
            options={STRESS}
            value={stress}
            onChange={setStress}
          />
          <TextField
            label="Suplementos que usa"
            value={supplements}
            onChangeText={setSupplements}
            placeholder="Ex.: creatina, whey, cafeína..."
          />
          <TextField
            label="Observações para seu personal"
            value={notes}
            onChangeText={setNotes}
            placeholder="Algo que seu personal precisa saber?"
            multiline
            style={styles.multiline}
          />
        </>
      ) : null}

      {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}

      <Button
        title={step === STEP_COUNT - 1 ? 'Criar minha conta' : 'Continuar'}
        onPress={step === STEP_COUNT - 1 ? handleSubmit : goNext}
        loading={saving}
      />

      {step > 0 ? (
        <Button title="Voltar" variant="ghost" onPress={goBack} disabled={saving} />
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: Radius.full,
  },
  question: {
    gap: Spacing.two,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  multiline: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 14,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  doneText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
