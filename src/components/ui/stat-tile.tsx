import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui/card';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Tone = 'primary' | 'success' | 'accent' | 'warning';

const toneMap: Record<Tone, { color: string; background: string }> = {
  primary: { color: Brand.primary, background: 'rgba(62, 207, 142, 0.12)' },
  success: { color: Brand.success, background: 'rgba(74, 222, 128, 0.12)' },
  accent: { color: Brand.accent, background: 'rgba(56, 189, 248, 0.12)' },
  warning: { color: Brand.warning, background: 'rgba(245, 181, 68, 0.14)' },
};

export function StatTile({
  icon,
  label,
  value,
  tone = 'primary',
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { color, background } = toneMap[tone];

  return (
    <Card style={[styles.card, style]}>
      <View style={[styles.iconBox, { backgroundColor: background }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: Spacing.one,
    borderRadius: Radius.lg,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
