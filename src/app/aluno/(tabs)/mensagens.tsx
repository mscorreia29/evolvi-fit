import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect } from 'expo-router';
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
import { EmptyState } from '@/components/ui/empty-state';
import { PhotoHero } from '@/components/ui/photo-hero';
import { TextField } from '@/components/ui/text-field';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMyCoachId } from '@/lib/comms';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

export default function StudentMessagesScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const isAutonomous = Boolean(
    (profile as unknown as { is_autonomous?: boolean } | null)?.is_autonomous,
  );
  const [coachId, setCoachId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const cid = await getMyCoachId(profile.id);
    setCoachId(cid);
    if (!cid) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('coach_id', cid)
      .eq('student_id', profile.id)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages((data as ChatMessage[]) ?? []);
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('coach_id', cid)
      .eq('student_id', profile.id)
      .neq('sender_id', profile.id)
      .is('read_at', null);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSend() {
    if (!profile || !coachId || !text.trim()) return;
    setSending(true);
    setError(null);
    const content = text.trim();
    setText('');
    const { error: sendError } = await supabase.from('messages').insert({
      coach_id: coachId,
      student_id: profile.id,
      sender_id: profile.id,
      content,
    });
    setSending(false);
    if (sendError) {
      setText(content);
      setError('Não foi possível enviar a mensagem. Tente novamente.');
      return;
    }
    await load();
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }

  if (isAutonomous) {
    return <Redirect href={'/aluno/suporte' as never} />;
  }

  if (!loading && !coachId) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <PhotoHero source={Images.student} height={180} glowColor={Brand.primary}>
          <Text style={styles.heroTitle}>Mensagens</Text>
          <Text style={styles.heroSub}>Fale com seu personal pelo app</Text>
        </PhotoHero>
        <View style={{ padding: Spacing.three }}>
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="Sem personal vinculado"
            message="Você precisa estar vinculado a um personal para enviar mensagens."
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <View style={{ flex: 1 }}>
        <PhotoHero source={Images.student} height={140} glowColor={Brand.primary} contentStyle={{ paddingVertical: 16 }}>
          <Text style={styles.heroTitle}>Mensagens</Text>
          <Text style={styles.heroSub}>Conversa com seu personal</Text>
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
                Nenhuma mensagem ainda. Envie a primeira para seu personal.
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
        {error ? (
          <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text>
        ) : null}
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
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: Radius.lg, padding: Spacing.two, gap: 2 },
  error: { fontSize: 13, fontWeight: '600', paddingHorizontal: Spacing.three },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.two,
    borderTopWidth: 1,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
