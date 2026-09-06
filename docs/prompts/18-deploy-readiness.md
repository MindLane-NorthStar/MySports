# Claude Code — Prompt 18: Deploy readiness, egress probe, housekeeping

**Venue:** Claude Code in VS Code, on the laptop, against `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`.
**Mode:** unattended rails. Self-committing stages. Retry once, then log-and-skip. Hard stops only for the four conditions in §Hard stops.
**Touches no database.** No migration, no DML, no connection to Supabase from this prompt at all.

---

## Preconditions — verify first, hard stop if any is false

1. Branch `main`, remote `github.com/MindLane-NorthStar/MySports`.
2. `git rev-parse --short HEAD` == `5a6dc65`.
3. `python -m unittest discover tests` reports **147 tests, all green**.
4. Working tree, expected exactly:
   - **modified:** `web/public/leagues/nascar_dark.png` (Cowork's fix — black letters whitened, colored bars kept)
   - **untracked:** `docs/feature-study/05-home-page-decisions.md` (the D1–D6 record)
   - **untracked:** `Claude outputs/` (one leftover file — deleted in Stage 1)
   - **untracked and ignored:** `artifacts/`, `assets/`
5. **CRLF check.** A Linux-side view of this repo reports ~13 files under `web/` as modified with insertions == deletions — that is line-ending noise from the bridge, not a real change. Run `git status` **from Windows**. If those files appear modified there too, run `git diff --numstat` on two of them; if insertions equal deletions, **do not stage them and do not "fix" them** — report the list and move on.

## Working rules (binding, unchanged)

1. Certify Python for Windows: no `%`-strftime, explicit `encoding=` on every `open()`, ASCII-only console output.
2. Secret gate **every** commit, scoped to **ADDED lines only**: `git diff -U0 --cached | grep "^+"`, searched for `CFBD_API_KEY=`, `SUPABASE_DB_URL=postgresql://mysports_writer.ztnppejmdwmhqstqsfks:[A-Za-z0-9]`, and `R2_SECRET_ACCESS_KEY=[A-Za-z0-9]`. **Never `findstr`** — it silently truncates long lines and under-scans minified files.
3. Never print a `.env` value.
4. Stage files **by explicit path**. Never `git add -A`, never `git add .`.
5. Every stage commits and pushes on its own, and reports the `rev-parse` pair (local and `origin/main`).
6. Name every bend. If you deviate from these instructions in any way, say so in the judgment log — never bend silently.

---

## Stage 1 — Housekeeping

1. Delete the stray root folder. From PowerShell: `Remove-Item -Recurse -Force "Claude outputs"`. Its five design-proof PNGs were already relocated to `artifacts/design-proofs/` by Cowork; the one remaining file is a duplicate of a document that lives in the Claude project. **Confirm `artifacts/design-proofs/` contains 5 PNGs before deleting**, and hard stop if it does not.
2. Append to `.gitignore`, so the folder cannot silently return:
   ```
   # Cowork scratch that should never be committed
   /Claude outputs/
   ```
3. Stage **exactly these three paths and nothing else**:
   - `web/public/leagues/nascar_dark.png`
   - `docs/feature-study/05-home-page-decisions.md`
   - `.gitignore`
4. Run the secret gate on the staged diff.
5. Commit: `chore: land NASCAR dark mark + home-page decision record; drop stray root folder`. Push. Report the rev-parse pair.

## Stage 2 — Reconcile the deployment contract with the code

Cowork found three places where `docs/deployment-contract.md` disagrees with what the repo actually does. **The code is right in all three cases; the contract is stale.** Fix the contract, do not change the code.

1. **§4 environment-variable table** names `SUPABASE_PUBLISHABLE_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The app reads **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** (`web/lib/config.js`, `web/.env.local.example`). Correct the contract to the real name.
2. **§5** states `schedule_refresh.yml` runs Mon/Wed/Fri. It has been **daily at 11:00 UTC** since 2026-09-03, with the reason recorded in the workflow's own header comment. Correct §5 and its budget line.
3. **§7 step 7** says "the three `NEXT_PUBLIC_*` values." There are **four** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_SCHEMA`, `NEXT_PUBLIC_ASSET_BASE_URL` — and **every one has a committed default in `web/lib/config.js`**, so a Vercel build cannot fail for want of them. Rewrite step 7 to say exactly that: the four variables should be set in Vercel so a future key rotation is a dashboard change rather than a code change, but they are **not** blocking for the first deploy.

Append a dated entry to the contract's §12 change log describing all three corrections. Commit: `docs: reconcile deployment contract §4/§5/§7 with the shipped code`. Push. Report the rev-parse pair.

## Stage 3 — Egress probe route (home-page decision D3)

Create `web/app/api/egress-probe/route.js`. Purpose: answer one question after deployment — **can server-side code running on Vercel reach the sports APIs, or does Akamai 403 it the way it 403s the Cowork cloud workspace?** The answer decides whether the app can refresh scores on demand or must keep paying for a timed GitHub Actions poll.

Requirements:

- `export const dynamic = 'force-dynamic';` and `export const runtime = 'nodejs';` — it must execute per request, never at build.
- `GET` fetches these four URLs **in parallel**, each with a 6-second timeout, and never throws:
  - `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
  - `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard`
  - `https://statsapi.mlb.com/api/v1/schedule?sportId=1`
  - `https://api-web.nhle.com/v1/schedule/now`
- **User-Agent: reuse the exact honest UA string the existing `adapters/espn.py` sends.** Do **not** send a bare browser User-Agent — a naked browser UA scores *worse* with Akamai than an honest bot UA (proven in prompt 15; it is opt-in behind `MYSPORTS_ESPN_BROWSER_UA=1` for that reason). Report which UA string you used.
- Responds with JSON: `{ checked_at, runtime, region, user_agent, results: [{ url, status, ms, bytes, error }] }`. `region` comes from Vercel's `process.env.VERCEL_REGION` when present, otherwise `"local"`.
- **Reads nothing secret**, accepts no query parameters, performs no writes. It is safe to leave deployed as a permanent diagnostic.
- Add a header comment saying what the route is for, that it exists to settle decision D3 in `docs/feature-study/05-home-page-decisions.md`, and that it may be deleted once that decision is closed.

**Prove it locally before committing.** Run the app on the laptop (`npm run build` then `npm run start`, or `npm run dev`), request `/api/egress-probe`, and paste the JSON response verbatim into the report. The laptop is known-clean, so expect four `200`s; anything else is a real finding and must be reported rather than retried away.

Commit: `feat(web): add /api/egress-probe diagnostic for the D3 refresh decision`. Push. Report the rev-parse pair.

## Stage 4 — Build and acceptance verification

Run in `web/`:

1. `npm ci`
2. `npm run build`
3. `npm run smoke`
4. From the repo root: `python -m unittest discover tests`

Report, with output pasted rather than summarized:

- **The full Next.js route table**, including the `○` / `ƒ` symbol beside each route.
- **Explicit confirmation that `/`, `/weeks`, and `/history` are all `ƒ` (Dynamic).** All three already carry `export const dynamic = 'force-dynamic'`; this is a regression check. **If any of them builds as `○` (Static), HARD STOP** — a statically generated home page would freeze the slate at build time and serve a stale day forever.
- Confirmation that `/api/egress-probe` also appears as `ƒ`.
- The smoke result. **29/30 is the expected pass count.** The one known failure is the `generated_grids` bare-key-versus-absolute-URL inconsistency, which is out of scope here and rides rendering-contract v1.7. Any *other* failure is a real finding.
- The unit test count (147 expected).
- Any build warnings, verbatim.

## Stage 5 — Report

Include, in this order:

1. Final `git rev-parse --short HEAD` and `git rev-parse --short origin/main` — they must match.
2. The commit chain this prompt produced, one line each.
3. The probe JSON from Stage 3, verbatim.
4. The build route table from Stage 4, verbatim.
5. Smoke and unit-test counts.
6. **Judgment log** — every decision you made that this prompt did not spell out, and every bend, with the reason. If you bent nothing, say "no bends."

---

## Hard stops (stop, commit nothing further, report)

1. The secret gate trips on any staged diff.
2. Any push is rejected.
3. `/`, `/weeks`, or `/history` builds as a static route.
4. `artifacts/design-proofs/` does not contain the 5 PNGs when Stage 1 checks for them.

There is no destructive-DB hard stop in this prompt because **this prompt touches no database.** If you find yourself opening a connection to Supabase, you have gone off-script — stop and report.

## Explicitly out of scope — do not do these

- **Creating the Vercel project or setting anything in the Vercel dashboard.** That is Joe's step and it follows this prompt.
- **The 15-minute in-window score poll.** It rides the home-page prompt, because it needs `prime_window_start` (decision D2) and the E1 card state model, and until E1 exists the poll has nothing to feed.
- **The `generated_grids` bare-key standardization.** Rides rendering-contract v1.7.
- **E1 / E3 / E4 or any part of the home page itself.**
- **Any database migration or data change.**
- **Any change to the locked card contract, the mobile grid addendum, or the program-card spec.**
