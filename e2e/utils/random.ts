// A short, time-based suffix so records created by parallel or repeated runs never collide.
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 36).toString(36)}`.toUpperCase();
}

// Digits only, never starting with 0, e.g. for made-up DLT IDs.
export function randomDigits(length: number): string {
  return Array.from({ length }, (_, index) =>
    index === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10),
  ).join('');
}
