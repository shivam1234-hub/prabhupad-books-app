// Tiny concurrency helpers for book downloads (no RN imports — usable from Node tests).

// Runs `worker` over `items` with at most `size` running at once.
export async function runPool<T>(items: T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) await worker(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, lane));
}

// Returns a wrapper that lets at most `size` wrapped calls be in flight; the rest
// wait in FIFO order. Shared across chapters so total requests stay capped.
export function createLimiter(size: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function limit<R>(fn: () => Promise<R>): Promise<R> {
    // A released slot is handed straight to the next waiter (active unchanged),
    // so a new caller can't slip in between and exceed the cap.
    if (active >= size) await new Promise<void>((r) => waiting.push(r));
    else active++;
    try {
      return await fn();
    } finally {
      const nextWaiter = waiting.shift();
      if (nextWaiter) nextWaiter();
      else active--;
    }
  };
}
