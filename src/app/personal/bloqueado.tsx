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

export default function PersonalBlocked() {
  const router = useRouter();
  const theme = useTheme();
  const { profile, trialDaysLeft, signOut } = useAuth();

  const rejected = profile?.status === 'rejected';
  const pending = profile?.status === 'pending';
  const expired = profile?.status === 'trial' && trialDaysLeft === 0;

  let title = 'Conta em análise';
  let message =
    'Sua conta de personal está aguardando aprovação do administrador. Assim que aprovada, você terá acesso completo.';
  if (rejected) {
    title = 'Conta não aprovada';
    message = 'Sua conta foi rejeitada pelo administrador. Entre em contato para mais informações.';
  } else if (expired) {
    title = 'Período de teste encerrado';
    message =
      'Seus 7 dias de teste terminaram. Aguarde a aprovação do administrador para continuar usando o Evolvi Fit.';
  } else if (pending) {
    title = 'Conta pendente';
    message = 'Sua conta está pendente de aprovação.';
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <Screen scroll={false}>
      <PhotoHero source={Images.coach} height={220} imagePosition="top" glowColor={Brand.danger}>
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
          {profile?.status === 'trial' && !expired && trialDaysLeft != null ? (
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
