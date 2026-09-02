# App skeleton — route and data contract (Milestone 4 part 1)

The web app lives in [`web/`](../web) and is documented for operators in
[`web/README.md`](../web/README.md). This file is the **contract**: what each route promises, which
tables it reads, and which rules it must not break. Nothing here is deployed.

## Access

| | |
| --- | --- |
| Endpoint | `https://ztnppejmdwmhqstqsfks.supabase.co/rest/v1/` |
| Role | `anon`, read-only. The key is a publishable JWT whose only claim is `role=anon`; it is committed in `web/lib/config.js` on purpose so a clean checkout runs. |
| Schema | `mysports`, selected per request with the `Accept-Profile` header. |
| Assets | `https://pub-8373112ac08548d8af79fe58b7c2dcb9.r2.dev/` — `logos/{teamId}.png`, `network-logos/{slug}.png`, `grids/{sport}/grid_{date}.svg`. |

**Readable by anon:** `games`, `teams`, `game_broadcasts`, `networks_services`, `generated_grids`,
`canonical_decisions`, `viewer_game_eligibility`, `venues`, `conferences`, and the rest of the
content tables.

**Not readable, by design:** `source_observations` and `refresh_runs` — the evidence trail and the
run log. They return `401 permission denied`. No route may depend on them; `web/scripts/smoke.mjs`
asserts the boundary is still there on every run.

## The two-week-concept model

A "week" means two different things and the app never conflates them. Both live in
[`web/lib/weeks.js`](../web/lib/weeks.js).

| | Season week | Calendar week |
| --- | --- | --- |
| Applies to | `cfb`, `nfl` | `nba`, `nhl`, `mlb`, and the all-sports view |
| Identity | the **provider's** own `games.week` label | ISO week containing the day |
| Span | **derived** from `min(viewing_day)`…`max(viewing_day)` of the games carrying that label | Monday → Sunday, always 7 days |
| Example | CFB 2026 week 1 = Aug 29 → Sep 7, ten days across two calendar weeks | Aug 31 → Sep 6 |

The season-week span is derived, never assumed. CFB week 1 really does run ten days; the app reports
what the provider labelled rather than trimming it to look tidy.

## Day bucketing

Every route buckets on **`games.viewing_day`**, not `game_date`. `viewing_day` is the ET date shifted
by the 03:00 cutover (`render_policies.viewing_day_cutover`), so a game that starts at 10:40pm ET and
finishes after midnight stays on the night it belongs to. `game_date` is the raw ET calendar date and
is not what a viewer means by "tonight".

## Times

The database stores instants. `canonical_kickoff_at_et` currently carries the identical instant to
`canonical_kickoff_at_utc`, so the app reads the **UTC** column and formats it in
`America/New_York` in one place ([`web/lib/format.js`](../web/lib/format.js)) — the same rule the
renderer follows. A game with `kickoff_status = 'tbd'` displays `TBD`, never a fabricated time.

## Routes

### `/` — Today

**Query params:** `day` (`YYYY-MM-DD`, defaults to today in ET), `sport` (one of cfb/nfl/nba/nhl/mlb).

```
games?select=<GAME_SELECT>&viewing_day=eq.{day}[&sport=eq.{sport}]
     &order=canonical_kickoff_at_utc.asc.nullslast,id.asc
generated_grids?select=sport,game_date,generated_at&order=generated_at.desc
```

`GAME_SELECT` embeds both teams through the two FKs on `games`
(`teams!games_home_team_id_fkey`, `teams!games_away_team_id_fkey`) and the broadcast rows through
`game_broadcasts → networks_services`.

Shows, per game: ET time (or `TBD`), away @ home (`vs` at a neutral site) with each team's
`primary_color` as the card seam, the primary network's name, the TBD/Live/Final state, and the
final score when there is one.

When `generated_grids` holds a row for the selected **(sport, day)** — the panel is only offered when
exactly one sport is selected, because a grid is per (sport, day) by construction — the newest row's
`svg_asset_url` is rendered above the listing:

```
generated_grids?select=...&sport=eq.{sport}&game_date=eq.{day}
     &order=generated_at.desc,id.desc&limit=1
```

The archive is immutable — one row per distinct render of a day — so "newest" means the most
recently generated row for that key.

### `/weeks` — Weeks

**Query params:** `view` = `calendar` (default) | `season`.

Day-column **listings**, never a grid. One index query groups both views:

```
games?select=id,sport,season,week,viewing_day&order=viewing_day.asc,id.asc
```

then one detail query per week block — `gamesForRange(start, end)` for calendar weeks,
`gamesForSeasonWeek(sport, season, week)` for season weeks. Each block renders one column per day of
its span, and a season block shows its derived span explicitly.

### `/history` — History

**Query params:** `q` (free text), `sport`.

```
games?select=<GAME_SELECT>&result_status=eq.final[&sport=eq.{sport}]
     &order=completed_at.desc.nullslast,canonical_kickoff_at_utc.desc&limit=200
```

