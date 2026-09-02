# MySports TV — Competitive Feature Study (2026-09-02)

**Owner:** Joe · **Run:** unattended, Chat (mobile) venue, started ~9:00 PM ET September 2, 2026 · **Set:** this index · `01-current-state.md` · `02-comparables.md` · `03-enhancement-specs.md` · `04-home-page-memo.md` · `mockups/home-page-candidates.html` · `artifacts/qa/feature-study/` · `feature-study.html` (phone artifact) · `patches/` (pointer text for `enhancement-register.md` §11 and `handoff-status.md`).

## Recommendation in three lines

1. Home page → **Option E, time-adaptive hybrid** on the locked card (`04-home-page-memo.md`, decision board D1–D6).
2. Build now, in order: **E1 card state (pre/in/post + score/clock) · E2 On now/Next up · E3 access glyph + off-services count · E4 data-as-of · E5 market-pending (before Sept 13) · E6 Tonight** (`03-enhancement-specs.md`).
3. Nothing here reopens a lock; three observations about the locks are filed under `03` §6 for Joe's eye only.

## Run log (ET, approximate)

| Time | Step |
|---|---|
| 21:00 | Read brief; named the venue mismatch (Chat, not cloud Claude Code); confirmed Playwright + Chromium available |
| 21:05 | Read spine: handoff-status, session snapshot, mobile-grid addendum, enhancement register, design extract, multisport options memo, prompt 15, prompt 12 §5 |
| 21:10 | Supabase SELECT via connector — no approval possible unattended; two strikes; skipped (A-02) |
| 21:12 | Probed egress: statsapi OK; ESPN 403 from bash (Akamai), OK via WebFetch; R2 not in allowlist |
| 21:15 | Pulled MLB Sept 3 / Sept 5 / Aug 31 (finals) from statsapi; CFB Sept 3/5 from NCAA.com; NFL Week 1 from FOX Sports |
| 21:20–21:50 | Comparables sweep: 17 searches, 4 full fetches, 40+ comparables touched, 14 in depth |
| 21:55 | Built fixture (102 games, 162 teams, logos from ESPN CDN); reconstructed both prototypes from project templates; 17 screenshots at 1440×900 and 390×844 |
| 22:10 | Wrote `01-current-state.md` |
| 22:20 | Wrote `02-comparables.md` |
| 22:35 | Wrote `03-enhancement-specs.md` |
| 22:45 | Wrote `04-home-page-memo.md` |
| 22:55 | Built mockups artifact (6 candidates × 3 days × clock scrubber); 20 screenshots; fixed font stack, time column, phone card width (see A-14) |
| 23:10 | Wrote this README, phone artifact, pointer patches; verification pass |

## Assumptions Log

