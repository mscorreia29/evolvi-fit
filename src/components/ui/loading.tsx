import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Brand, Gradients, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Loading({ label }: { label?: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={Gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badge}>
        <Ionicons name="barbell" size={30} color="#04140D" />
      </LinearGradient>
      <Text style={[styles.brand, { color: theme.text }]}>Evolvi Fit</Text>
      <ActivityIndicator color={Brand.primary} />
      {label ? <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  brand: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  label: {
    fontSize: 14,
  },
});
