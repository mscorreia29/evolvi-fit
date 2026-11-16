import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, Gradients, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WeeklyPoint } from '@/lib/week';

export function WeeklyChart({ data }: { data: WeeklyPoint[] }) {
  const theme = useTheme();
  const max = Math.max(1, ...data.map((point) => point.value));

  return (
    <View style={styles.row}>
      {data.map((point, index) => {
        const isToday = index === data.length - 1;
        const height = point.value > 0 ? 12 + Math.round((point.value / max) * 56) : 8;

        return (
          <View key={`${point.date}-${index}`} style={styles.column}>
            <Text style={[styles.value, { color: theme.textSecondary }]}>
              {point.value > 0 ? point.value : ''}
            </Text>
            {point.value > 0 ? (
              <LinearGradient
                colors={Gradients.primary}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={[styles.bar, { height }]}
              />
            ) : (
              <View style={[styles.bar, { height, backgroundColor: theme.backgroundSelected }]} />
            )}
            <Text
              style={[
                styles.label,
                { color: isToday ? Brand.primary : theme.textSecondary },
                isToday && styles.todayLabel,
              ]}>
              {point.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontSize: 10,
    fontWeight: '700',
    height: 12,
  },
  bar: {
    width: '58%',
    maxWidth: 26,
    borderRadius: Radius.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  todayLabel: {
    fontWeight: '800',
  },
});
