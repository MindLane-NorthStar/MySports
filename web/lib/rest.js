// The one place this app talks to PostgREST. Server-side only: every caller is a Server Component or
// the smoke script, so the request never leaves the server even though the key is publishable.
//
// Two tables are intentionally unreadable by anon and nothing here may depend on them:
// source_observations and refresh_runs (the evidence trail and the run log). If a query starts
// returning 401 with "permission denied for table", that is the boundary, not a bug to route around.

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SCHEMA } from './config.js';

export class RestError extends Error {
  constructor(status, path, body) {
    super(`REST ${status} on ${path}: ${body}`);
    this.name = 'RestError';
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

/**
 * GET one PostgREST path (everything after /rest/v1/), e.g.
 *   rest('games?select=id&sport=eq.mlb&limit=5')
 *
 * `cache: 'no-store'` is deliberate: these pages read live data, and a cached page showing a stale
 * score is worse than a slower one. Revisit per-route when there is real traffic to reason about.
 */
export async function rest(path, { signal } = {}) {
  const url = `${SUPABASE_URL.replace(/\/*$/, '')}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Accept-Profile': SUPABASE_SCHEMA,
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });
  const text = await res.text();
  if (!res.ok) throw new RestError(res.status, path, text.slice(0, 500));
  return text ? JSON.parse(text) : [];
}

/** PostgREST `in` list: quote every value so ids with punctuation survive. */
export function inList(values) {
  return `(${values.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(',')})`;
}
