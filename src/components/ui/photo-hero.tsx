import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PhotoHeroProps = PropsWithChildren<{
  source: ImageProps['source'];
  height?: number;
  contentStyle?: StyleProp<ViewStyle>;
  imagePosition?: ImageProps['contentPosition'];
  glowColor?: string;
  fade?: 'soft' | 'strong';
}>;

export function PhotoHero({
  children,
  source,
  height = 250,
  contentStyle,
  imagePosition = 'center',
  glowColor = '#3ECF8E',
  fade = 'strong',
}: PhotoHeroProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.hero,
        {
          minHeight: height,
          backgroundColor: theme.backgroundElement,
          borderColor: withAlpha(glowColor, 0.28),
        },
      ]}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={imagePosition}
        transition={300}
      />
      <LinearGradient
        colors={
          fade === 'strong'
            ? ['rgba(5, 7, 6, 0.05)', 'rgba(5, 7, 6, 0.4)', 'rgba(5, 7, 6, 0.93)', '#050706']
            : ['rgba(5, 7, 6, 0.05)', 'rgba(5, 7, 6, 0.55)']
        }
        locations={fade === 'strong' ? [0, 0.38, 0.78, 1] : [0, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[withAlpha(glowColor, 0.28), 'rgba(5, 7, 6, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 0.9 }}
        style={StyleSheet.absoluteFill}
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
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  content: {
    padding: 24,
    gap: 12,
  },
});
