// ─────────────────────────────────────────────────────────────────────────────
// A small client-side cache for the admin panel's reads.
//
// Every page fetches in a `useEffect` on mount, and App Router remounts the
// page component on each client-side navigation — so moving between sections
// re-queried Supabase every time, even when nothing had changed.
//
// This sits in api.ts between the pages and the server actions, so no page
// component has to change. It does three things:
//
//   • TTL        a read is reused for `ttlMs` before it goes back to the server
//   • dedupe     two components asking for the same thing at the same moment
//                share one in-flight request instead of firing two
//   • tags       a write clears the reads it affects, so the UI never shows
//                data the user just changed
//
// Deliberately NOT a replacement for react-query — it makes the existing
// pattern fast without rewriting 25 pages. If this app later adopts react-query
// properly, this layer comes out.
// ─────────────────────────────────────────────────────────────────────────────

/** Cache groups. A write names the ones it invalidates. */
export type CacheTag =
  | 'orgs'
  | 'staff'
  | 'onboarding'
  | 'patients'
  | 'providers'
  | 'individualProviders'
  | 'rmps'
  | 'subAdmins'
  | 'appointments'
  | 'orders'
  | 'transactions'
  | 'refunds'
  | 'disputes'
  | 'audit'
  | 'features'
  | 'settings'
  | 'pricing'
  | 'banners'
  | 'serviceCategories'
  | 'push'
  | 'reports'
  | 'navCounts';

type Entry = { value: unknown; expiresAt: number; tag: CacheTag };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

// Default lifetime. Long enough that flicking between sections is instant,
// short enough that a change made in the Supabase dashboard shows up quickly.
const DEFAULT_TTL_MS = 60_000;

// Module state on the server would be shared across every request and every
// signed-in admin, which is both a correctness and a privacy problem. The cache
// is therefore browser-only; on the server every call passes straight through.
const cacheable = () => typeof window !== 'undefined';

const keyFor = (tag: string, args: unknown[]) =>
  args.length === 0 ? tag : `${tag}:${JSON.stringify(args)}`;

/**
 * Wrap a read so repeat calls within `ttlMs` are served from memory.
 *
 * @example
 *   list: cached('orgs', a.listOrgs)
 */
export function cached<A extends unknown[], R>(
  tag: CacheTag,
  fn: (...args: A) => Promise<R>,
  ttlMs: number = DEFAULT_TTL_MS,
): (...args: A) => Promise<R> {
  return (...args: A): Promise<R> => {
    if (!cacheable()) return fn(...args);

    const key = keyFor(tag, args);
    const hit = store.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return Promise.resolve(hit.value as R);
    }

    // Someone else is already asking for exactly this — wait on their request
    // rather than firing a second identical one.
    const pending = inflight.get(key);
    if (pending) return pending as Promise<R>;

    const request = fn(...args)
      .then((value) => {
        store.set(key, { value, expiresAt: Date.now() + ttlMs, tag });
        return value;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, request as Promise<unknown>);
    return request;
  };
}

/**
 * Wrap a write so the reads it affects are dropped once it succeeds.
 *
 * Invalidation runs only on success: if the write threw, the cached data is
 * still what the server holds, and throwing it away would just cause a
 * pointless refetch.
 *
 * @example
 *   suspend: invalidating(['orgs', 'staff'], a.setOrgStatus)
 */
export function invalidating<A extends unknown[], R>(
  tags: CacheTag[],
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const result = await fn(...args);
    invalidate(...tags);
    return result;
  };
}

/** Drop every cached read carrying any of these tags. */
export function invalidate(...tags: CacheTag[]): void {
  if (!cacheable() || tags.length === 0) return;
  const wanted = new Set<string>(tags);
  for (const [key, entry] of store) {
    if (wanted.has(entry.tag)) store.delete(key);
  }
}

/** Drop everything — used after a platform wipe. */
export function invalidateAll(): void {
  store.clear();
}
