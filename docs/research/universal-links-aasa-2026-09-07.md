# Universal Link claims — the AASA harvest, 2026-09-07

**Prompt 59 stage 5. EVIDENCE, NOT A RECOMMENDATION.** Nothing here is evaluated, ranked or
proposed. Cowork cross-references these against the event ids MySports actually holds; Joe
tap-tests whatever survives that on his phone.

## What this is

Joe wants the Watch links to open a live broadcast in the streaming app rather than a landing page.
On iOS that is a **Universal Link**: an `https://` URL the OS routes into an installed app because
the publisher hosts an `apple-app-site-association` file declaring which paths it claims. **The
publisher decides and the file is public**, so reading it is how we learn what is possible without
guessing.

Cowork could not do this — both its shells sit behind egress allowlists that block these domains.

## How the domain list was built

From the repo, not from a typed list. `WATCH` in `web/lib/config.js` (34 entries, slug-keyed) joined
to `data/access_profile.json`'s `available` array (33 entries, **label**-keyed).

**RULE 31 IS EXACTLY THIS HAZARD**, so the searches are named rather than assumed:

1. `slugify(label)` against `WATCH`'s keys, where slugify lowercases, maps `+` to `-plus` (prompt 55
   learned that one: a slugify mapping non-alphanumerics to `-` turns `Paramount+` into `paramount`)
   and collapses the rest to `-`.
2. a punctuation-insensitive retry for anything still unmatched.

**31 of 33 joined. Nothing was silently dropped:**

| | |
|---|---|
| in `access_profile` but **not** in `WATCH` | **ACCNX**, **ESPN3** — both ESPN-family, both fall through to the DirecTV Stream default |
| in `WATCH` but not available to Joe | `cbs-sports-network`, `hulu`, `youtube` |

That collapsed to **23 distinct hosts**.

## The harvest

Both locations per host — `/.well-known/apple-app-site-association` and
`/apple-app-site-association` — following redirects, two attempts each, then move on. **A 404 is a
finding, not a failure.**

Bodies were written verbatim to `artifacts/aasa/<host>.json`. **`artifacts/` is gitignored**, so
those files are local evidence and are not in the repo; this document is the committed record.

| host | services | loc 1 | loc 2 | file | apps | patterns |
|---|---|---|---|---|---|---|
| `www.espn.com` | ACC Network, ESPN, ESPN2, ESPNU, SEC Network, SEC Network+ | 200 | — | **yes** | 7 | 250 |
| `www.amazon.com` | Prime Video | 200 | — | yes | 36 | 2946 |
| `www.nbc.com` | NBC | 200 | — | yes | 2 | 2132 |
| `www.paramountplus.com` | Paramount+ | 200 | — | yes | 3 | 61 |
| `www.disneyplus.com` | Disney+ | 200 | — | yes | 1 | 50 |
| `www.mlb.com` | Guardians TV, MLB Network | 200 | — | yes | 3 | 70 |
| `www.dazn.com` | DAZN | 200 | — | yes | 1 | 28 |
| `www.usanetwork.com` | USA Network | 200 | — | yes | 1 | 23 |
| `www.nfl.com` | NFL Network | 200 | — | yes | 4 | 16 |
| `www.cwtv.com` | The CW | URLError | 200 | yes | 2 | 13 |
| `www.peacocktv.com` | Peacock | 200 | — | yes | 4 | 8 |
| `abc.com` | ABC | 404 | 404 | no | — | — |
| `plus.espn.com` | ESPN Unlimited, ESPN+ | 404 | 404 | no | — | — |
| `www.cbs.com` | CBS | 404 | 403 | no | — | — |
| `www.hbomax.com` | HBO Max | 404 | 404 | no | — | — |
| `www.tbs.com` | TBS | 403 | 404 | no | — | — |
| `www.tntdrama.com` | TNT | 403 | 404 | no | — | — |
| `www.trutv.com` | truTV | 403 | 404 | no | — | — |
| `tv.apple.com` | Apple TV | 200 | 200 | no | — | — |
| `www.btn.com` | Big Ten Network | 200 | 200 | no | — | — |
| `www.fox8.com` | WUAB 43 | 404 | 200 | no | — | — |
| `www.fox.com` | FOX, FS1 | URLError | URLError | no | — | — |
| `www.netflix.com` | Netflix | URLError | URLError | no | — | — |

