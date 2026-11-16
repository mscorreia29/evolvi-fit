import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const EXISTING_EMAIL =
  'Este email já tem uma conta no Evolvi Fit. Entre com sua senha ou peça um novo convite ao seu personal.';

export type InviteStatus = 'valid' | 'not_found' | 'expired' | 'accepted';

export type InviteInfo = {
  status: InviteStatus;
  email?: string;
  birth_date?: string | null;
  coach_name?: string | null;
};

export type AnamnesisAnswers = {
  goal?: string;
  experience?: string;
  frequency?: string;
  location?: string;
  sessionLength?: string;
  availability?: string;
  equipment?: string[];
  healthConditions?: string[];
  medicationUse?: string;
  medications?: string;
  fractureHistory?: string;
  injuries?: string;
  pain?: string;
  medicalClearance?: string;
  health?: string;
  dietQuality?: string;
  mealsPerDay?: string;
  dietFollow?: string;
  waterIntake?: string;
  alcohol?: string;
  smoking?: string;
  sleep?: string;
  stress?: string;
  supplements?: string;
  notes?: string;
};

export type CreatedInvite = {
  id: string;
  token: string;
  url: string;
  expiresAt: string;
};

type CreateInviteParams = {
  coachId: string;
  email: string;
  birthDate: string | null;
};

function friendlyAuthError(message: string) {
  const text = message.toLowerCase();

  if (text.includes('already registered') || text.includes('already exists')) {
    return EXISTING_EMAIL;
  }
  if (text.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (text.includes('invalid') && text.includes('email')) return 'Email inválido.';
  if (text.includes('security purposes') || text.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns segundos e tente novamente.';
  }

  return message;
}

function inviteErrorMessage(code: string) {
  switch (code) {
    case 'convite_nao_encontrado':
      return 'Convite não encontrado. Confira o link com seu personal.';
    case 'convite_ja_utilizado':
      return 'Este convite já foi utilizado. Se você já criou sua conta, faça login.';
    case 'convite_expirado':
      return 'Este convite expirou. Peça um novo link ao seu personal.';
    case 'email_nao_confere':
      return 'Não foi possível validar este convite para o email informado.';
    default:
      return 'Não foi possível concluir o cadastro. Tente novamente.';
  }
}

export function maskDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return [day, month, year].filter(Boolean).join('/');
}

export function dateInputToISO(value: string) {
  const [day, month, year] = value.split('/');

  if (!day || !month || !year || year.length !== 4) return null;

  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  const date = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));

  if (
    date.getUTCFullYear() !== yearNumber ||
    date.getUTCMonth() !== monthNumber - 1 ||
    date.getUTCDate() !== dayNumber
  ) {
    return null;
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function isoToDateInput(value?: string | null) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day}/${month}/${year}` : '';
}

export function buildInviteUrl(token: string) {
  const publicAppUrl = process.env.EXPO_PUBLIC_APP_URL?.trim();

  if (publicAppUrl) {
    return `${publicAppUrl.replace(/\/$/, '')}/convite?c=${token}`;
  }

  if (Platform.OS === 'web') {
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin;
    if (origin) return `${origin}/convite?c=${token}`;
  }

  return Linking.createURL('/convite', { queryParams: { c: token } });
}

export async function createStudentInvite({
  coachId,
  email,
  birthDate,
}: CreateInviteParams): Promise<{ error: string | null; invite?: CreatedInvite }> {
  const { data, error } = await supabase
    .from('student_invites')
    .insert({
      coach_id: coachId,
      email: email.trim().toLowerCase(),
      birth_date: birthDate,
    })
    .select('id, token, expires_at')
    .single();

  if (error || !data) {
    return { error: error?.message ?? 'Não foi possível gerar o convite.' };
  }

  return {
    error: null,
    invite: {
      id: data.id,
      token: data.token,
      url: buildInviteUrl(data.token),
      expiresAt: data.expires_at,
    },
  };
}

export async function getInvite(token: string): Promise<InviteInfo> {
  const { data, error } = await supabase.rpc('get_invite', { p_token: token });

  if (error || !data) return { status: 'not_found' };

  return data as InviteInfo;
}

type RegisterInviteParams = {
  token: string;
  email: string;
  password: string;
  fullName: string;
  birthDate: string;
  anamnesis: AnamnesisAnswers;
};

export async function registerWithInvite({
  token,
  email,
  password,
  fullName,
  birthDate,
  anamnesis,
}: RegisterInviteParams): Promise<{ error: string | null; needsConfirmation?: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: Linking.createURL('/login'),
      data: {
        full_name: fullName.trim(),
        role: 'aluno',
        birth_date: birthDate,
      },
    },
  });

  let studentId = data?.user?.id ?? null;
  let needsConfirmation = !data?.session;
  let alreadyRegistered = !studentId || (data?.user?.identities?.length ?? 0) === 0;

  if (error) {
    const text = error.message.toLowerCase();
    if (!text.includes('already')) {
      return { error: friendlyAuthError(error.message) };
    }
    alreadyRegistered = true;
  }

  if (alreadyRegistered) {
    const signIn = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signIn.error || !signIn.data.user) {
      return { error: EXISTING_EMAIL };
    }

    studentId = signIn.data.user.id;
    needsConfirmation = false;
  }

  if (!studentId) {
    return { error: 'Não foi possível criar sua conta. Tente novamente.' };
  }

  const { data: accepted, error: acceptError } = await supabase.rpc('accept_student_invite', {
    p_token: token,
    p_student_id: studentId,
    p_full_name: fullName.trim(),
    p_birth_date: birthDate,
    p_anamnesis: anamnesis,
  });

  if (acceptError) {
    return { error: acceptError.message };
  }

  const result = accepted as { ok?: boolean; error?: string } | null;

  if (result?.error) {
    return { error: inviteErrorMessage(result.error) };
  }

  return { error: null, needsConfirmation };
}
