import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { PhotoHero } from '@/components/ui/photo-hero';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Images } from '@/constants/images';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { generateAiMealPlan } from '@/lib/ai';
import { formatDate } from '@/lib/format';
import { getMealPlan, mealPlanCalories } from '@/lib/nutrition';
import type { Meal, MealPlan } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

export default function StudentNutritionScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const isAutonomous = Boolean(
    (profile as unknown as { is_autonomous?: boolean } | null)?.is_autonomous,
  );
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const result = await getMealPlan(profile.id);
    setPlan(result.plan);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function generatePlan() {
    setGenerating(true);
    setNotice(null);
    setError(null);
    try {
      const result = await generateAiMealPlan();
      setNotice(`${result.title} criado com ${result.mealsCount} refeições.`);
      await load();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : 'Não foi possível gerar seu plano alimentar.',
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleGeneratePlan() {
    if (!plan) {
      void generatePlan();
      return;
    }

    Alert.alert('Gerar novo plano?', 'O plano atual será substituído pelo novo plano da IA.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Gerar', onPress: () => void generatePlan() },
    ]);
  }

  if (loading) return <Loading label="Carregando plano alimentar..." />;

  const totalCalories = mealPlanCalories(plan);

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PhotoHero source={Images.workout} height={240} imagePosition="top" glowColor={Brand.accent}>
        <View style={styles.kicker}>
          <Ionicons name="restaurant" size={12} color="#FFFFFF" />
          <Text style={styles.kickerText}>NUTRIÇÃO</Text>
        </View>
        <Text style={styles.heroTitle}>Alimentação</Text>
        <Text style={styles.heroSub}>
          {plan ? plan.title : 'Seu plano alimentar aparece aqui'}
        </Text>
        {plan ? (
          <View style={styles.heroStats}>
            <View style={styles.heroPill}>
              <Ionicons name="flame" size={14} color="#FFFFFF" />
              <Text style={styles.heroPillText}>{totalCalories} kcal</Text>
            </View>
            <View style={styles.heroPill}>
              <Ionicons name="time" size={14} color="#FFFFFF" />
              <Text style={styles.heroPillText}>{plan.meals.length} refeições</Text>
            </View>
          </View>
        ) : null}
      </PhotoHero>

      {isAutonomous ? (
        <Card style={[styles.aiCard, { borderColor: Brand.primary }]}>
          <SectionHeader
            title="Plano alimentar com IA"
            subtitle="Crie um plano alimentar personalizado a partir da sua anamnese."
          />
          <Button
            title={plan ? 'Gerar novo plano com IA' : 'Criar plano com IA'}
            onPress={handleGeneratePlan}
            loading={generating}
            variant="secondary"
          />
          {notice ? <Text style={[styles.aiFeedback, { color: Brand.primary }]}>{notice}</Text> : null}
          {error ? <Text style={[styles.aiFeedback, { color: Brand.danger }]}>{error}</Text> : null}
        </Card>
      ) : null}

      {!plan ? (
        <EmptyState
          icon="restaurant-outline"
          title="Plano alimentar em preparação"
          message={
            isAutonomous
              ? 'Toque em “Criar plano com IA” para gerar seu plano alimentar agora.'
              : 'Seu personal ainda não publicou um plano. Quando publicar, ele aparece aqui automaticamente.'
          }
        />
      ) : (
        <>
          {plan.notes ? (
            <Card style={[styles.notesCard, { borderColor: Brand.primary }]}>
              <View style={styles.notesHeader}>
                <Ionicons name="information-circle" size={18} color={Brand.primary} />
                <Text style={[styles.notesTitle, { color: theme.text }]}>Orientações</Text>
              </View>
              <Text style={[styles.notesText, { color: theme.textSecondary }]}>{plan.notes}</Text>
            </Card>
          ) : null}

          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Suas refeições</Text>
            <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>
              Atualizado em {formatDate(plan.updated_at)}
            </Text>
          </View>

          {plan.meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              expanded={expandedMeal === meal.id}
              onToggle={() => setExpandedMeal((current) => (current === meal.id ? null : meal.id))}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

function MealCard({
  meal,
  expanded,
  onToggle,
}: {
  meal: Meal;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const calories = meal.items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);

  return (
    <Card style={styles.mealCard}>
      <Pressable onPress={onToggle} style={styles.mealHeader}>
        <View style={[styles.mealIcon, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="restaurant-outline" size={18} color={Brand.primary} />
        </View>
        <View style={styles.mealInfo}>
          <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
          <Text style={[styles.mealMeta, { color: theme.textSecondary }]}>
            {[meal.time, `${meal.items.length} alimento(s)`, calories ? `${calories} kcal` : null]
              .filter(Boolean)
              .join(' • ')}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.mealBody}>
          {meal.notes ? (
            <Text style={[styles.mealNotes, { color: theme.textSecondary }]}>{meal.notes}</Text>
          ) : null}

          {meal.items.length === 0 ? (
            <Text style={[styles.mealNotes, { color: theme.textSecondary }]}>
              Nenhum alimento cadastrado nesta refeição.
            </Text>
          ) : (
            meal.items.map((item) => (
              <View key={item.id} style={[styles.itemRow, { borderColor: theme.border }]}>
                <View style={[styles.itemDot, { backgroundColor: Brand.primary }]} />
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                  {item.quantity ? (
                    <Text style={[styles.itemQuantity, { color: theme.textSecondary }]}>
                      {item.quantity}
                    </Text>
                  ) : null}
                </View>
                {item.calories != null ? (
                  <Text style={[styles.itemCalories, { color: Brand.primary }]}>
                    {item.calories} kcal
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kickerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  heroPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  aiCard: {
    borderWidth: 1,
    gap: Spacing.two,
  },
  aiFeedback: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  notesCard: {
    borderWidth: 1,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  notesText: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sectionMeta: {
    fontSize: 11,
  },
  mealCard: {
    gap: Spacing.two,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mealIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealInfo: {
    flex: 1,
    gap: 2,
  },
  mealName: {
    fontSize: 15,
    fontWeight: '800',
  },
  mealMeta: {
    fontSize: 12,
  },
  mealBody: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  mealNotes: {
    fontSize: 13,
    lineHeight: 19,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  itemInfo: {
    flex: 1,
    gap: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemQuantity: {
    fontSize: 12,
  },
  itemCalories: {
    fontSize: 12,
    fontWeight: '800',
  },
});
