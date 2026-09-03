# Brief 2 probe report — read-only source verification (2026-09-02)

Ran from Joe's laptop, which has open network access. The Akamai block recorded in
`docs/research/research-changelog.md` (2026-09-02: "ESPN `site.api.espn.com` returned Akamai 403 for
ALL endpoints from the cloud workspace") is a **cloud-workspace condition, not a source condition** —
every ESPN endpoint below answered 200 on the first try with an honest User-Agent.

**Method.** One GET per URL, honest UA first (`MySports/0.5 (personal TV-grid project; read-only
source probe)`), falling back to a browser UA only on 401/403. Nothing parsed beyond structure,
nothing written to the database, no credentials sent. A known-clean control was probed alongside so a
network-level failure would be distinguishable from a source-level one.

**Control:** `espnpressroom.com/us/press-releases/` returned **200, static-fetchable HTML**
(~4,389 chars of visible text). The network path is clean, so every result below is a property of the
source rather than of this machine's connection.

## Results

| Source | Status | Fetchable? | UA | Shape (two lines) |
|---|---|---|---|---|
| `site.api.espn.com/.../racing/nascar-premier/scoreboard` | **200** | static JSON | honest | JSON object, keys `leagues, season, day, events, provider`. `events` is a list (1 on this date). |
| `.../racing/nascar-secondary/scoreboard` | **200** | static JSON | honest | Identical shape to nascar-premier; `events` list of 1. Same parser serves all three series. |
| `.../racing/nascar-truck/scoreboard` | **200** | static JSON | honest | Identical shape again. Confirms one adapter covers cup/oreilly/truck, matching the one-sport-plus-series decision. |
| `.../racing/irl/scoreboard` | **200** | static JSON | honest | Same envelope for IndyCar — `leagues, season, day, events, provider`. No separate shape to learn. |
| `.../mma/ufc/scoreboard` | **200** | static JSON | honest | Same ESPN scoreboard envelope for UFC; `events` list of 1. |
| `cf.nascar.com/cacher/2026/1/schedule-feed.json` | **200** | static JSON | honest | **JSON array of 113**; element keys `start_time, end_time, event_name, race_id, track_id, track_name, race_name, series_id`. |
| `cf.nascar.com/cacher/2026/2/schedule-feed.json` | **200** | static JSON | honest | JSON array of 92, identical element shape. Series id 2 resolves. |
| `cf.nascar.com/cacher/2026/3/schedule-feed.json` | **200** | static JSON | honest | JSON array of 73, identical element shape. Series id 3 resolves. |
| `foxsports.com/presspass/` | **200** | static-fetchable HTML | honest | 218KB, ~2,202 chars visible text, 44 links, 0 tables. Carries `window.__NUXT__` and `ng-app` markers — content is present but thin; deep pages may hydrate. |
| `cbspressexpress.com/cbs-sports/` | **200** | static-fetchable HTML | honest | 68KB, ~1,830 chars visible text, 104 links, 0 tables. No JS framework markers — plain server-rendered. |
| `nbcsportsgrouppressbox.com` | **200** | static-fetchable HTML | honest | 400KB (read cap), ~6,233 chars visible text, 257 links. No JS framework markers — the richest of the three press rooms. |
| `ufc.com/events` | **200** | static-fetchable HTML | honest **+ certifi CA bundle** | 337KB, ~5,859 chars visible text, 170 links. See the TLS note below — this is NOT a source refusal. |
| `press.wbd.com/us` | **200** | static-fetchable HTML | honest **+ certifi CA bundle** | 153KB, ~6,083 chars visible text, 180 links. Same TLS note. |
| *(control)* `espnpressroom.com/us/press-releases/` | **200** | static-fetchable HTML | honest | 228KB, ~4,389 chars visible text, 44 links. Matches its last known-good state. |

**Nothing was JS-blank.** Every HTML source returned real server-rendered text.

## Two findings worth acting on

**1. `ufc.com` and `press.wbd.com` need certifi's CA bundle, not Python's default trust store.**
Both first failed with `SSL: CERTIFICATE_VERIFY_FAILED — unable to get local issuer certificate`, on
the honest UA *and* on a browser UA. That reads like a block but is not one: retried with
`ssl.create_default_context(cafile=certifi.where())` both returned **200** immediately. The chain
these two serve cannot be completed from this machine's default store. Any adapter touching them must
pass certifi's bundle explicitly (or use `requests`, which does so by default). Recording this because
the failure mode is easy to misdiagnose as bot protection and then "worked around" with a fake UA that
would not have helped.

**2. The NASCAR schedule feed already carries `end_time`, which the duration defaults are guessing at.**
Every element of `cf.nascar.com/cacher/2026/{1,2,3}/schedule-feed.json` has both `start_time` and
`end_time`, plus `track_id` / `track_name`. `data/duration_defaults.json` currently ships **provisional**
per-track-type race durations precisely because `research-nascar.md` has no repo copy — this feed can
replace those guesses with real per-race windows, and `track_id` is the natural key for a per-track
default. All three series ids resolve (113 / 92 / 73 entries for 2026), so one adapter covers cup,
oreilly and truck exactly as the one-sport-plus-`series` decision assumes.

## What this does not say

Shape notes only. No field-level parsing, no schema inference beyond top-level keys, and no judgement
about whether any feed's *content* is correct or complete. Nothing here was written to the database,
and no adapter was built — this run is architecture only.