`q` filters in the request across team canonical/short names, abbreviations, and network names.

**Every card is a whole-card link to `games.boxscore_url`, `target="_blank"`, and the raw URL is
never rendered as text.** That is the contract from `pipeline/load.py`: `boxscore_url` is computed
once, at the first load that sees `result_status = 'final'`, and never overwritten — the completed
event card is the click target. A final game with no `boxscore_url` renders as a plain card rather
than a dead link.

## Page chrome — Banner, NavBanner, layout routing

The home page (`/`) opens on the full banner; `/weeks` and `/history` wear a compact bar cut from the
same art. The old `MySports` masthead is retired, and the wordmark everywhere is now
`MySports <b>TV</b>`, rendering `MYSPORTS TV` with the `TV` in gold.

[`web/app/layout.js`](../web/app/layout.js) renders `<Banner/>` **on the server** and passes it to
[`Chrome.js`](../web/components/Chrome.js), a client component that returns it on `/` and
[`<NavBanner/>`](../web/components/NavBanner.js) everywhere else. A client component cannot *import*
a server component but can place one it is handed, so the banner ships no JavaScript and only the
`usePathname()` lookup lives on the client. Both sit **outside** `.shell`, so the chrome bleeds the
full width while content stays in the 1100px column.

`NavBanner` takes `{sport, week, day}` and renders **only what it is given** — a page that knows its
sport says so, one that does not shows nothing rather than an empty pill. The standing
`all times ET · Cleveland` tag always rides along because it is true on every page; the stylesheet
drops it below 700px. Mounted from the layout it currently receives no props, which is the empty case
behaving as designed — a route that wants context passes it in.

### The `web/lib/banner-layout.json` contract

One file describes both breakpoints, and [`Banner.js`](../web/components/Banner.js) is a pure
function of it. Moving a mark is a JSON edit, never a code change. Under `pc` and `mobile`:

| Key | Meaning |
|---|---|
| `w`, `h` | stage size in `viewBox` units — 1400×280 and 390×280. Not pixels: the SVG scales to width |
| `tv` | `{cx, cy, h, href, ar}` — the cutout, placed exactly like a mark |
| `title`, `sub` | `{y, size, ls}` for the two `<text>` runs, plus `subhead` for the subhead string |
| `marks[]` | `{slug, kind, cx, cy, h, href, ar, pending}`, plus `hf` on `net` and `prog` |
| `sparks[]` | `{x, y, kind, r}` — `g`/`w` are four-point stars, `c`/`m`/`r` coloured dots |

Rules the component applies:

- **Placement is by centre.** `x = cx - w/2`, `y = cy - h/2`. Width is `h * ar`.
- **`ar` is the PNG's own width/height**, written by `scripts/build_brand_marks.py` — the one number
  the SVG cannot derive for itself. It is stored rather than measured at request time so the server
  component needs no image library.
- **Height depends on `kind`.** `league` draws at `h`; `net` and `prog` draw at `h * hf`, the frozen
  ink-normalization factor, so a thin wordmark and a fat roundel carry equal visual weight.
- **`pending: true` marks are skipped** — the slot is reserved in the layout but nothing is drawn.
  No mark is pending as of 2026-09-02.
- **Filter ids are namespaced per breakpoint** (`pc-` / `mo-`). Both SVGs are in the DOM at once with
  CSS hiding one, and SVG filter ids are document-global: share an id and the hidden copy can win the
  lookup, at which point Chromium renders **nothing at all** rather than an unfiltered shape.

Composition rules, the mark classes and the contrast rulings are in
[`docs/design/banner.md`](design/banner.md).

## Asset URL rules

`scripts/sync_assets.py` **lowercases every R2 key on upload**. NBA team ids are uppercase
abbreviations (`nba-CLE`), so `logos/nba-CLE.png` is a 404 while `logos/nba-cle.png` is a 200. Build
these URLs only through `teamLogoUrl()` / `networkLogoUrl()` in `web/lib/config.js`.

Grid keys keep the full filename — `grids/{sport}/grid_{date}.svg` — which is what
`scripts/register_grids.py` stores in `generated_grids.svg_asset_url`. (Until 2026-09-02 the uploader
stripped the `grid_` prefix and every archived grid URL in the database was a 404; fixed in the same
overnight run that added this document.)

## Verification

`web/scripts/smoke.mjs` (`npm run smoke`) asserts, against the live database:

1. 12 MLB games on `viewing_day` 2026-08-31, every one `final`, every score an integer, every one
   carrying a box score link;
2. 16 NFL games carry the week-1 label, and reports the derived span;
3. at least one `generated_grids` row **and** that its archived SVG resolves over the public R2 base;
4. `source_observations` and `refresh_runs` still refuse anon;
5. the team and broadcast embeds the pages depend on come back populated.

## Not in this milestone

No deployment. No viewer personalisation (`viewer_game_eligibility` is readable but unused — every
game is shown, not just the ones on Joe's services). No caching strategy. No network logo art. The
visual design is structural only; the approved prototype design is a later pass.
