import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { TextField } from '@/components/ui/text-field';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type FaqItem = { q: string; a: string };
type FaqCategory = { title: string; icon: keyof typeof Ionicons.glyphMap; items: FaqItem[] };

const FAQ: FaqCategory[] = [
  {
    title: 'Primeiros passos',
    icon: 'rocket-outline',
    items: [
      { q: 'Como criar minha conta?', a: 'Acesse /signup, preencha nome, email e senha. Sua conta entra em teste de 7 dias até o administrador aprovar.' },
      { q: 'Como adicionar meu primeiro aluno?', a: 'Vá em Alunos → Novo aluno, preencha os dados. O aluno receberá um email de confirmação.' },
      { q: 'Como montar um treino?', a: 'Vá em Treinos → Novo treino, escolha o aluno, adicione divisões (A, B, C) e exercícios da biblioteca ou manualmente.' },
    ],
  },
  {
    title: 'Treinos',
    icon: 'barbell-outline',
    items: [
      { q: 'Como adicionar vídeo a um exercício?', a: 'Na montagem do treino, em cada exercício há o campo "URL do vídeo (opcional)". Cole o link do YouTube/Vimeo.' },
      { q: 'Como arquivar um treino?', a: 'Na ficha do aluno, toque no ícone de arquivo ao lado do treino. O aluno deixa de ver o treino arquivado.' },
      { q: 'Como reativar um treino arquivado?', a: 'Na mesma ficha, toque no ícone de desfazer (seta curva) no treino arquivado.' },
      { q: 'O aluno não vê o treino, por quê?', a: 'Verifique se o status do treino é "Ativo" (não rascunho ou arquivado). Rascunhos não aparecem para o aluno.' },
    ],
  },
  {
    title: 'Alunos',
    icon: 'people-outline',
    items: [
      { q: 'Como ver o histórico de treinos do aluno?', a: 'Abra a ficha do aluno → seção "Últimas sessões". Toque em uma sessão para ver detalhes.' },
      { q: 'Como registrar avaliação física?', a: 'Na ficha do aluno, toque em "Avaliação" nas ações rápidas e preencha os campos.' },
      { q: 'Como definir metas para o aluno?', a: 'Na ficha do aluno, seção "Metas do aluno": digite o título e toque em +. Ajuste o progresso com ±10%.' },
      { q: 'Como enviar mensagem ao aluno?', a: 'Vá em Mensagens, escolha o aluno e envie. O aluno recebe notificação.' },
    ],
  },
  {
    title: 'Alimentação',
    icon: 'restaurant-outline',
    items: [
      { q: 'Como criar um plano alimentar?', a: 'Na ficha do aluno → "Alimentação". Adicione refeições e itens com calorias.' },
      { q: 'O aluno vê o plano alimentar?', a: 'Sim, na aba "Alimentação" do app do aluno, após você salvar o plano.' },
    ],
  },
  {
    title: 'Notificações',
    icon: 'notifications-outline',
    items: [
      { q: 'Como funcionam as notificações?', a: 'São enviadas automaticamente: novo treino, mensagem, feedback respondido, plano alimentar, cobrança.' },
      { q: 'O aluno não recebe notificações, por quê?', a: 'Verifique se o aluno ativou "Avisos neste aparelho" no perfil. No web, as notificações são in-app (sino).' },
    ],
  },
  {
    title: 'Conta e acesso',
    icon: 'key-outline',
    items: [
      { q: 'Como alterar minha senha?', a: 'Perfil → Alterar senha. Informe a senha atual e a nova.' },
      { q: 'Como redefinir a senha de um aluno?', a: 'Ficha do aluno → Acesso → "Enviar link de redefinição de senha".' },
      { q: 'Meu teste de 7 dias acabou, o que fazer?', a: 'Aguarde a aprovação do administrador. Ele pode aprovar ou estender o teste.' },
      { q: 'Como o admin aprova minha conta?', a: 'O administrador acessa o painel master, vê personais pendentes e aprova/estende o teste.' },
    ],
  },
  {
    title: 'Solução de problemas',
    icon: 'construct-outline',
    items: [
      { q: 'Tela preta ao clicar em notificação', a: 'Atualize o app (Ctrl+Shift+R no web). Se persistir, reporte o tipo de notificação.' },
      { q: 'Erro "violates row-level security"', a: 'Rode o SQL de correção (fix_rls_comunicacao.sql) no Supabase.' },
      { q: 'Dados não aparecem', a: 'Verifique se o SQL de upgrade correspondente foi executado no Supabase.' },
    ],
  },
];

