# Handoff — Events & Shows Enhancement Batch (Chat session → adjacent Cowork session)

**Written:** 2026-09-02 (Wed), by the Chat architecture session in the "MySports" Claude Project.
**Audience:** a Cowork session picking up MySports work with no memory of this chat.
**Read this first, then** `claude/handoff-status.md` (build state as of 09-02, HEAD `40c32e9`, working rules 1–9) **and** `claude/enhancement-register.md` (this batch's requests and every decision).

## 1. What this session set out to do

Joe asked for six enhancements to MySports TV to be recorded, researched, and spec'd for the full build, with clarifying questions raised before anything downstream: NASCAR (Cup, O'Reilly Auto Parts, Craftsman Truck), UFC, IndyCar, WWE (Raw, SmackDown, PLEs), AEW (Dynamite, Collision), and network pregame/studio shows on the grid (GameDay, Big Noon Kickoff, FOX NFL Sunday, The NFL Today, FNIA, MNF Countdown, Prime/Netflix pregames) rendered on their network with show logos, hosts, and on-site location.

Venue ruling: research and spec in Chat; the research batch as an autonomous session; schema/renderer work as Claude Code prompts only after spec v0.5 is approved. **Nothing in the repo, the spec, or the rendering contract was touched.** Research-only, same posture as Brief 1.

## 2. What was accomplished

