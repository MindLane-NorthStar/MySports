# The 34 watch links, audited — 2026-09-09, prompt 78 block C

**What this is.** Every value in `WATCH` (`web/lib/config.js`), fetched from outside with the honest
project UA, redirects followed, plus a judgement a status code cannot make: *what the page actually
is*. **Nothing was changed from this table except `guardians-tv`.** The rest is a record for Joe to
rule on.

**Why it exists.** `WATCH` is hand-maintained and nothing checked it. `guardians-tv` pointed at a hard
404 and it surfaced because Joe tapped it. `web/scripts/probes/watch-links.mjs` now runs nightly and
reports — but **a status check proves a URL is alive, not that it is right**, and the third column
below is the part it can never do.

**The count is 34, not 35.** The brief says 35; the map holds 34 entries. Counted, not assumed.

---

## The three that are alive and WRONG

A status check calls all three healthy. Only a human can see it.

| service | points at | what it actually is |
|---|---|---|
| `the-cw` | `cwtv.com/shows/cw-live/` | **200 that is a 404.** Redirected to `?sorry-page-not-found&show=cw-live` — a not-found page served with a success status. **FIXED in prompt 79** to `cwtv.com/`: `/live/` and `/watch-live/` land on the same not-found page and `/schedule/` is listings rather than a way to watch, so the homepage is the honest answer. |
| `fs1` | `fox.com/live/` | Redirects to `fox.com/` — the **network homepage**, not an FS1 page, and the same URL `fox` uses. FS1 and Fox are different channels sharing one link. |
| `big-ten-network` | `btn.com/watch/` | Redirects to `bigten.org/btn/about/` — an **About page**, not a watch page. |

And one the brief already named, which no automated check can ever catch:

| service | points at | what it actually is |
|---|---|---|
| the local affiliate (`wuab-43`) | `fox8.com` | **A different station's site.** Returns 403 to a bot and 200 in a browser. Nothing about the response says it is the wrong property. |

## The five that cannot be checked

403 to an honest bot UA. **This is "could not check", never "dead"** — `lib/livescores.js` records an
Akamai 403 against a browser UA on 2026-09-03, and `adapters/common.py` records that a half-disguised
Chrome UA scores worse than an honest one. Calling these dead would train the reader to ignore the
report, which is the failure mode the whole design is against.

`hbo-max` · `tnt` · `trutv` · `wuab-43` — plus `tbs`, which returned 200 on one run and 403 on
another, which is itself the argument for not gating on this.

## The full table

Final URL is shown only where it differs from the stored one.

| service | stored URL | lands on | status | note |
|---|---|---|---|---|
| `abc` | https://abc.com/watch-live | — | 200 | live area |
| `acc-network` | https://www.espn.com/watch/ | — | 200 | ESPN's watch hub — correct, shared by five ESPN properties |
| `apple-tv` | https://tv.apple.com/ | — | 200 | storefront |
| `big-ten-network` | https://www.btn.com/watch/ | https://bigten.org/btn/about/ | 200 | **About page, not watch** |
| `cbs` | https://www.cbs.com/live-tv/stream/ | — | 200 | live area |
| `cbs-sports-network` | https://www.cbssports.com/cbs-sports-network/ | https://www.cbssports.com/watch/cbs-sports-network | 200 | redirects to the watch page — better than stored |
| `dazn` | https://www.dazn.com/ | https://www.dazn.com/en-US/welcome | 200 | locale landing |
| `disney-plus` | https://www.disneyplus.com/ | — | 200 | storefront |
| `espn` | https://www.espn.com/watch/ | — | 200 | live area |
| `espn-plus` | https://plus.espn.com/ | — | 200 | storefront/marketing |
| `espn-unlimited` | https://plus.espn.com/ | — | 200 | same URL as `espn-plus` — deliberate? |
| `espn2` | https://www.espn.com/watch/ | — | 200 | live area |
| `espnu` | https://www.espn.com/watch/ | — | 200 | live area |
| `fox` | https://www.fox.com/live/ | https://www.fox.com/ | 200 | homepage |
| `fs1` | https://www.fox.com/live/ | https://www.fox.com/ | 200 | **homepage, and identical to `fox`** |
| `guardians-tv` | https://www.mlb.com/guardians/schedule/watch | — | 200 | **fixed this run.** Official "Where to Watch"; names DIRECTV 662 itself |
| `hbo-max` | https://www.hbomax.com/ | — | 403 | could not check |
| `hulu` | https://www.hulu.com/live-tv | — | 200 | live area |
| `mlb-network` | https://www.mlb.com/network | — | 200 | network page |
| `nbc` | https://www.nbc.com/live | — | 200 | live area |
| `netflix` | https://www.netflix.com/ | — | 200 | storefront |
| `nfl-network` | https://www.nfl.com/network/ | https://www.nfl.com/network | 200 | trailing-slash normalisation only |
| `paramount-plus` | https://www.paramountplus.com/ | — | 200 | storefront |
| `peacock` | https://www.peacocktv.com/ | — | 200 | storefront |
| `prime-video` | https://www.amazon.com/gp/video/storefront | — | 200 | storefront |
| `sec-network` | https://www.espn.com/watch/ | — | 200 | live area |
| `sec-network-plus` | https://www.espn.com/watch/ | — | 200 | live area |
| `tbs` | https://www.tbs.com/watchtbs | — | 200 / 403 | inconsistent between runs |
| `the-cw` | https://www.cwtv.com/ | — | 200 | **fixed in prompt 79** — was `/shows/cw-live/`, a 404 served as 200 |
| `tnt` | https://www.tntdrama.com/watchtnt | — | 403 | could not check |
| `trutv` | https://www.trutv.com/watchtrutv | — | 403 | could not check |
| `usa-network` | https://www.usanetwork.com/live | — | 200 | live area |
| `wuab-43` | https://www.fox8.com/ | — | 403 | **wrong property** |
| `youtube` | https://tv.youtube.com/ | https://tv.youtube.com/welcome/?utm_servlet=prod&rd_rsn=lo&zipcode=44149 | 200 | marketing landing, geolocated |

