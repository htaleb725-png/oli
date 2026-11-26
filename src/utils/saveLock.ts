/**
 * Save Lock & Debounce Guard
 * --------------------------
 * Prevents duplicate submissions, overlapping updates, and race conditions
 * during weak or unstable internet connections without blocking normal UX.
 */

interface LockEntry {
  inFlight: boolean;
  lastTriggeredAt: number;
  lastResult?: any;
}

const lockRegistry = new Map<string, LockEntry>();

/**
 * Checks whether a given operation key is currently locked or within its debounce window.
 */
export function isSaveLocked(key: string, debounceMs: number = 700): boolean {
  const entry = lockRegistry.get(key);
  if (!entry) return false;
  if (entry.inFlight) return true;
  return Date.now() - entry.lastTriggeredAt < debounceMs;
}

/**
 * Attempts to acquire a short-lived save lock for a synchronous-trigger / async-persist action.
 * Returns `{ allowed: false, lastResult }` if a duplicate call arrived within `debounceMs`
 * or while an identical save is still in-flight.
 */
export function acquireSaveLock<T = any>(
  key: string,
  debounceMs: number = 800,
  autoReleaseMs: number = 1500
): { allowed: boolean; lastResult?: T; setResult: (res: T) => void; release: () => void } {
  const now = Date.now();
  const existing = lockRegistry.get(key);

  if (existing && (existing.inFlight || now - existing.lastTriggeredAt < debounceMs)) {
    return {
      allowed: false,
      lastResult: existing.lastResult as T | undefined,
      setResult: () => {},
      release: () => {}
    };
  }

  const entry: LockEntry = {
    inFlight: true,
    lastTriggeredAt: now
  };
  lockRegistry.set(key, entry);

  const timer =
    typeof window !== 'undefined'
      ? window.setTimeout(() => {
          const cur = lockRegistry.get(key);
          if (cur === entry) {
            cur.inFlight = false;
          }
        }, autoReleaseMs)
      : null;

  const release = () => {
    if (timer !== null && typeof window !== 'undefined') {
      window.clearTimeout(timer);
    }
    const cur = lockRegistry.get(key);
    if (cur === entry) {
      cur.inFlight = false;
    }
  };

  const setResult = (res: T) => {
    entry.lastResult = res;
  };

  // Opportunistic cleanup so registry never grows unbounded
  if (lockRegistry.size > 500) {
    const cutoff = now - 60000;
    for (const [k, v] of lockRegistry.entries()) {
      if (!v.inFlight && v.lastTriggeredAt < cutoff) {
        lockRegistry.delete(k);
      }
    }
  }

  return { allowed: true, setResult, release };
}

/**
 * Wraps an async persistence call so concurrent writes to the same key are serialized
 * and never interleave out-of-order under slow networks.
 */
const activePromiseQueues = new Map<string, Promise<any>>();

export function enqueueSerializedSave<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = activePromiseQueues.get(key) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => task())
    .finally(() => {
      if (activePromiseQueues.get(key) === next) {
        activePromiseQueues.delete(key);
      }
    });
  activePromiseQueues.set(key, next);
  return next;
}