**11 of 23 returned a parsable AASA.** Three kinds of miss, and they are not the same kind:

- **404 / 403** — a real answer. The publisher hosts no AASA at that host, or refuses the request.
- **200 with no file** — `tv.apple.com`, `www.btn.com`, `www.fox8.com`. The location answered but the
  body was not JSON, so it was almost certainly an HTML page or an SPA shell rather than an AASA.
- **URLError** — `www.fox.com`, `www.netflix.com`, and `www.cwtv.com` on its first location. A
  transport failure from this machine, twice each. **These are the only three worth retrying** from
  a different network before concluding anything; the rest answered.

## THE ESPN ANSWER, called out because it is the one that matters

Ten of Joe's available services are ESPN-operated, and it is the one family whose event ids the
database already carries.

**`www.espn.com` claims game paths for the ESPN app** (`WZ62FEL3UG.com.espn.ScoreCenter`, plus two
QA/dogfood bundles):

```
/*/game/_/gameId/*
/*/recap/_/gameId/*
/*/boxscore/_/gameId/*
/*/playbyplay/_/gameId/*
/*/matchup/_/gameId/*
/*/video/_/gameId/*
/soccer/*/gameId/*
/video/clip/_/*
/video/clip
/watch/player/*sportscenter-for-you
```

**What that means, stated carefully.** `gameId` is the identifier this database already holds —
`games.id` is `nfl-401872658` and cfb keeps ESPN's bare integer id, and prompt 57 confirmed CFBD ids
are ESPN ids. So `https://www.espn.com/college-football/game/_/gameId/401856782` is a link the ESPN
app is declared to take.

**What it does NOT mean.** There is **no general `/watch/*` claim** — the only `/watch` pattern is
`/watch/player/*sportscenter-for-you`, one specific product. So the declared route opens the app **on
the game**, not on a live stream. Whether that page then offers the broadcast is app behaviour the
AASA does not promise, and is exactly what a tap test would settle.

`plus.espn.com`, which is where `WATCH` sends ESPN+ and ESPN Unlimited, hosts **no AASA at all** —
404 at both locations.

## Every other hot pattern, verbatim

Patterns touching `/watch`, `/live`, `/video`, `/event` or `/game`, exclusions omitted.

| service | claimed |
|---|---|
| **Paramount+** | `/live-tv`, `/live-tv/*/`, `/live-tv/stream/`, `/live-tv/stream/*/`, `/live-tv/stream/cbsn/`, `/live-tv/stream/sports/`, `/news/video/`, `/shows/*/video/`, `/shows/*/video/*/*/` |
| **USA Network** | `/watch`, `/event`, `/event/*`, `/game`, `/game/*`, `/video/*`, `/videos/*` |
| **Peacock** | `/watch/*` |
| **NBC** | `/live`, `/*/video/*`, plus two named-title paths |
| **The CW** | `/live/*`, `/events/*` |
| **DAZN** | `*/games/web/*` |
| **Disney+** | `/video/*` |
| **NFL Network** | `/videos/*` |
| **MLB** | `/live-stream-games/promotions/paywall`, `/live-stream-games/promotions/svod` — **paywall and SVOD promo pages only**, no game path |
| **Prime Video** | 201 hot patterns, but they are Amazon retail `/events/*` sale pages, not video |

## What is not here

No evaluation, no ranking, no recommendation, and no code changed. The next question — which of
these patterns MySports can actually populate from ids it holds — is Cowork's, and the one after
that is a tap test on Joe's phone.
