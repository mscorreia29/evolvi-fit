export type Role = 'admin' | 'personal' | 'aluno';

export type AccountStatus = 'pending' | 'trial' | 'approved' | 'rejected' | 'blocked';

export type AdminSettings = {
  id: number;
  default_trial_days: number;
  auto_block_expired_trials: boolean;
  allow_self_signup: boolean;
  max_students_per_personal: number | null;
  updated_at: string;
  updated_by: string | null;
};

export type AdminAuditLog = {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type Profile = {
  id: string;
  role: Role;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  status: AccountStatus;
  trial_ends_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  blocked_at: string | null;
  blocked_by: string | null;
  block_reason: string | null;
  paid_until: string | null;
  last_payment_at: string | null;
  payment_notes: string | null;
  xp: number;
  notes: string | null;
  ai_meal_favorite_foods?: string | null;
  ai_meal_routine?: string | null;
  cover_url: string | null;
  created_at: string;
};

export type WaterLog = {
  id: string;
  student_id: string;
  log_date: string;
  amount_ml: number;
  goal_ml: number;
  updated_at: string;
};

export type MealLog = {
  id: string;
  student_id: string;
  log_date: string;
  meal_name: string;
  calories: number | null;
  notes: string | null;
  created_at: string;
};

export type Exercise = {
  id: string;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  video_url: string | null;
  instructions: string | null;
};

export type WorkoutExercise = {
  id: string;
  workout_day_id: string;
  exercise_id: string | null;
  name: string;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  notes: string | null;
  video_url: string | null;
  instructions: string | null;
  order_index: number;
  exercise?: Pick<Exercise, 'video_url' | 'instructions' | 'muscle_group'> | null;
};

export type WorkoutDay = {
  id: string;
  workout_id: string;
  label: string;
  order_index: number;
  workout_exercises: WorkoutExercise[];
};

export type WorkoutStatus = 'draft' | 'active' | 'archived';

export type Workout = {
  id: string;
  coach_id: string;
  student_id: string;
  name: string;
  description: string | null;
  status: WorkoutStatus;
  created_at: string;
};

export type WorkoutWithDays = Workout & {
  workout_days: WorkoutDay[];
};

export type WorkoutSession = {
  id: string;
  workout_id: string;
  student_id: string;
  performed_at: string;
  duration_seconds: number | null;
  notes: string | null;
  completed: boolean;
};

export type SessionExercise = {
  id: string;
  session_id: string;
  workout_exercise_id: string | null;
  name: string;
  sets_done: number | null;
  reps_done: string | null;
  weight_kg: number | null;
  completed: boolean;
  order_index: number;
};

export type WorkoutSessionWithDetails = WorkoutSession & {
  workout?: { name: string } | null;
  session_exercises?: SessionExercise[];
};

export type PhysicalAssessment = {
  id: string;
  coach_id: string;
  student_id: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  measurements: Record<string, string | number | null>;
  created_at: string;
};

export type StudentGoal = {
  id: string;
  coach_id: string;
  student_id: string;
  title: string;
  target_date: string | null;
  status: 'active' | 'done' | 'cancelled';
  progress: number;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  created_at: string;
};

export type CoachSettings = {
  coach_id: string;
  feedback_interval_days: number;
  payment_reminder_days_before: number;
  updated_at: string;
};

export type DailyChallengeLog = {
  id: string;
  student_id: string;
  challenge_date: string;
  challenge_key: string;
  completed: boolean;
  created_at: string;
};

export type WeeklyCheckin = {
  id: string;
  student_id: string;
  week_start: string;
  performance: number | null;
  motivation: number | null;
  difficulty: number | null;
  had_difficulties: boolean | null;
  notes: string | null;
  created_at: string;
};

export type CoachNote = {
  id: string;
  coach_id: string;
  student_id: string;
  content: string;
  created_at: string;
};

export type StudentFeedback = {
  id: string;
  coach_id: string;
  student_id: string;
  category: string;
  message: string;
  status: 'open' | 'read' | 'resolved';
  coach_reply: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  coach_id: string;
  student_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

export type PaymentDue = {
  id: string;
  coach_id: string;
  student_id: string;
  description: string;
  amount: number | null;
  due_date: string;
  status: 'pending' | 'paid' | 'late' | 'cancelled';
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

export type MealItem = {
  id: string;
  name: string;
  quantity: string;
  calories: number | null;
};

export type Meal = {
  id: string;
  name: string;
  time: string;
  notes: string;
  items: MealItem[];
};

export type MealPlan = {
  id: string;
  coach_id: string;
  student_id: string;
  title: string;
  notes: string | null;
  ai_generated?: boolean;
  meals: Meal[];
  created_at: string;
  updated_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
};
