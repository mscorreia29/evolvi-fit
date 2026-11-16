import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'muted';

const toneColors: Record<Tone, string> = {
  primary: Brand.primary,
  success: Brand.success,
  warning: Brand.warning,
  danger: Brand.danger,
  muted: Brand.primary,
};

export function Badge({
  label,
  tone = 'primary',
  style,
}: {
  label: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const color = tone === 'muted' ? theme.textSecondary : toneColors[tone];
  const backgroundColor =
    tone === 'primary'
      ? theme.primarySoft
      : tone === 'success'
        ? theme.successSoft
        : tone === 'warning'
          ? theme.warningSoft
          : tone === 'danger'
            ? theme.dangerSoft
            : theme.backgroundSelected;

  return (
    <View style={[styles.badge, { backgroundColor }, style]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
