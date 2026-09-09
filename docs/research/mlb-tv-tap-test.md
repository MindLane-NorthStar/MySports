# The MLB `/tv/g*` tap test — RUN, and the result

> **RESULT, 2026-09-09 — Joe's iPhone, both links tapped from Messages.**
>
> | link | outcome |
> |---|---|
> | `https://www.mlb.com/tv/g824791` — a real gamePk | **the MLB app opened, on the Guardians page** |
> | `https://www.mlb.com/tv/g999999999` — the control, a gamePk that does not exist | **the MLB app opened, on the Guardians page** |
>
> **SETTLED: iOS hands `mlb.com/tv/g*` to the MLB app.** The path is claimed in MLB's
> apple-app-site-association and the hand-off happens on Joe's device. That is the whole basis for
> prompt 81 block F, which points the `guardians-tv` watch link at `mlb.com/tv/g<gamePk>` instead of
> the club's web schedule page.
>
> **NOT SETTLED, and deliberately not claimed anywhere: whether the app READS the game number.** The
> control cannot resolve to a game and landed on the same screen, so the real link's landing is
> indistinguishable from a fallback to Joe's favourite club. **The URL shipped is the same under
> either reading**, so nothing depends on which is true — but no document should assert one.
>
> **THE CONTROL IS WHY THIS IS KNOWN.** Without a link that cannot possibly work, "the real one
> opened on the Guardians" would have read as success. It is the same reason the live-poll probe
> asserts that its patch LANDED before it asserts that nothing moved.

## The open follow-up — the in-app tap

Joe reported that DIRECTV links tapped **from inside MySports TV** opened Safari, while these MLB
links tapped from Messages opened the MLB app. There is a plausible explanation — a `target="_blank"`
tap from a standalone home-screen web app landing in an in-app browser view that does not perform the
hand-off — and it is exactly the shape rule 34 says to distrust: "X prevents Y" about a platform,
recalled rather than checked. **So `target` was not changed.**

**The next instrument is Joe tapping the new MLB.TV link from inside the app**, once block F is
deployed:

* **it opens the MLB app** → the question is closed, and `target="_blank"` is not implicated;
* **it opens Safari** → dropping `target="_blank"` for deep links is the next thing to test. One
  line, one commit, measured — not assumed.

---

**The instrument that produced the result above is kept below, unchanged.**

## Why a tap is the only thing that can answer it

MLB's `apple-app-site-association` claims **`/tv/g*`**. It does **not** claim `/gameday/*`. So a link
to `mlb.com/gameday/<id>` opens a browser, and a link to `mlb.com/tv/g<id>` should hand off to the
MLB app — *if* that path really addresses one game.

**A fetch cannot tell.** `/tv/` is a client-rendered single-page app that answers 200 to any path
underneath it. Measured 2026-09-09:

| URL | status | bytes |
|---|---|---|
| `/tv/g824791` — a real game | 200 | 1,178,001 |
| `/tv/g999999999` — a made-up number | 200 | 1,178,004 |

**Three bytes apart**, and both mention Guardians and Orioles — that text is the site-wide navigation
and scoreboard, not the game. `/tv/g824791/vee`, a nonsense suffix, also returns 200. Every server
observation available says the same thing about a valid and an invalid game, so the question can only
be settled by the device the link is meant for. This is the same shape as the DIRECTV question, which
a thumb settled and no amount of fetching could.

---

## The two links

**A — a real game.** Guardians @ Orioles, Tuesday 9 September, 6:35 PM ET (`games.id`
`mlb-824791`, so gamePk `824791`):

```
https://www.mlb.com/tv/g824791
```

**B — a control, with a gamePk that does not exist.** This is the half that makes the test mean
something: if A and B behave identically, A is not addressing the game.

```
https://www.mlb.com/tv/g999999999
```

---

## The steps

1. **Text both links to yourself** in one message — Messages, to your own number. Do not paste them
   into Safari's address bar: typing a URL into Safari **bypasses the app hand-off entirely** and
   always stays in the browser, so it would tell you nothing. A link tapped from another app is what
   triggers a universal link.
2. **Tap A.** Note whether the MLB app opens, or Safari does.
3. If the MLB app opened, note **where it landed** — the Guardians game, some other game, the MLB.TV
   home screen, or a sign-in wall.
4. **Go back to Messages and tap B** (the made-up number).
5. Note the same two things for B.

If a link opens in Safari when you expected the app, press and hold it instead and look for **"Open
in MLB"** in the menu — its presence tells us the claim is registered even if iOS chose the browser
that time.

---

## What each outcome means

| A (real game) | B (bogus) | What it means |
|---|---|---|
| MLB app, **on that game** | app opens elsewhere, or errors | **The tier exists.** `mlb.com/tv/g<gamePk>` is a real deep link and the Guardians link can become game-specific. This is the outcome worth having. |
| MLB app, **on that game** | app, **also on a game** | Suspicious — check B landed somewhere sensible. If B shows a real game, the path is not keyed on the number and A was a coincidence. |
| MLB app, but **MLB.TV home** or a sign-in wall | same | The claim is registered but the path does not address a game. **Ceiling is the game page in a browser** — the same ceiling ESPN has — and the earlier conclusion stands, now tested rather than inferred. |
| **Safari** both times | Safari | The claim is not being honoured on your device — possibly because the MLB app is not installed, or iOS has not fetched the association. Worth confirming the app is installed before reading anything into it. |

**WHAT ACTUALLY HAPPENED IS ROW 2**: the app opened on the Guardians page for both. Read against the
table that is "suspicious — the path is not keyed on the number" — but B landed on a CLUB page rather
than on a game, which is not quite what row 2 anticipated either. The honest reading is the one at
the top of this file: the hand-off is proven, the number's effect is not, and the link is worth
shipping either way.

---

## Two things worth knowing before you tap

* **`/tv/` is MLB.TV**, the paywalled product. You already subscribe to the Guardians package, so a
  sign-in wall would be unexpected — but landing on the MLB.TV *home* rather than the game is the
  outcome I would bet on, and it is still a useful answer.
* **Blackout still applies.** A Guardians game in the Cleveland market may be blacked out on MLB.TV
  even with a subscription. That would not change what this test measures — the question is where the
  link *lands*, not whether it plays.

Report back with the four observations (A opened what / landed where, B opened what / landed where)
and the next step follows from the table.
