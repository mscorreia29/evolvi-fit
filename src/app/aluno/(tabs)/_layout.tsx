import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function StudentTabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, hasAccess } = useAuth();
  const isAutonomous = Boolean(
    (profile as unknown as { is_autonomous?: boolean } | null)?.is_autonomous,
  );

  if (isAutonomous && !hasAccess) {
    return <Redirect href={'/aluno/bloqueado' as never} />;
  }

  const iconWrapper = (focused: boolean, icon: keyof typeof Ionicons.glyphMap, color: ColorValue) => (
    <View style={[styles.iconWrap, focused && { backgroundColor: theme.primarySoft }]}>
      <Ionicons name={icon} size={20} color={color as string} />
    </View>
  );

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        animation: 'none',
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 66 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) =>
            iconWrapper(focused, focused ? 'home' : 'home-outline', color),
        }}
      />
      <Tabs.Screen
        name="treinos"
        options={{
          title: 'Treinos',
          tabBarIcon: ({ color, focused }) =>
            iconWrapper(focused, focused ? 'barbell' : 'barbell-outline', color),
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ color, focused }) =>
            iconWrapper(focused, focused ? 'time' : 'time-outline', color),
        }}
      />
      <Tabs.Screen
        name="alimentacao"
        options={{
          title: 'Alimentação',
          tabBarIcon: ({ color, focused }) =>
            iconWrapper(focused, focused ? 'restaurant' : 'restaurant-outline', color),
        }}
      />
      <Tabs.Screen
        name="mensagens"
        options={{
          title: 'Chat',
          href: isAutonomous ? null : undefined,
          tabBarIcon: ({ color, focused }) =>
            iconWrapper(focused, focused ? 'chatbubbles' : 'chatbubbles-outline', color),
        }}
      />
      <Tabs.Screen
        name="suporte"
        options={{
          title: 'Suporte',
          tabBarIcon: ({ color, focused }) =>
            iconWrapper(focused, focused ? 'help-buoy' : 'help-buoy-outline', color),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) =>
            iconWrapper(focused, focused ? 'person-circle' : 'person-circle-outline', color),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 38,
    height: 30,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
