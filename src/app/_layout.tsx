import { DarkTheme, Stack, ThemeProvider, router, usePathname, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { Brand, Colors } from '@/constants/theme';
import '@/lib/notifications';
import { loadActiveWorkoutSession } from '@/lib/workouts';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

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

function WorkoutResumeGuard() {
  const { loading, profile } = useAuth();
  const pathname = usePathname();
  const resumeRouter = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function resume() {
      if (loading || !profile) return;
      const draft = await loadActiveWorkoutSession();
      if (cancelled || !draft || draft.studentId !== profile.id) return;
      if (pathname.startsWith(`/aluno/treino/${draft.workoutId}`)) return;
      resumeRouter.replace(`/aluno/treino/${draft.workoutId}` as never);
    }

    void resume();

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void resume();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [loading, profile, pathname, resumeRouter]);

  return null;
}

export default function RootLayout() {
  useNotificationObserver();

  return (
    <AuthProvider>
      <ThemeProvider value={darkNavigation}>
        <WorkoutResumeGuard />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="signup-autonomo" />
          <Stack.Screen name="anamnese-ai" />
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
