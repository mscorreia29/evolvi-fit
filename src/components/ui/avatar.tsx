import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';
import { initials } from '@/lib/format';

type AvatarProps = {
  name?: string | null;
  size?: number;
  colors?: readonly [string, string];
  ring?: boolean;
};

export function Avatar({
  name,
  size = 48,
  colors = [Brand.primaryDeep, Brand.primaryDark],
  ring = false,
}: AvatarProps) {
  const fontSize = Math.round(size * 0.36);
  const ringWidth = ring ? 3 : 0;

  return (
    <View style={{ width: size + ringWidth * 2, height: size + ringWidth * 2 }}>
      {ring ? (
        <View
          style={[
            styles.ring,
            {
              width: size + ringWidth * 2,
              height: size + ringWidth * 2,
              borderRadius: Radius.full,
            },
          ]}
        />
      ) : null}
      <LinearGradient
        colors={[colors[0], colors[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: Radius.full,
            margin: ringWidth,
          },
        ]}>
        <Text style={[styles.initials, { fontSize }]}>{initials(name)}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
