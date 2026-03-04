const LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const store = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetTime) {
    store.set(ip, { count: 0, resetTime: now + DAY_MS });
    return { allowed: true, remaining: LIMIT };
  }

  return {
    allowed: entry.count < LIMIT,
    remaining: Math.max(0, LIMIT - entry.count),
  };
}

export function consumeRateLimit(ip: string): void {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetTime) {
    store.set(ip, { count: 1, resetTime: now + DAY_MS });
  } else {
    entry.count++;
  }
}
