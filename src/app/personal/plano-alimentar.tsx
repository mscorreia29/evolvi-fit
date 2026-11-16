import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { TextField } from '@/components/ui/text-field';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  createLocalId,
  deleteMealPlan,
  getMealPlan,
  mealPlanCalories,
  normalizeMeals,
  saveMealPlan,
} from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import type { Meal, MealItem, Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

function defaultMeals(): Meal[] {
  return [
    { id: createLocalId(), name: 'Café da manhã', time: '07:00', notes: '', items: [] },
    { id: createLocalId(), name: 'Almoço', time: '12:30', notes: '', items: [] },
    { id: createLocalId(), name: 'Lanche', time: '16:00', notes: '', items: [] },
    { id: createLocalId(), name: 'Jantar', time: '19:30', notes: '', items: [] },
  ];
}

function newItem(): MealItem {
  return { id: createLocalId(), name: '', quantity: '', calories: null };
}

export default function MealPlanEditorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const { student: studentId } = useLocalSearchParams<{ student?: string }>();

  const [student, setStudent] = useState<Profile | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [title, setTitle] = useState('Plano alimentar');
  const [notes, setNotes] = useState('');
  const [meals, setMeals] = useState<Meal[]>(defaultMeals);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile || !studentId) {
      setLoading(false);
      return;
    }

    const [{ data: studentData }, planResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', studentId).maybeSingle(),
      getMealPlan(studentId, profile.id),
    ]);

    setStudent((studentData as Profile | null) ?? null);

    if (planResult.plan) {
      setPlanId(planResult.plan.id);
      setTitle(planResult.plan.title || 'Plano alimentar');
      setNotes(planResult.plan.notes ?? '');
      setMeals(planResult.plan.meals?.length ? planResult.plan.meals : defaultMeals());
    } else {
      setPlanId(null);
      setTitle('Plano alimentar');
      setNotes('');
      setMeals(defaultMeals());
    }

    setLoading(false);
  }, [profile, studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totalCalories = useMemo(() => mealPlanCalories({ meals }), [meals]);

  function updateMeal(id: string, patch: Partial<Meal>) {
    setMeals((current) => current.map((meal) => (meal.id === id ? { ...meal, ...patch } : meal)));
  }

  function updateItem(mealId: string, itemId: string, patch: Partial<MealItem>) {
    setMeals((current) =>
      current.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              items: meal.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            }
          : meal,
      ),
    );
  }

  function addMeal() {
    setMeals((current) => [
      ...current,
      { id: createLocalId(), name: '', time: '', notes: '', items: [newItem()] },
    ]);
  }

  function removeMeal(id: string) {
    setMeals((current) => current.filter((meal) => meal.id !== id));
  }

  function addItem(mealId: string) {
    setMeals((current) =>
      current.map((meal) =>
        meal.id === mealId ? { ...meal, items: [...meal.items, newItem()] } : meal,
      ),
    );
  }

  function removeItem(mealId: string, itemId: string) {
    setMeals((current) =>
      current.map((meal) =>
        meal.id === mealId
          ? { ...meal, items: meal.items.filter((item) => item.id !== itemId) }
          : meal,
      ),
    );
  }

  async function handleSave() {
    if (!profile || !studentId) return;

    const cleaned = normalizeMeals(meals);

    if (cleaned.length === 0) {
      setError('Adicione pelo menos uma refeição com nome.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const result = await saveMealPlan({
      coachId: profile.id,
      studentId,
      title,
      notes,
      meals,
    });

    setSaving(false);

    if (result.error || !result.plan) {
      setError(result.error ?? 'Não foi possível salvar o plano alimentar.');
      return;
    }

    setPlanId(result.plan.id);
    setMessage('Plano salvo! Seu aluno recebeu uma notificação.');
  }

  function handleDelete() {
    if (!planId) return;

    Alert.alert('Remover plano', 'O aluno deixará de ver o plano alimentar atual.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteMealPlan(planId);
          if (result.error) {
            setError(result.error);
            return;
          }
          setPlanId(null);
          setTitle('Plano alimentar');
          setNotes('');
          setMeals(defaultMeals());
          setMessage('Plano removido.');
          router.back();
        },
      },
    ]);
  }

  if (loading) return <Loading label="Carregando plano alimentar..." />;

  if (!studentId || !student) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Aluno não encontrado"
          message="Abra a ficha do aluno e tente novamente."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PhotoHero source={Images.workout} height={180} imagePosition="top" glowColor={Brand.accent}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Plano alimentar</Text>
            <Text style={styles.heroSub}>{student.full_name ?? 'Aluno'}</Text>
          </View>
        </View>
      </PhotoHero>

      <Card>
        <SectionHeader title="Dados do plano" subtitle="O aluno vê estas informações na aba Alimentação" />
        <TextField
          label="Título do plano"
          value={title}
          onChangeText={setTitle}
          placeholder="Ex.: Plano para ganho de massa"
        />
        <TextField
          label="Orientações gerais"
          value={notes}
          onChangeText={setNotes}
          placeholder="Horários, hidratação, substituições..."
          multiline
          style={styles.multiline}
        />
        <View style={[styles.summary, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="flame" size={17} color={Brand.primary} />
          <Text style={[styles.summaryText, { color: theme.text }]}>
            {totalCalories} kcal estimadas • {meals.length} refeições
          </Text>
        </View>
      </Card>

      {meals.map((meal, index) => (
        <Card key={meal.id} style={styles.mealCard}>
          <View style={styles.mealHeader}>
            <View style={styles.mealTitleRow}>
              <View style={[styles.mealNumber, { backgroundColor: theme.primarySoft }]}>
                <Text style={styles.mealNumberText}>{index + 1}</Text>
              </View>
              <Text style={[styles.mealTitle, { color: theme.text }]}>Refeição</Text>
            </View>
            <Pressable onPress={() => removeMeal(meal.id)} hitSlop={8} accessibilityLabel="Remover refeição">
              <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={styles.flex2}>
              <TextField
                label="Nome"
                value={meal.name}
                onChangeText={(value) => updateMeal(meal.id, { name: value })}
                placeholder="Ex.: Café da manhã"
              />
            </View>
            <View style={styles.flex1}>
              <TextField
                label="Horário"
                value={meal.time}
                onChangeText={(value) => updateMeal(meal.id, { time: value })}
                placeholder="07:00"
              />
            </View>
          </View>

          <TextField
            label="Observações"
            value={meal.notes}
            onChangeText={(value) => updateMeal(meal.id, { notes: value })}
            placeholder="Ex.: 2 fatias de pão integral..."
          />

          <Text style={[styles.itemsLabel, { color: theme.textSecondary }]}>ALIMENTOS</Text>

          {meal.items.length === 0 ? (
            <Text style={[styles.emptyItems, { color: theme.textSecondary }]}>
              Nenhum alimento adicionado nesta refeição.
            </Text>
          ) : (
            meal.items.map((item) => (
              <View key={item.id} style={[styles.itemBlock, { backgroundColor: theme.backgroundSelected }]}>
                <View style={styles.row}>
                  <View style={styles.flex1}>
                    <TextField
                      label="Alimento"
                      value={item.name}
                      onChangeText={(value) => updateItem(meal.id, item.id, { name: value })}
                      placeholder="Ex.: Ovos mexidos"
                    />
                  </View>
                  <Pressable
                    onPress={() => removeItem(meal.id, item.id)}
                    hitSlop={8}
                    style={styles.itemRemove}
                    accessibilityLabel="Remover alimento">
                    <Ionicons name="close" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.row}>
                  <View style={styles.flex1}>
                    <TextField
                      label="Quantidade"
                      value={item.quantity}
                      onChangeText={(value) => updateItem(meal.id, item.id, { quantity: value })}
                      placeholder="Ex.: 3 unidades"
                    />
                  </View>
                  <View style={styles.flex1}>
                    <TextField
                      label="Calorias"
                      value={item.calories != null ? String(item.calories) : ''}
                      onChangeText={(value) => {
                        const digits = value.replace(/\D/g, '');
                        updateItem(meal.id, item.id, {
                          calories: digits ? Number(digits) : null,
                        });
                      }}
                      placeholder="Ex.: 210"
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </View>
            ))
          )}

          <Button
            title="Adicionar alimento"
            variant="secondary"
            onPress={() => addItem(meal.id)}
          />
        </Card>
      ))}

      <Button title="Adicionar refeição" variant="secondary" onPress={addMeal} />

      {error ? <Text style={[styles.error, { color: Brand.danger }]}>{error}</Text> : null}
      {message ? <Text style={[styles.success, { color: Brand.success }]}>{message}</Text> : null}

      <Button title="Salvar plano alimentar" onPress={handleSave} loading={saving} />

      {planId ? (
        <Button title="Remover plano alimentar" variant="danger" onPress={handleDelete} />
      ) : null}
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
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.md,
    padding: Spacing.two,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  mealCard: {
    gap: Spacing.two,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  mealNumber: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealNumberText: {
    color: Brand.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  itemsLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: Spacing.one,
  },
  emptyItems: {
    fontSize: 13,
    lineHeight: 18,
  },
  itemBlock: {
    borderRadius: Radius.md,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  itemRemove: {
    width: 36,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  success: {
    fontSize: 13,
    fontWeight: '600',
  },
});
