import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function StudentTabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const iconWrapper = (focused: boolean, icon: keyof typeof Ionicons.glyphMap, color: ColorValue) => (
    <View style={[styles.iconWrap, focused && { backgroundColor: theme.primarySoft }]}>
      <Ionicons name={icon} size={20} color={color as string} />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
