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
