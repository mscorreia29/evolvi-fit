import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Brand, CardShadow, Gradients, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const theme = useTheme();

  const isFilled = variant === 'primary' || variant === 'danger';
  const color =
    variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? '#FFFFFF' : theme.text;
  const gradientColors = variant === 'primary' ? Gradients.primary : Gradients.danger;

  const content = loading ? (
    <ActivityIndicator color={color} />
  ) : (
    <Text style={[styles.text, { color }]}>{title}</Text>
  );

  if (isFilled) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          style,
          {
            opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
            borderRadius: Radius.md,
          },
        ]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            CardShadow,
            variant === 'primary' && { shadowColor: Brand.primary },
          ]}>
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  const backgroundColor =
    variant === 'secondary' ? theme.backgroundSelected : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        variant === 'ghost' && styles.ghost,
        variant === 'secondary' && {
          borderWidth: 1,
          borderColor: theme.border,
        },
        style,
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: Radius.md,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    paddingHorizontal: 8,
  },
  text: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