| # | Ambiguity | Call made | Why | What Joe would change |
|---|---|---|---|---|
| A-01 | Brief assumes cloud tools (project_write, Artifact publish, Playwright, TaskCreate, PushNotification) | Ran in Chat with substitutes: outputs under `/mnt/user-data/outputs/docs/feature-study/`, presented HTML files instead of published artifacts, no push | Joe said start now, no questions | Re-run Phase 5's publish + push from a Cowork/cloud session, or file these outputs into the project by hand |
| A-02 | Supabase read-only queries | Skipped after two "No approval received" errors | Connector requires an interactive approval Joe could not give | RESOLVED 2026-09-02: the five SELECTs were run from the laptop (psycopg, read-only transaction, rolled back) and the results are filed in `01` §4 as "Verified 2026-09-02 (read-only)" |
| A-03 | Published artifacts unreadable here | Reconstructed both prototypes from `claude/src/*` templates with real data | Only path to "look at the app, not the docs" | Compare against the live artifacts; reconstruction artifacts are listed in `01` §7 |
| A-04 | R2 unreachable; network marks unavailable | Text pills stand in for marks in mockups and reconstructions | Egress allowlist | Rebuild the mockup with `build_app.py`'s mark pipeline from the laptop |
| A-05 | Team colors (`proto_colors.json` regenerable, not backed up) | Dominant saturated color derived from each ESPN CDN logo | No DB access | Substitute DB colors; seams and bands will shift slightly |
| A-06 | ESPN API 403 from bash, huge payloads via WebFetch | Used ESPN only to verify the endpoint and harvest four spreads; slates from NCAA.com / FOX Sports pages | Payload too large to store | None; runner is unaffected (handoff) |
| A-07 | NFL Sept 13 "if Week 1 data is loaded" | Loaded it from FOX Sports; Cleveland market modeled as Browns certain on WOIO 19 / CBS, all other regional CBS/FOX games `market-pending` until 506 maps post Sept 9 | Matches the handoff calendar | Replace with `market_coverage_nfl` once maps land |
| A-08 | Specimen moments | Thu Sept 3 8:10 PM (weeknight, MLB + CFB), Sat Sept 5 7:45 PM (CFB + Guardians), Sun Sept 13 1:20 PM (NFL) + 11:00 AM and 2:00 AM scrubs | Brief's three moments; clock scrubber covers the rest | Add an NHL/NBA night once the season starts |
| A-09 | Live scores/clocks in mockups | Simulated deterministically from the clock position; labeled as simulated | No live data on a future date | E1 replaces with real state |
| A-10 | Prime window for D/E | Weeknight 6:00 PM; CFB Saturday 12:00 PM; NFL Sunday 1:00 PM | Football afternoons are prime; memo D2 asks Joe | Decision board D2 |
| A-11 | "Joe's teams" for candidate F | Browns, Guardians, Cavaliers, Blue Jackets, Ohio State, flagged as assumption | Market inference only | D6 |
| A-12 | Reddit and Alexa/Google sources | Not fetched (search surfaced nothing direct; two-strikes) | Complaint themes covered by Consumer Reports, Substack, App Store pools | Add if a specific thread matters |
| A-13 | Doc contradiction | `handoff-status.md` header says "rewritten 2026-09-03" while the register and snapshot are 2026-09-02; treated as the newest doc | Content is post-prompt-15 | Fix the date |
| A-14 | Locked card at 390 px on CFB names | Mockup renders line 1 at 13px, 22px logos, and hides the 2/3-height mark slot on phones; production keeps the lock | Sandbox lacks Barlow, and even so the duel has ~150–170 px for two names once the mark slot is present; "Colorado State" cannot fit at any tier | Verify on the live artifact with Barlow; if it truncates there too, the tier rule should become fit-based (measured), which is the intent of the lock, not a change to it |
| A-15 | Doc contradiction | Register §7 Q9 says the §21 odds question was resolved 08-31; the memory brief carried it as open — the register wins | Register is the binding doc | None |
| A-16 | §11.9 "Tonight summary line" (options memo §5) vs E6 Tonight band | Treated as one derivation to be built once in the web app and reused by renderer v1.7 | Avoid drift | None |
| A-17 | Phone artifact "publish to the same URL" | One HTML file, republished by overwriting the same path; interim after Phase 2 was not possible in this venue (single-turn tool budget), final only | Venue | Publish as a Claude artifact from Cowork if wanted |
| A-18 | PushNotification | Unavailable in Chat; stated in the final message | Venue | None |

## Quality floor check (§8)

- Five docs: **yes**, cross-referenced, each leads with the recommendation.
- Comparables: 40+ touched, 14 in depth, ≥3 per category (a: ESPN, Apple Sports, NHL app, Sofascore family, FOX Sports; b: On TV Tonight, Live Sport TV Guide, LiveSportsOnTV, SMW, 506, Fubo, YouTube TV, Roku hub; c: TeamTracker, team ICS, bots, GitHub). Every claim attributed; fetch status ledger in `02` §7.
- Deep specs: 8 full (E1–E8) + 7 short (E9–E15) with prompt stubs on the eight; catalog scored; multi-user appendix and locked-decision challenges present.
- Home-page memo: six candidates + decision board; mockups render all six at 390 px and desktop, screenshot-verified (`artifacts/qa/feature-study/mock_*`).
- Not met: interim publish, push notification (venue). No locked decision reopened; no insider source named; no secret in any output; no repo or DB write attempted.
