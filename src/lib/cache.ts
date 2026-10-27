// Tiny in-memory cache for rarely-changing lookups (settings, templates, doctors).
// Concurrent callers share one in-flight request, and entries expire after `ttlMs`.
// Writers call invalidate("templates") etc. so edits show up immediately.

type Entry = { at: number; value?: unknown; promise?: Promise<unknown> };

const store = new Map<string, Entry>();
let generation = 0;

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit) {
    if (hit.promise) return hit.promise as Promise<T>;
    if (Date.now() - hit.at < ttlMs) return Promise.resolve(hit.value as T);
  }

  const startedAt = generation;
  const promise = load().then(
    (value) => {
      // Skip storing if something was invalidated while this request was in flight
      if (startedAt === generation) store.set(key, { at: Date.now(), value });
      else store.delete(key);
      return value;
    },
    (err) => {
      store.delete(key);
      throw err;
    },
  );
  store.set(key, { at: Date.now(), promise });
  return promise;
}

/** Drop every cached entry whose key starts with `prefix` (empty prefix clears everything). */
export function invalidate(prefix = "") {
  generation++;
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
