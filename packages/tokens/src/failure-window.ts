export interface FailureState {
  count: number;
  windowStart: Date;
  lockedUntil: Date | null;
}

export interface FailurePolicy {
  limit: number;
  windowMs: number;
  lockMs: number;
}

const fifteenMinutes = 15 * 60 * 1000;

export const ipPolicy: FailurePolicy = { limit: 10, windowMs: fifteenMinutes, lockMs: fifteenMinutes };
export const prefixPolicy: FailurePolicy = { limit: 5, windowMs: fifteenMinutes, lockMs: fifteenMinutes };

export function isLocked(state: FailureState | null, now: Date): { locked: false } | { locked: true; retryAfterSeconds: number } {
  if (state?.lockedUntil == null || state.lockedUntil.getTime() <= now.getTime()) return { locked: false };
  return { locked: true, retryAfterSeconds: Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 1000) };
}

export function registerFailure(state: FailureState | null, policy: FailurePolicy, now: Date): FailureState {
  const fresh = state === null || now.getTime() - state.windowStart.getTime() >= policy.windowMs;
  const count = fresh ? 1 : state.count + 1;
  const windowStart = fresh ? now : state.windowStart;
  return { count, windowStart, lockedUntil: count >= policy.limit ? new Date(now.getTime() + policy.lockMs) : null };
}