1. **Requests recorded** (E-01–E-06) with first-pass rights verification.
2. **Architecture assessment written and accepted:** do not add the six as game-shaped sports; open **spec v0.5 with a `programs` supertype** (every grid cell is a program; a team game is the `game` subtype; additive migration; `games` unchanged). Research later confirmed the model and added three fields: `segments[]` (UFC), broadcast `window_start/window_end` (UFC on CBS is a 2-hour slice of a 6-hour event; duplicate suppression must compare windows), and per-episode network for weekly shows (AEW Collision aired on TBS Aug 22; NASCAR Cup rotates network families three times a season).
3. **Ten decisions taken by Joe** (register §7–§9, summarized): programs supertype approved; **individual sport chips** (CFB · NFL · MLB · NBA · NHL · NASCAR w/ Cup/O'Reilly/Truck sub-filter · IndyCar · UFC · WWE · AEW; studio shows get no chip); race only for motorsport; UFC one card with a segment timeline and CBS window as a partial bar; **purchasable content excluded** (AEW PPVs out); studio shows = pregame + postgame bookends only; hosts/crews/locations **sourced from public announcements, never hand-curated**; one `nascar` sport with `series`; WWE = Raw/SmackDown/PLEs, **NXT dropped**; design pass option (a) — program-card silhouette mocked in the "MySports TV" prototype artifact first, then Claude Code implements as rendering-contract v1.7, sequenced after the D1/D3 session; UFC/NASCAR odds under the existing `show_odds` toggle.
4. **Research Brief 2 executed end to end** — six item docs, a summary, a changelog entry.
5. **One error owned:** the register initially re-raised the §21 betting-lines contradiction; it was resolved 08-31 (`show_odds`) and odds already render as of prompt 13. Rule logged: check handoff-status "SIX DECISIONS" before re-raising any decision.
6. **Confirmed build order:** v0.5 model → program-card prototype → studio shows (CFB now, NFL Sept 13) → WWE/AEW → UFC → NASCAR (Cup playoffs Sept 6–Nov 8) → IndyCar (2027 schedule, Dec 2026).

## 3. Flags the Cowork session must not miss

- **ESPN Akamai 403.** Every `site.api.espn.com` call, including the production NFL/NBA scoreboard paths, returned HTTP 403 (server: AkamaiGHost) from the cloud workspace on 09-02. If the GitHub Actions runner is blocked the same way, `schedule_refresh` is already failing on ESPN-fed sports. First action for any session with repo access: read the latest Actions run log; if 403, add a browser User-Agent to `adapters/espn.py` (same fix as the `pub-…r2.dev` rule). MLB (`statsapi`) and NHL (`api-web.nhle.com`) are unaffected.
- **Egress allowlist:** `cf.nascar.com` must be added before the NASCAR JSON feed can be verified from the cloud.
- **Fetchability matrix (verified 09-02):** CLEAN — espnpressroom.com, wwe.com, paramountplus.com UFC "Sneak Peak" page, paramountpressexpress.com, indycar.com, Jayski. JS-BLANK — espn.com stories, nascar.com schedule pages. UNTESTED — foxsports.com Press Pass, CBS Sports PR, NBC Sports Pressbox, ufc.com, press.wbd.com, cf.nascar.com. Test the untested ones from Joe's machine before any watch task depends on them.

## 4. Deliverables (all saved to the "MySports" Project, `claude/` folder)

| File | What it is |
|---|---|
| `claude/enhancement-register.md` | The batch's system of record. §1 requests with verified distribution; §2 recommendation; §3 architecture assessment and draft `programs` supertype; §4 rights findings with sources; §5 the nine questions; §6 flags; §7–§9 Joe's decisions with effects, including the corrected betting-lines item; §10 closure. Start here for "what did Joe decide." |
| `claude/research-brief-2-events-and-shows.md` | The brief that governed the research batch. Same shape as Brief 1 (ten-point checklist per item), updated with Joe's binding decisions and a rewritten item 6 requiring every host/crew/location source to be proven fetchable from a script. Reusable for any future non-game sport. |
| `claude/research-studio-shows.md` | Hardest item. Verified 2026 slots for GameDay, Big Noon Kickoff, FOX NFL Kickoff/Sunday, The NFL Today, FNIA, MNF Countdown, Prime/Netflix pregames, NASCAR pre/post-race. Source table with fetchability per network press room; ESPN Press Room verified clean (GameDay Date/Site/Game table). Proposes `studio_shows` registry + `studio_show_instances` observations with `source_url` on every row and a model-read parse of press pages by the Wednesday watch task. |
| `claude/research-wwe.md` | wwe.com verified as a Drupal, fetch-clean schedule source (the "Premier Shows" block is a season calendar). Raw Netflix / SmackDown USA (3h) / PLEs ESPN Unlimited / SNME Peacock. Flags the wwe.com "ESPN Unlimited + Netflix" dual listing for Oct 10 and Nov 28 as UNVERIFIED (likely international). Crews are reported (PWInsider/Fightful), not announced — proposes a "reported" authority tier. |
| `claude/research-aew.md` | WBD monthly HBO Max schedule as the only authority for Collision's night/network moves; September 2026 airings listed; Dynamite in Cleveland Oct 14. HBO Max is a simulcast of the linear feed (show TBS/TNT row, chip HBO Max). Bookend handling when the anchor PPV is excluded. |
| `claude/research-ufc.md` | Paramount+ "Sneak Peak" schedule page verified static and fetch-clean (event, venue, main-card time, CBS flag); Paramount Press Express for exact CBS windows; ufc.com/ESPN `mma/ufc` for segment times (UNVERIFIED). Upcoming cards through Nov 7. `segments[]` and broadcast windows as schema deltas; moneyline odds via The Odds API `mma_mixed_martial_arts`. |
| `claude/research-nascar.md` | Full 2026 rights map (FOX → Prime → TNT → USA/NBC+Peacock; O'Reilly on The CW; Truck FS1 + two FOX). Candidate backbone `cf.nascar.com/cacher/{year}/{series_id}/schedule-feed.json` (UNVERIFIED, not allowlisted); nascar.com schedule pages are JS-only; Jayski as fetchable fallback. Duration defaults by track type, `postponed_to`, per-race network row. Remaining 2026 Cup: Darlington Sept 6 → Homestead Nov 8. |
| `claude/research-indycar.md` | indycar.com verified fetch-clean with full season table and ecal/PDF exports; all races on FOX; season ends Sept 6 → defer the adapter to the 2027 schedule (Dec 2026). Lowest staleness risk in the app. |
| `claude/research-summary-2.md` | Cross-item synthesis: program-model recommendation with the three additions, biggest risk per item with mitigation, consolidated schema deltas, confirmed build order, UNVERIFIED closure list by owner, consolidated open questions for Joe (marquee lists, studio-city display, crew tiers, AEW bookends, UFC CBS card, SNME class, IndyCar deferral). |
| `claude/research-changelog-2026-09-02.md` | Entry to append to `claude/research-changelog.md`: requests, decisions, the self-correction with failure mode, verified sources, rights, the ESPN 403 standing gotcha, proposed watch-task additions, deliverable list. |
| `MySports_Events-And-Shows-Enhancement-Batch_ChatSummary_2026-09-02.docx` | MyLife HQ-branded exhaustive chat summary (nine pages). Filed to Joe's Projects > CLAUDE OPTIMIZATION > Claude Conversation Summaries, not the MySports Project. |

## 5. What is NOT done (do not assume)

- Spec v0.5 is **not written**; only the draft supertype in the register and the deltas in the summary exist. No migration 0009, no Claude Code prompt 14 drafted.
- The program-card silhouette is **not mocked** in the prototype artifact.
- No ESPN, NASCAR, UFC, FOX, CBS, NBC, or WBD source has been probed from Joe's machine; everything marked UNVERIFIED in the item docs is still unverified.
- Joe's non-blocking open questions (summary §6) are unanswered.
- The `research-changelog-2026-09-02.md` entry has **not** been appended to `research-changelog.md`; the ten files were placed in the Project by Joe, not merged into the repo.

## 6. Suggested next moves for the Cowork session

1. Verify the ESPN 403 on the Actions runner (§3) — this outranks the batch.
2. Draft **Claude Code prompt 14**: spec v0.5 program model + additive migration 0009, following handoff-status working rules 1–9 and the `joe-deploy-protocol` rules (certify Python for Windows; never write to the repo while a Claude Code prompt is in flight).
3. Probe the UNVERIFIED sources from Joe's machine (or with Cowork's device shell where network allows) and update the item docs in place, logging each result in the changelog.
4. Only after v0.5 lands: the program-card prototype pass, then studio shows.

## 7. Assumptions made writing this handoff

- Joe placed all ten `.md` files under `claude/` in the Project, using the filenames above unchanged.
- The Cowork session may or may not have repo access; §3 and §6 are written for either case.
- The `.docx` summary is listed for completeness but is not a Project artifact.
