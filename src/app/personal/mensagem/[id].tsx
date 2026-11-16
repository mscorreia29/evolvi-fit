import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card } from '@/components/ui/card';
import { PhotoHero } from '@/components/ui/photo-hero';
import { TextField } from '@/components/ui/text-field';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

export default function CoachChatScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [student, setStudent] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    const [{ data: s }, { data: msgs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('messages')
        .select('*')
        .eq('coach_id', profile.id)
        .eq('student_id', id)
        .order('created_at', { ascending: true })
        .limit(200),
    ]);
    setStudent((s as Profile) ?? null);
    setMessages((msgs as ChatMessage[]) ?? []);
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('coach_id', profile.id)
      .eq('student_id', id)
      .neq('sender_id', profile.id)
      .is('read_at', null);
  }, [profile, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSend() {
    if (!profile || !id || !text.trim()) return;
    setSending(true);
    const content = text.trim();
    setText('');
    await supabase.from('messages').insert({
      coach_id: profile.id,
      student_id: id,
      sender_id: profile.id,
      content,
    });
    setSending(false);
    await load();
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1 }}>
        <PhotoHero source={Images.coach} height={150} glowColor={Brand.primary} contentStyle={{ paddingVertical: 16 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.heroTitle}>{student?.full_name ?? 'Aluno'}</Text>
          <Text style={styles.heroSub}>Chat com o aluno</Text>
        </PhotoHero>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.four }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Card style={{ alignItems: 'center', paddingVertical: Spacing.four }}>
              <Ionicons name="chatbubbles-outline" size={28} color={Brand.primary} />
              <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
                Nenhuma mensagem ainda. Envie orientações para seu aluno.
              </Text>
            </Card>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === profile?.id;
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: Brand.primary }
                      : { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 },
                  ]}>
                  <Text style={{ color: mine ? '#FFFFFF' : theme.text, fontSize: 14, lineHeight: 20 }}>
                    {item.content}
                  </Text>
                  <Text style={{ color: mine ? 'rgba(255,255,255,0.7)' : theme.textSecondary, fontSize: 10, marginTop: 2 }}>
                    {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          }}
        />
        <View style={[styles.composer, { backgroundColor: theme.backgroundElement, borderTopColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <TextField value={text} onChangeText={setText} placeholder="Escreva uma mensagem..." multiline />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={sending || !text.trim()}
            style={[styles.sendBtn, { backgroundColor: Brand.primary, opacity: sending || !text.trim() ? 0.5 : 1 }]}>
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: Radius.lg, padding: Spacing.two, gap: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, padding: Spacing.two, borderTopWidth: 1 },
  sendBtn: { width: 46, height: 46, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
