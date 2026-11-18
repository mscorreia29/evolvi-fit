import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function AlunoBloqueado() {
  const router = useRouter();
  const theme = useTheme();
  const { profile, trialDaysLeft, blockReason, signOut } = useAuth();

  const blocked = profile?.status === 'blocked';
  const pending = profile?.status === 'pending';
  const rejected = profile?.status === 'rejected';
  const trialExpired = profile?.status === 'trial' && trialDaysLeft === 0;
  const subscriptionExpired = profile?.status === 'approved' && Boolean(profile.paid_until);

  let title = 'Acesso indisponível';
  let message =
    'Seu acesso ao Evolvi Fit está temporariamente indisponível. Entre em contato com o administrador.';

  if (blocked) {
    title = 'Conta bloqueada';
    message = blockReason ?? 'Sua conta foi bloqueada. Entre em contato com o administrador.';
  } else if (pending) {
    title = 'Conta pendente';
    message = 'Sua conta está pendente de liberação pelo administrador.';
  } else if (rejected) {
    title = 'Conta não aprovada';
    message = 'Sua conta não foi aprovada. Entre em contato para mais informações.';
  } else if (trialExpired) {
    title = 'Teste grátis encerrado';
    message =
      'Seus 7 dias de teste terminaram. Renove sua assinatura para continuar usando treinos e plano alimentar com IA.';
  } else if (subscriptionExpired) {
    title = 'Assinatura vencida';
    message = blockReason ?? 'Sua assinatura venceu. Renove para continuar usando o Evolvi Fit.';
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <Screen scroll={false}>
      <PhotoHero source={Images.student} height={220} imagePosition="top" glowColor={Brand.danger}>
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>{title}</Text>
        </View>
      </PhotoHero>

      <View style={styles.content}>
        <Card>
          <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
          {!blocked && !pending && !rejected && !trialExpired && !subscriptionExpired && trialDaysLeft != null ? (
            <Text style={[styles.trial, { color: Brand.warning }]}>
              Teste restante: {trialDaysLeft} dia(s)
            </Text>
          ) : null}
        </Card>

        <Button title="Sair da conta" onPress={handleSignOut} variant="danger" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.three,
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  trial: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
