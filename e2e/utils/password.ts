import { randomInt } from 'node:crypto';

const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const lower = 'abcdefghijkmnopqrstuvwxyz';
const digits = '23456789';

function randomFrom(chars: string): string {
  return chars[randomInt(chars.length)];
}

// Swaps each letter and digit for a random one of the same kind and keeps special
// characters as they are, so the new password passes the same policy as the current one.
export function generateSimilarPassword(current: string): string {
  if (!/[A-Za-z0-9]/.test(current)) {
    throw new Error('The current password has no letters or digits to vary.');
  }

  let next = current;

  while (next === current) {
    next = [...current]
      .map((char) => {
        if (/[A-Z]/.test(char)) return randomFrom(upper);
        if (/[a-z]/.test(char)) return randomFrom(lower);
        if (/[0-9]/.test(char)) return randomFrom(digits);
        return char;
      })
      .join('');
  }

  return next;
}
