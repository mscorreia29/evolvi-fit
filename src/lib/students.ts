import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';

const EXISTING_EMAIL =
  'Este email já está cadastrado no app. Use outro email ou peça ao aluno para recuperar a senha.';

type CreateStudentParams = {
  coachId: string;
  fullName: string;
  email: string;
  password: string;
};

export type CreateStudentResult = {
  error: string | null;
  studentId?: string;
  needsConfirmation?: boolean;
};

function createIsolatedClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'personalfit-student-creation',
    },
  });
}

function friendlyAuthError(message: string) {
  const text = message.toLowerCase();

  if (text.includes('already')) return EXISTING_EMAIL;
  if (text.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (text.includes('invalid') && text.includes('email')) return 'Email inválido.';
  if (text.includes('security purposes') || text.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns segundos e tente novamente.';
  }

  return message;
}

function friendlyEmailError(message: string) {
  const text = message.toLowerCase();

  if (text.includes('security purposes') || text.includes('rate limit') || text.includes('too many')) {
    return 'Muitas tentativas. Aguarde um minuto e tente novamente.';
  }

  return message;
}

export type EmailActionResult = {
  error: string | null;
  alreadyConfirmed?: boolean;
};

export async function sendStudentPasswordReset(email: string): Promise<EmailActionResult> {
  const { error } = await createIsolatedClient().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: Linking.createURL('/reset-password') },
  );

  if (error) return { error: friendlyEmailError(error.message) };
  return { error: null };
}

export async function resendStudentConfirmation(email: string): Promise<EmailActionResult> {
  const { error } = await createIsolatedClient().auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: Linking.createURL('/login') },
  });

  if (error) {
    const text = error.message.toLowerCase();
    if (text.includes('confirmed')) return { error: null, alreadyConfirmed: true };
    return { error: friendlyEmailError(error.message) };
  }

  return { error: null };
}

export async function createStudentAccount({
  coachId,
  fullName,
  email,
  password,
}: CreateStudentParams): Promise<CreateStudentResult> {
  const isolatedClient = createIsolatedClient();

  const { data, error } = await isolatedClient.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        role: 'aluno',
      },
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  const studentId = data.user?.id;
  const alreadyExists = !studentId || (data.user?.identities?.length ?? 0) === 0;

  if (alreadyExists) {
    return { error: EXISTING_EMAIL };
  }

  const { error: linkError } = await supabase.from('coach_students').insert({
    coach_id: coachId,
    student_id: studentId,
  });

  if (linkError) {
    if (linkError.code === '23505') {
      return { error: null, studentId, needsConfirmation: !data.session };
    }
    if (linkError.code === '23503') {
      return { error: EXISTING_EMAIL };
    }
    return { error: linkError.message };
  }

  return { error: null, studentId, needsConfirmation: !data.session };
}
