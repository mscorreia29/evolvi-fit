import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications-db';
import { supabase } from '@/lib/supabase';
import type { AppNotification } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

const typeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  mensagem: 'chatbubble-ellipses',
  feedback: 'chatbox-ellipses',
  treino: 'barbell',
  alimentacao: 'restaurant',
  cobranca: 'card',
  geral: 'notifications',
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const result = await fetchNotifications(profile.id);
    setItems(result.notifications);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`notifications-screen-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleOpen(item: AppNotification) {
    if (!item.read_at) {
      await markNotificationRead(item.id);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry,
        ),
      );
    }

    if (item.url === '/aluno') {
      router.dismissTo('/aluno');
    } else if (item.url?.startsWith('/')) {
      router.navigate(item.url as never);
    }
  }

  async function handleReadAll() {
    if (!profile) return;
    setMarking(true);
    await markAllNotificationsRead(profile.id);
    await load();
    setMarking(false);
  }

  if (loading) return <Loading label="Carregando notificações..." />;
  if (!session) return <Redirect href="/login" />;

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PhotoHero source={Images.gym} height={180} glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Notificações</Text>
            <Text style={styles.heroSub}>
              {unread > 0 ? `${unread} não lida(s)` : 'Tudo em dia por aqui'}
            </Text>
          </View>
        </View>
      </PhotoHero>

      <View style={styles.actionsRow}>
        <Text style={[styles.counter, { color: theme.textSecondary }]}>
          {items.length} {items.length === 1 ? 'aviso' : 'avisos'}
        </Text>
        {unread > 0 ? (
          <Pressable onPress={handleReadAll} disabled={marking} hitSlop={8}>
            {marking ? (
              <ActivityIndicator size="small" color={Brand.primary} />
            ) : (
              <Text style={styles.readAll}>Marcar todas como lidas</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="Nenhuma notificação"
          message="Novos treinos, planos alimentares, mensagens e cobranças aparecerão aqui."
        />
      ) : (
        items.map((item) => {
          const unreadItem = !item.read_at;
          return (
            <Pressable key={item.id} onPress={() => handleOpen(item)}>
              <Card
                style={[
                  styles.row,
                  unreadItem && {
                    borderColor: Brand.primary,
                    backgroundColor: theme.primarySoft,
                  },
                ]}>
                <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons
                    name={typeIcons[item.type] ?? 'notifications'}
                    size={19}
                    color={Brand.primary}
                  />
                </View>
                <View style={styles.content}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {unreadItem ? <View style={styles.unreadDot} /> : null}
                  </View>
                  {item.body ? (
                    <Text style={[styles.body, { color: theme.textSecondary }]} numberOfLines={3}>
                      {item.body}
                    </Text>
                  ) : null}
                  <Text style={[styles.date, { color: theme.textSecondary }]}>
                    {formatDateTime(item.created_at)}
                  </Text>
                </View>
                {item.url ? (
                  <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} />
                ) : null}
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTexts: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    fontSize: 13,
    fontWeight: '600',
  },
  readAll: {
    color: Brand.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.primary,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  date: {
    fontSize: 11,
  },
});
