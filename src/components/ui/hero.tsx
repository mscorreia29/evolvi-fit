import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type HeroProps = PropsWithChildren<{
  colors?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function Hero({ children, colors, style, contentStyle }: HeroProps) {
  const theme = useTheme();
  const glow = colors ? colors[colors.length - 1] : Brand.primary;

  return (
    <View
      style={[
        styles.hero,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        style,
      ]}>
      <LinearGradient
        colors={[withAlpha(glow, 0.26), withAlpha(glow, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[styles.orbLarge, { backgroundColor: withAlpha(glow, 0.16) }]}
        pointerEvents="none"
      />
      <View
        style={[styles.orbSmall, { backgroundColor: withAlpha(glow, 0.1) }]}
        pointerEvents="none"
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.four,
    overflow: 'hidden',
  },
  content: {
    gap: Spacing.two,
  },
  orbLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -110,
    right: -60,
  },
  orbSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: -60,
    left: -20,
  },
});
