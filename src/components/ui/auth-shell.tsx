import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AuthShellProps = PropsWithChildren<{
  title: string;
  highlight?: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  footer?: ReactNode;
}>;

export function AuthShell({
  children,
  title,
  highlight,
  eyebrow,
  subtitle,
  onBack,
  footer,
}: AuthShellProps) {
  const theme = useTheme();

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.bgGlowTop} pointerEvents="none">
        <LinearGradient
          colors={[withAlpha(Brand.primary, 0.18), 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.bgGlowBottom} pointerEvents="none">
        <LinearGradient
          colors={['transparent', withAlpha(Brand.accent, 0.12)]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.container}>
        <View style={styles.topRow}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              style={[styles.backButton, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="arrow-back" size={18} color={theme.text} />
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
        </View>

        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={Images.logo} style={styles.logo} contentFit="contain" />
            <View style={styles.brandText}>
              <Text style={styles.brandName}>
                <Text style={{ color: theme.text }}>Evolvi</Text>
                <Text style={{ color: Brand.primary }}> Fit</Text>
              </Text>
              <Text style={[styles.brandTagline, { color: theme.textSecondary }]}>
                Treinos e evolução
              </Text>
            </View>
          </View>

          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={[styles.title, { color: theme.text }]}>
            {title}
            {highlight ? <Text style={{ color: Brand.primary }}>{` ${highlight}`}</Text> : null}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>

        <Card style={styles.card}>{children}</Card>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.five,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  bgGlowTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    overflow: 'hidden',
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    overflow: 'hidden',
  },
  topRow: {
    minHeight: 40,
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    height: 0,
  },
  header: {
    gap: Spacing.two,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  logo: {
    width: 64,
    height: 64,
  },
  brandText: {
    gap: 2,
  },
  brandName: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  brandTagline: {
    fontSize: 13,
    fontWeight: '600',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: Brand.primary,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
    borderRadius: Radius.xl,
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.two,
  },
});
