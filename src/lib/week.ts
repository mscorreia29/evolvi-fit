const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export type WeeklyPoint = { date: string; label: string; value: number };

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
