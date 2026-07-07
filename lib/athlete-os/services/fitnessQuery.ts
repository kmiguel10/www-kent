type QueryResult<T> = { data: T[] | null; error: unknown };

/**
 * Runs a Supabase select with a few retries on transient failure. `build` is a
 * function so each attempt issues a fresh query. Throws the last error if every
 * attempt fails — callers should surface that as a non-200 so the client can
 * retry instead of rendering a misleading "no data" empty state.
 *
 * Motivation: the Athlete OS dashboard fires ~7 heavy (up-to-3000-row) queries
 * in parallel on mount; under that burst a single query can transiently error,
 * and silently falling back to an empty array blanks a whole panel/tab.
 */
export async function selectWithRetry<T = Record<string, unknown>>(
  build: () => PromiseLike<QueryResult<T>>,
  attempts = 3,
): Promise<T[]> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const { data, error } = await build();
      if (error) throw error;
      return data ?? [];
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  throw lastErr;
}