## What was rejected for `guardians-tv`, so it is not re-proposed

* **`live-stream-games/subscribe/cleguardians`** — live, but a **sales page**. Joe already
  subscribes, and a checkout is a worse failure than a 404 because it looks deliberate.
* **`cleguardians.tv`** — **certificate hostname mismatch**; cannot be linked at all.
* **Deleting the entry** — `watchUrl()` is `WATCH[id] || DIRECTV_STREAM`, so removal falls through to
  DIRECTV. Wrong now that the MLB page is known useful: that page names channel 662 itself, so
  keeping the entry gives Joe both routes.

---

# C4 — can an MLB link be game-specific? REPORT ONLY, nothing changed

Its premise depended on block B1, which established that `games.id` for MLB is `mlb-<gamePk>`
(`adapters/mlb.py:350`), so **the gamePk is recoverable from the id by taking the part after the
hyphen** — which is exactly what `pipeline/load.py:75` already does.

## 1. The URL shape — it works

`https://www.mlb.com/gameday/824791` returns **200** and redirects to a canonical slug:

```
https://www.mlb.com/gameday/guardians-vs-orioles/2026/09/09/824791
```

So the bare-gamePk form is a permanent link MLB itself resolves; the slug is not something we need to
construct. `/gameday/<pk>/final/box` also 200s. **This is the same URL `_BOXSCORE['mlb']` already
builds**, so nothing new is needed to link a specific MLB game in a browser.

## 2. The apple-app-site-association — and this is the answer

Prompt 59 recorded *"MLB: paywall pages only"* and a re-fetch returned binary Cowork could not parse.
**Both are now resolved.** The file is served at `https://www.mlb.com/.well-known/apple-app-site-association`
with `content-type: application/octet-stream` — which is why a parser expecting JSON gave up — but the
2,708 bytes are valid JSON. Claimed paths for the main app (`826DJ6Z2F6.com.mlb.AtBatUniversal`):

```
/magiclink            /sponsorship/t-mobile-tuesdays-mlbtv
/tv/g*                /live-stream-games/promotions/svod
/dailywalkoff         /live-stream-games/promotions/paywall
/news/*               /<club>/news/*   (one per club)
```

**`/gameday/*` IS NOT CLAIMED.** So a link to `mlb.com/gameday/<pk>` opens **a browser, never the MLB
app on that game**. Prompt 59's summary was right in substance and is now specific: the claims are
paywall, promo, news and `/tv/g*`.

**Therefore the "MLB app opens on the game" tier does not exist**, and a fallback chain built on it
would degrade silently — which is the thing block C is about. **The ceiling is the MLB game page in a
browser, the same ceiling ESPN has.** Say that plainly rather than dressing a landing page as a deep
link.

`/tv/g*` is the one unexamined claim and may be an MLB.TV game-watch path. It is **not** followed up
here: it is a paywalled product surface, and confirming what it addresses needs a device with the app
installed, which no amount of fetching from a runner can substitute for.

## 3. One rule for every MLB game, or only the local club?

**One rule, every game.** The `/gameday/<gamePk>` form is club-agnostic — the redirect builds the slug
from whichever two clubs are playing. The per-club entries in the AASA are `/<club>/news/*` only, so
nothing about the deep-link position differs for Cleveland. The only Cleveland-specific asset is the
`guardians-tv` watch page fixed above.

---

# STAGE 3 REOPENED — MLB's `/tv/g*` claim, tested (prompt 79)

Block C4 concluded the game-specific tier does not exist because `/gameday/*` is not claimed. **That
conclusion was too strong**, and the reopening was right.

## What is settled

* **`/gameday/*` is NOT claimed.** Unchanged and confirmed.
* **`/tv/g*` IS claimed** by `826DJ6Z2F6.com.mlb.AtBatUniversal`.
* `https://www.mlb.com/tv/g<gamePk>` returns **200**, and the gamePk is recoverable from `games.id`
  (block B established both sides genuinely build `mlb-<gamePk>`).

## What a fetch CANNOT settle, and this is the finding

`/tv/` is a **client-rendered SPA that returns 200 for any path underneath it**. Measured against a
real gamePk and a deliberately bogus one:

| URL | status | bytes |
|---|---|---|
| `/tv/g824791` (real game) | 200 | 1,178,001 |
| `/tv/g999999999` (bogus) | 200 | 1,178,004 |

**Three bytes apart, and both mention both clubs** — that text is the site-wide nav and scoreboard
shell, not the game. `/tv/g824791/vee`, a nonsense suffix, also returns 200. So a server-side fetch
cannot distinguish a valid game route from an invalid one, and **a 200 here is not evidence of
anything.**

## Therefore

**The ceiling is not established, and the earlier "it does not exist" should not be restated.** What
is true:

1. the path IS claimed, so on a device with the MLB app installed, tapping it opens the app;
2. whether it opens **on that game** can only be answered by tapping it on Joe's phone.

`/tv/` is MLB.TV, the paywalled product Joe already subscribes to — which is consistent with the
"more features" feed he asked to keep. **That makes this worth one tap to settle**, and nothing more
until it is settled. No link was changed in this stage.
