import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ProgressBar({
  value,
  height = 8,
  color = Brand.primary,
  style,
}: {
  value: number;
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: Radius.full, backgroundColor: theme.backgroundSelected },
        style,
      ]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, borderRadius: Radius.full, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
