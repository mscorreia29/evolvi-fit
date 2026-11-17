import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { resolveBrandCoverUrl } from '@/lib/branding';
import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/lib/types';

type SignUpParams = {
  email: string;
  password: string;
  fullName: string;
  role: Role;
};

type AuthResult = {
  error: string | null;
  needsConfirmation?: boolean;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  brandCoverUrl: string | null;
  loading: boolean;
  isAdmin: boolean;
  isTrialExpired: boolean;
  accountBlocked: boolean;
  trialDaysLeft: number | null;
  hasAccess: boolean;
  accessExpiresAt: string | null;
  daysUntilExpiry: number | null;
  blockReason: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (params: SignUpParams) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(user: User): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (data) {
    return data as Profile;
  }

  const fallbackRole: Role = user.user_metadata?.role === 'personal' ? 'personal' : 'aluno';
  const { data: created } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      role: fallbackRole,
      full_name: user.user_metadata?.full_name ?? null,
      email: user.email ?? null,
    })
    .select('*')
    .maybeSingle();

  return (created as Profile) ?? null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [brandCoverUrl, setBrandCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(Boolean(data.session));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setLoading(true);
      } else {
        setProfile(null);
        setBrandCoverUrl(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const user = session?.user;
    if (!user) return;

    let active = true;

    loadProfile(user)
      .then(async (nextProfile) => {
        if (!active) return;
        setProfile(nextProfile);
        const cover = await resolveBrandCoverUrl(nextProfile);
        if (active) setBrandCoverUrl(cover);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (params: SignUpParams): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: params.email.trim(),
      password: params.password,
      options: {
        data: {
          full_name: params.fullName.trim(),
          role: params.role,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null, needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setBrandCoverUrl(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const nextProfile = await loadProfile(session.user);
    setProfile(nextProfile);
    setBrandCoverUrl(await resolveBrandCoverUrl(nextProfile));
  }, [session]);

  const isAdmin = profile?.role === 'admin';
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  // determine access for personal accounts
  let hasAccess = true;
  let accessExpiresAt: string | null = null;
  let blockReason: string | null = null;
  if (profile?.role === 'personal') {
    if (profile.status === 'blocked' || profile.status === 'rejected' || profile.status === 'pending') {
      hasAccess = false;
      blockReason = profile.block_reason ?? (profile.status === 'rejected' ? 'Conta não aprovada.' : profile.status === 'pending' ? 'Conta pendente de aprovação.' : 'Acesso bloqueado.');
    } else if (profile.status === 'trial') {
      if (profile.trial_ends_at && new Date(profile.trial_ends_at).getTime() < now) {
        hasAccess = false;
        blockReason = 'Período de teste encerrado.';
      } else {
        accessExpiresAt = profile.trial_ends_at;
      }
    } else if (profile.status === 'approved') {
      if (profile.paid_until && new Date(profile.paid_until).getTime() < now) {
        hasAccess = false;
        blockReason = 'Acesso expirado. Renove com o administrador.';
      } else {
        accessExpiresAt = profile.paid_until;
      }
    } else {
      hasAccess = false;
      blockReason = 'Conta sem acesso.';
    }
  }

  const isTrialExpired =
    profile?.role === 'personal' &&
    profile?.status === 'trial' &&
    !!profile.trial_ends_at &&
    new Date(profile.trial_ends_at).getTime() < now;
  const accountBlocked = !hasAccess;
  const trialDaysLeft =
    profile?.role === 'personal' && profile?.status === 'trial' && profile.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(profile.trial_ends_at).getTime() - now) / 86400000))
      : null;
  const daysUntilExpiry =
    hasAccess && accessExpiresAt
      ? Math.max(0, Math.ceil((new Date(accessExpiresAt).getTime() - now) / 86400000))
      : null;

  const value = useMemo(
    () => ({
      session,
      profile,
      brandCoverUrl,
      loading,
      isAdmin,
      isTrialExpired,
      accountBlocked,
      trialDaysLeft,
      hasAccess,
      accessExpiresAt,
      daysUntilExpiry,
      blockReason,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, brandCoverUrl, loading, isAdmin, isTrialExpired, accountBlocked, trialDaysLeft, hasAccess, accessExpiresAt, daysUntilExpiry, blockReason, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
