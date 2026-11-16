import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_KEY = '@personalfit/reminder';
const KNOWN_WORKOUTS_KEY = '@personalfit/known-workouts';
const CHANNEL_ID = 'treinos';

export type ReminderConfig = {
  enabled: boolean;
  hour: number;
  minute: number;
  notificationId?: string | null;
};

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function supported() {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

export async function ensureNotificationPermission() {
  if (!supported()) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Lembretes de treino',
      importance: AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#208AEF',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted || current.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  if (granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === IosAuthorizationStatus.PROVISIONAL
  );
}

export async function getReminder(): Promise<ReminderConfig> {
  const raw = await AsyncStorage.getItem(REMINDER_KEY);
  if (!raw) return { enabled: false, hour: 18, minute: 0, notificationId: null };

  try {
    const parsed = JSON.parse(raw) as Partial<ReminderConfig>;
    return {
      enabled: Boolean(parsed.enabled),
      hour: typeof parsed.hour === 'number' ? parsed.hour : 18,
      minute: typeof parsed.minute === 'number' ? parsed.minute : 0,
      notificationId: parsed.notificationId ?? null,
    };
  } catch {
    return { enabled: false, hour: 18, minute: 0, notificationId: null };
  }
}

async function saveReminder(config: ReminderConfig) {
  await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(config));
}

export async function disableReminder() {
  const current = await getReminder();

  if (current.notificationId && supported()) {
    try {
      await Notifications.cancelScheduledNotificationAsync(current.notificationId);
    } catch {
      // já pode ter sido removida pelo sistema
    }
  }

  await saveReminder({ ...current, enabled: false, notificationId: null });
}

export async function enableReminder(hour: number, minute: number): Promise<boolean> {
  if (!supported()) return false;

  const allowed = await ensureNotificationPermission();
  if (!allowed) return false;

  const current = await getReminder();
  if (current.notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(current.notificationId);
    } catch {
      // ignora
    }
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Hora de treinar! 💪',
      body: 'Seu treino está esperando. Bora manter a consistência?',
      data: { url: '/aluno' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
    },
  });

  await saveReminder({ enabled: true, hour, minute, notificationId });
  return true;
}

export async function checkNewWorkouts(workoutIds: string[]) {
  const reminder = await getReminder();
  if (!reminder.enabled || workoutIds.length === 0) return;

  const raw = await AsyncStorage.getItem(KNOWN_WORKOUTS_KEY);
  let known: string[] = [];
  if (raw) {
    try {
      known = JSON.parse(raw) as string[];
    } catch {
      known = [];
    }
  }
  const newIds = workoutIds.filter((id) => !known.includes(id));

  await AsyncStorage.setItem(KNOWN_WORKOUTS_KEY, JSON.stringify(workoutIds));

  if (raw === null || newIds.length === 0) return;
  if (!(await ensureNotificationPermission())) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: newIds.length === 1 ? 'Novo treino disponível!' : `${newIds.length} novos treinos!`,
      body: 'Seu personal montou um treino novo para você. Confira na aba Treino.',
      data: { url: '/aluno' },
    },
    trigger: null,
  });
}
