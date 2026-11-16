import { DarkTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { Brand, Colors } from '@/constants/theme';
import '@/lib/notifications';
import { AuthProvider } from '@/providers/auth-provider';

const darkNavigation = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Brand.primary,
    background: Colors.dark.background,
    card: Colors.dark.backgroundElement,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

function useNotificationObserver() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (url === '/aluno') {
        router.dismissTo('/aluno');
      } else if (typeof url === 'string' && url.startsWith('/')) {
        router.navigate(url as never);
      }
      Notifications.clearLastNotificationResponse();
    }

    const response = Notifications.getLastNotificationResponse();
    if (response?.notification) {
      redirect(response.notification);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((event) => {
      redirect(event.notification);
    });

    return () => {
      subscription.remove();
    };
  }, []);
}

export default function RootLayout() {
  useNotificationObserver();

  return (
    <AuthProvider>
      <ThemeProvider value={darkNavigation}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="convite" />
          <Stack.Screen name="notificacoes" />
          <Stack.Screen name="personal" />
          <Stack.Screen name="aluno" />
          <Stack.Screen name="admin" />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
