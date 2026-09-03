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

/**
 * Every row of a query, paging past PostgREST's row cap.
 *
 * PostgREST answers an unbounded select with AT MOST 1000 rows and says nothing about it - no error,
 * no truncation flag, just a short array. That is silent data loss, and it bit the moment the season
 * loaded: `games` went from 375 rows to 1364, and the Weeks page's index quietly saw only the
 * earliest 1000, so the picker offered CFB weeks 1-10 and NFL weeks 1-9 and simply omitted the rest
 * of the season. Nothing looked broken; a third of the year was just missing.
 *
 * Pages with limit/offset until a short page arrives. Use it for any read whose row count grows with
 * the season - a bigger magic limit only moves the cliff to next year.
 */
export async function restAll(path, { pageSize = 1000, signal } = {}) {
  const joiner = path.includes('?') ? '&' : '?';
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await rest(`${path}${joiner}limit=${pageSize}&offset=${offset}`, { signal });
    out.push(...page);
    if (page.length < pageSize) return out;
  }
}

/** PostgREST `in` list: quote every value so ids with punctuation survive. */
export function inList(values) {
  return `(${values.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(',')})`;
}
