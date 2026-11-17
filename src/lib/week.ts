const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export type WeeklyPoint = { date: string; label: string; value: number };
export type CalendarDay = {
  key: string;
  weekday: string;
  day: number;
  month: string;
  isToday: boolean;
  hasWorkout: boolean;
};

export function buildWeek(performedAt: string[]): WeeklyPoint[] {
  const days: WeeklyPoint[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = date.toDateString();
    days.push({
      date: key,
      label: WEEKDAYS[date.getDay()],
      value: performedAt.filter((value) => new Date(value).toDateString() === key).length,
    });
  }

  return days;
}

export function buildCalendarWeek(performedAt: string[]): CalendarDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const sessionDays = new Set(performedAt.map((value) => new Date(value).toDateString()));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);

    return {
      key: date.toDateString(),
      weekday: WEEKDAY_LABELS[date.getDay()],
      day: date.getDate(),
      month: MONTH_LABELS[date.getMonth()],
      isToday: date.toDateString() === today.toDateString(),
      hasWorkout: sessionDays.has(date.toDateString()),
    };
  });
}

export function computeStreak(performedAt: string[]) {
  const dayKeys = new Set(performedAt.map((value) => new Date(value).toDateString()));
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);

  if (!dayKeys.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dayKeys.has(cursor.toDateString())) return 0;
  }

  let streak = 0;
  while (dayKeys.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
