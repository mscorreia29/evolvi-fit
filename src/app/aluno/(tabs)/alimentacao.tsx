import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { generateAiMealPlan, saveAiMealPreferences } from '@/lib/ai';
import { formatDate } from '@/lib/format';
import { getMealPlan, mealPlanCalories } from '@/lib/nutrition';
import type { AiMealPreferences, Meal, MealPlan, Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type MealPreferenceKey = 'breakfast' | 'snack' | 'lunch' | 'dinner' | 'fruits';

type MealPlanInput = {
  favoriteFoods: string;
  mealRoutine: string;
  mealPreferences: AiMealPreferences;
};

const MEAL_PREFERENCE_FIELDS: {
  key: MealPreferenceKey;
  label: string;
  placeholder: string;
}[] = [
  { key: 'breakfast', label: 'Café da manhã', placeholder: 'Ex.: ovos, pão integral, café com leite' },
  { key: 'snack', label: 'Lanche', placeholder: 'Ex.: iogurte, castanhas, biscoito integral' },
  { key: 'lunch', label: 'Almoço', placeholder: 'Ex.: arroz, feijão, frango grelhado, salada' },
  { key: 'dinner', label: 'Jantar', placeholder: 'Ex.: sopa, peixe, omelete, salada leve' },
  { key: 'fruits', label: 'Frutas', placeholder: 'Ex.: banana, maçã, mamão, morango' },
];

function buildFavoriteFoods(preferences: AiMealPreferences) {
  return MEAL_PREFERENCE_FIELDS.map((field) => ({
    label: field.label,
    value: (preferences[field.key] ?? '').trim(),
  }))
    .filter((field) => field.value.length > 0)
    .map((field) => `${field.label}: ${field.value}`)
    .join(' | ');
}

function getSavedMealInput(profile: Profile | null): MealPlanInput | null {
  const saved = profile?.ai_meal_preferences;
  const mealPreferences: AiMealPreferences = {
    breakfast: saved?.breakfast ?? '',
    snack: saved?.snack ?? '',
    lunch: saved?.lunch ?? '',
    dinner: saved?.dinner ?? '',
    fruits: saved?.fruits ?? '',
    routine: saved?.routine ?? profile?.ai_meal_routine ?? '',
  };
  const hasStructured = MEAL_PREFERENCE_FIELDS.some(
    (field) => (mealPreferences[field.key] ?? '').length >= 3,
  );
  const legacyFoods = profile?.ai_meal_favorite_foods?.trim() ?? '';
  if (!hasStructured && !legacyFoods) return null;

  return {
    favoriteFoods: hasStructured ? buildFavoriteFoods(mealPreferences) : legacyFoods,
    mealRoutine: mealPreferences.routine ?? '',
    mealPreferences,
  };
}

function formatKcal(value: number | null | undefined) {
  return value == null ? '—' : Math.round(value).toLocaleString('pt-BR');
}

function calorieGoalLabel(goal: 'lose' | 'gain' | 'maintain' | null | undefined) {
  if (goal === 'lose') return 'Emagrecer';
  if (goal === 'gain') return 'Ganhar massa';
  return 'Manter peso';
}

function calorieGoalHint(goal: 'lose' | 'gain' | 'maintain' | null | undefined) {
  if (goal === 'lose') return 'Déficit de cerca de 500 kcal/dia para perda de gordura.';
  if (goal === 'gain') return 'Superávit de cerca de 300 kcal/dia para ganho de massa.';
  return 'Meta de manutenção calculada com base na sua rotina de treinos.';
}

export default function StudentNutritionScreen() {
  const theme = useTheme();
  const { profile, refreshProfile } = useAuth();
  const isStudent = profile?.role === 'aluno';
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'generate' | 'save'>('generate');
  const [savingForm, setSavingForm] = useState(false);
  const [mealPreferences, setMealPreferences] = useState<AiMealPreferences>(() => ({
    breakfast: profile?.ai_meal_preferences?.breakfast ?? '',
    snack: profile?.ai_meal_preferences?.snack ?? '',
    lunch: profile?.ai_meal_preferences?.lunch ?? '',
    dinner: profile?.ai_meal_preferences?.dinner ?? '',
    fruits: profile?.ai_meal_preferences?.fruits ?? '',
  }));
  const [mealRoutine, setMealRoutine] = useState(
    profile?.ai_meal_preferences?.routine ?? profile?.ai_meal_routine ?? '',
  );
  const [formError, setFormError] = useState<string | null>(null);

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

  async function generatePlan(input: MealPlanInput) {
    setGenerating(true);
    setNotice(null);
    setError(null);
    try {
      const result = await generateAiMealPlan(input);
      const calorieSummary = result.calories
        ? ` Gasto: ${formatKcal(result.calories.burn)} kcal/dia. Meta: ${formatKcal(result.calories.target)} kcal/dia.`
        : '';
      setNotice(`${result.title} criado com ${result.mealsCount} refeições.${calorieSummary}`);
      await load();
      await refreshProfile();
      return true;
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : 'Não foi possível gerar seu plano alimentar.',
      );
      return false;
    } finally {
      setGenerating(false);
    }
  }

  async function savePreferences(input: MealPlanInput) {
    if (!profile) return false;
    setSavingForm(true);
    setNotice(null);
    setError(null);
    try {
      await saveAiMealPreferences(
        profile.id,
        input.favoriteFoods,
        input.mealRoutine,
        input.mealPreferences,
      );
      setNotice('Ficha por refeição salva. Seu plano atual foi mantido.');
      await refreshProfile();
      return true;
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível salvar a ficha alimentar.',
      );
      return false;
    } finally {
      setSavingForm(false);
    }
  }

  function openForm(mode: 'generate' | 'save') {
    const saved = profile?.ai_meal_preferences;
    setFormMode(mode);
    setMealPreferences({
      breakfast: saved?.breakfast ?? '',
      snack: saved?.snack ?? '',
      lunch: saved?.lunch ?? '',
      dinner: saved?.dinner ?? '',
      fruits: saved?.fruits ?? '',
    });
    setMealRoutine(saved?.routine ?? profile?.ai_meal_routine ?? '');
    setFormError(null);
    setShowForm(true);
  }

  async function handleGeneratePlan() {
    const saved = getSavedMealInput(profile);
    if (saved) {
      await generatePlan(saved);
      return;
    }
    openForm('generate');
  }

  async function handleSubmitForm() {
    const routine = mealRoutine.trim();
    const structured: AiMealPreferences = {
      breakfast: mealPreferences.breakfast?.trim() ?? '',
      snack: mealPreferences.snack?.trim() ?? '',
      lunch: mealPreferences.lunch?.trim() ?? '',
      dinner: mealPreferences.dinner?.trim() ?? '',
      fruits: mealPreferences.fruits?.trim() ?? '',
      routine,
    };
    const hasFood = MEAL_PREFERENCE_FIELDS.some(
      (field) => (structured[field.key] ?? '').length >= 3,
    );
    if (!hasFood || routine.length < 5) {
      setFormError('Preencha pelo menos uma refeição e conte um pouco sobre sua rotina.');
      return;
    }

    setFormError(null);
    const input = {
      favoriteFoods: buildFavoriteFoods(structured),
      mealRoutine: routine,
      mealPreferences: structured,
    };
    const success =
      formMode === 'generate' ? await generatePlan(input) : await savePreferences(input);
    if (success) setShowForm(false);
  }

  if (loading) return <Loading label="Carregando plano alimentar..." />;

  const totalCalories = mealPlanCalories(plan);

  return (
    <>
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
              <Text style={styles.heroPillText}>
                {totalCalories} {plan.ai_generated ? 'kcal/refeição' : 'kcal'}
              </Text>
            </View>
            <View style={styles.heroPill}>
              <Ionicons name="time" size={14} color="#FFFFFF" />
              <Text style={styles.heroPillText}>{plan.meals.length} refeições</Text>
            </View>
          </View>
        ) : null}
      </PhotoHero>

      {isStudent ? (
        <Card style={[styles.aiCard, { borderColor: Brand.primary }]}>
          <SectionHeader
            title="Plano alimentar com IA"
            subtitle="Gera o plano usando a ficha salva. Se ainda não houver ficha, ela será aberta."
          />
          <Button
            title={plan ? 'Gerar novo plano com IA' : 'Criar plano com IA'}
            onPress={() => void handleGeneratePlan()}
            loading={generating}
            variant="secondary"
          />
          <Button
            title="Editar ficha"
            onPress={() => openForm('save')}
            loading={savingForm}
            variant="secondary"
          />
          {notice ? <Text style={[styles.aiFeedback, { color: Brand.primary }]}>{notice}</Text> : null}
          {error ? <Text style={[styles.aiFeedback, { color: Brand.danger }]}>{error}</Text> : null}
        </Card>
      ) : null}

      {plan?.daily_burn_kcal != null && plan.daily_target_kcal != null ? (
        <Card style={[styles.calorieCard, { borderColor: Brand.accent }]}>
          <View style={styles.calorieHeader}>
            <Ionicons name="flame" size={18} color={Brand.accent} />
            <Text style={[styles.calorieTitle, { color: theme.text }]}>Gasto e meta calórica</Text>
            <View style={[styles.calorieBadge, { backgroundColor: Brand.accent }]}>
              <Text style={styles.calorieBadgeText}>{calorieGoalLabel(plan.calorie_goal)}</Text>
            </View>
          </View>
          <View style={styles.calorieStats}>
            <View style={styles.calorieStat}>
              <Text style={[styles.calorieLabel, { color: theme.textSecondary }]}>Você gasta</Text>
              <Text style={[styles.calorieValue, { color: theme.text }]}>
                {formatKcal(plan.daily_burn_kcal)}
              </Text>
              <Text style={[styles.calorieUnit, { color: theme.textSecondary }]}>kcal por dia</Text>
            </View>
            <View style={styles.calorieStat}>
              <Text style={[styles.calorieLabel, { color: theme.textSecondary }]}>Você come</Text>
              <Text style={[styles.calorieValue, { color: Brand.primary }]}>
                {formatKcal(plan.daily_target_kcal)}
              </Text>
              <Text style={[styles.calorieUnit, { color: theme.textSecondary }]}>kcal por dia</Text>
            </View>
          </View>
          <Text style={[styles.calorieHint, { color: theme.textSecondary }]}>
            {calorieGoalHint(plan.calorie_goal)} Busque cerca de{' '}
            {formatKcal(Math.round(plan.daily_target_kcal / 5))} kcal por refeição.
          </Text>
        </Card>
      ) : null}

      {!plan ? (
        <EmptyState
          icon="restaurant-outline"
          title="Plano alimentar em preparação"
          message="Toque em “Criar plano com IA” para gerar seu plano alimentar agora."
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
              aiGenerated={Boolean(plan.ai_generated)}
              expanded={expandedMeal === meal.id}
              onToggle={() => setExpandedMeal((current) => (current === meal.id ? null : meal.id))}
            />
          ))}
        </>
      )}
      </Screen>

      <Modal
        visible={showForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForm(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowForm(false)}>
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
            onPress={() => undefined}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Ionicons name="restaurant-outline" size={20} color={Brand.primary} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Ficha por refeição</Text>
              </View>
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                {formMode === 'save'
                  ? 'Atualize o que você gosta em cada refeição. Seu plano atual continua o mesmo.'
                  : plan
                    ? 'Ao enviar, o plano atual será substituído. Conte o que você gosta em cada refeição.'
                    : 'Conte o que você gosta em cada refeição para a IA montar seu plano.'}
              </Text>
              {MEAL_PREFERENCE_FIELDS.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  value={mealPreferences[field.key] ?? ''}
                  onChangeText={(value) =>
                    setMealPreferences((current) => ({ ...current, [field.key]: value }))
                  }
                  placeholder={field.placeholder}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              ))}
              <TextField
                label="Rotina alimentar"
                value={mealRoutine}
                onChangeText={setMealRoutine}
                placeholder="Ex.: 5 refeições por dia, almoço fora de casa, jantar leve..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              {formError ? (
                <Text style={[styles.modalError, { color: Brand.danger }]}>{formError}</Text>
              ) : null}
              <View style={styles.modalActions}>
                <Button
                  title="Cancelar"
                  variant="secondary"
                  onPress={() => setShowForm(false)}
                  style={styles.modalButton}
                />
                <Button
                  title={formMode === 'generate' ? 'Montar plano' : 'Salvar ficha'}
                  onPress={() => void handleSubmitForm()}
                  loading={formMode === 'generate' ? generating : savingForm}
                  disabled={generating || savingForm}
                  style={styles.modalButton}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function MealCard({
  meal,
  aiGenerated,
  expanded,
  onToggle,
}: {
  meal: Meal;
  aiGenerated: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const totalCalories = meal.items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
  const calories =
    aiGenerated && meal.items.length > 0 ? Math.round(totalCalories / meal.items.length) : totalCalories;

  return (
    <Card style={styles.mealCard}>
      <Pressable onPress={onToggle} style={styles.mealHeader}>
        <View style={[styles.mealIcon, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="restaurant-outline" size={18} color={Brand.primary} />
        </View>
        <View style={styles.mealInfo}>
          <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
          <Text style={[styles.mealMeta, { color: theme.textSecondary }]}>
            {[
              meal.time,
              `${meal.items.length} ${aiGenerated ? 'opção(ões)' : 'alimento(s)'}`,
              calories ? (aiGenerated ? `~${calories} kcal/opção` : `${calories} kcal`) : null,
            ]
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
  calorieCard: {
    borderWidth: 1,
    gap: Spacing.two,
  },
  calorieHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  calorieTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  calorieBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  calorieBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  calorieStats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  calorieStat: {
    flex: 1,
    gap: 2,
  },
  calorieLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  calorieValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  calorieUnit: {
    fontSize: 11,
  },
  calorieHint: {
    fontSize: 12,
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
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  modalContent: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  modalError: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  modalButton: {
    flex: 1,
  },
});
