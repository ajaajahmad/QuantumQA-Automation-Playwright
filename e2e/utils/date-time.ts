export function localTimestamp(): string {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, '0');

  return [
    pad(now.getDate()),
    pad(now.getMonth() + 1),
    now.getFullYear(),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

export function appendLocalTimestamp(text: string): string {
  return `${text}_${localTimestamp()}`;
}

// YYYY-MM-DD in local time, the format the report APIs take.
export function isoDate(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// MM/DD/YYYY, the format the report date range input shows and accepts.
export function usDate(date: Date): string {
  const [year, month, day] = isoDate(date).split('-');
  return `${month}/${day}/${year}`;
}

// The same day of the month, the given number of months ahead (or back, for a negative count).
export function monthsAhead(months: number, day = 15): Date {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + months, day);
}

export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