export default function HelpCenterScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [tab, setTab] = useState<'faq' | 'chat'>('faq');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  // chat state
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Olá! Sou o assistente do Evolvi Fit. Como posso ajudar com o painel do personal?' },
  ]);
  const scrollRef = useRef<any>(null);

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: text }]);
    setChatLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-help', {
        body: { message: text, history: chatMessages.slice(-6) },
      });
      if (error) throw error;
      const reply = (data as { reply?: string })?.reply ?? 'Não consegui responder agora. Tente novamente.';
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'O chat com IA não está disponível no momento. Verifique se a edge function "ai-help" foi implantada no Supabase (veja instruções). Enquanto isso, use a aba FAQ.',
        },
      ]);
    } finally {
      setChatLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return FAQ;
    return FAQ.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (it) => it.q.toLowerCase().includes(term) || it.a.toLowerCase().includes(term),
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [query]);

  const total = filtered.reduce((s, c) => s + c.items.length, 0);

  return (
    <Screen>
      <PhotoHero source={Images.coach} height={180} imagePosition="top" glowColor={Brand.primary}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Central de ajuda</Text>
            <Text style={styles.heroSub}>Perguntas frequentes e suporte</Text>
          </View>
        </View>
      </PhotoHero>

      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setTab('faq')}
          style={[styles.tab, tab === 'faq' && styles.tabActive]}>
          <Text style={[styles.tabText, { color: tab === 'faq' ? '#FFFFFF' : theme.textSecondary }]}>
            FAQ
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('chat')}
          style={[styles.tab, tab === 'chat' && styles.tabActive]}>
          <Text style={[styles.tabText, { color: tab === 'chat' ? '#FFFFFF' : theme.textSecondary }]}>
            Chat IA
          </Text>
        </Pressable>
      </View>

      {tab === 'faq' ? (
        <>
          <TextField
            label="Buscar"
            value={query}
            onChangeText={setQuery}
            placeholder="Ex.: vídeo, aluno, senha..."
          />

      {total === 0 ? (
        <EmptyState
          icon="search-outline"
          title="Nenhum resultado"
          message="Tente outros termos ou entre em contato com o suporte."
        />
      ) : (
        filtered.map((cat) => (
          <Card key={cat.title} style={styles.card}>
            <SectionHeader title={cat.title} />
            {cat.items.map((it, idx) => {
              const key = `${cat.title}-${idx}`;
              const isOpen = open === key;
              return (
                <View key={key} style={styles.item}>
                  <Pressable onPress={() => setOpen(isOpen ? null : key)} style={styles.question}>
                    <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={Brand.primary} />
                    <Text style={[styles.q, { color: theme.text }]}>{it.q}</Text>
                  </Pressable>
                  {isOpen ? <Text style={[styles.a, { color: theme.textSecondary }]}>{it.a}</Text> : null}
                </View>
              );
            })}
          </Card>
        ))
      )}

      <Card>
        <SectionHeader title="Ainda precisa de ajuda?" />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Envie uma mensagem ao suporte ou ao administrador. Responderemos em breve.
        </Text>
        <Button
          title="Falar com suporte"
          variant="secondary"
          onPress={() => router.push('/personal/mensagens' as never)}
        />
      </Card>
        </>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.chatContainer}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.chatList}
            keyboardShouldPersistTaps="handled">
            {chatMessages.map((m, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  m.role === 'user'
                    ? [styles.bubbleUser, { backgroundColor: Brand.primary }]
                    : [styles.bubbleBot, { backgroundColor: theme.backgroundElement }],
                ]}>
                <Text style={{ color: m.role === 'user' ? '#FFFFFF' : theme.text, fontSize: 14, lineHeight: 20 }}>
                  {m.content}
                </Text>
              </View>
            ))}
            {chatLoading ? (
              <View style={[styles.bubble, styles.bubbleBot, { backgroundColor: theme.backgroundElement }]}>
                <ActivityIndicator size="small" color={Brand.primary} />
              </View>
            ) : null}
          </ScrollView>
          <View style={[styles.composer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Digite sua pergunta..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              multiline
              onSubmitEditing={sendChat}
            />
            <Pressable onPress={sendChat} disabled={chatLoading || !chatInput.trim()} style={styles.sendBtn}>
              <Ionicons name="send" size={20} color={chatInput.trim() ? Brand.primary : theme.textSecondary} />
            </Pressable>
          </View>
          <Text style={[styles.chatHint, { color: theme.textSecondary }]}>
            O chat com IA requer a edge function &quot;ai-help&quot; implantada no Supabase. Veja instruções.
          </Text>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  heroTexts: { flex: 1, gap: 2 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: 13 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { gap: Spacing.two },
  item: { gap: Spacing.one, paddingTop: Spacing.one },
  question: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  q: { flex: 1, fontSize: 14, fontWeight: '700' },
  a: { fontSize: 13, lineHeight: 19, paddingLeft: 24 },
  hint: { fontSize: 13, lineHeight: 19 },
  tabBar: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  tabText: { fontSize: 14, fontWeight: '800' },
  chatContainer: { flex: 1, gap: Spacing.two },
  chatList: { gap: Spacing.two, paddingBottom: Spacing.two },
  bubble: { padding: Spacing.two, borderRadius: Radius.lg, maxWidth: '85%' },
  bubbleUser: { alignSelf: 'flex-end' },
  bubbleBot: { alignSelf: 'flex-start' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.two,
  },
  input: { flex: 1, fontSize: 14, maxHeight: 100, padding: 0 },
  sendBtn: { padding: 4 },
  chatHint: { fontSize: 11, textAlign: 'center' },
});
