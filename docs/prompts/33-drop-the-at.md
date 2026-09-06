# Claude Code — Prompt 33: drop the `@`, and four items prompt 31 opened

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Preconditions, hard stop if any fail:**

- `git rev-parse HEAD` == `45c339e`, and `HEAD == origin/main`.
- Python **200 OK (skipped=1)**, JS **169/169**, smoke **30/30**, qa-shots **14/14**.
- Tree clean apart from untracked `assets/`.

**Nothing here touches the phone grid**, so it is independent of prompt 32 and can run before or after it — but not concurrently, since both touch `globals.css`.

**Working rule 22** — locate by content, report any citation that does not match. **Rule 23** — `docs/design/mobile_demo.html` changes in the same commit as anything it specifies. Also rules 3, 4, 13, 16, 20.

**No database, no pipeline, no adapters, no migration.**

---

## Stage 1 — the `@` comes off ordinary games; `vs` stays for neutral sites

### The ruling

Joe: *"We know all matchups are away @ home. Under the circumstance, can we just eliminate the @ altogether?"*

**Almost.** Measured against the loaded season, the marker is not purely decorative: `MatchupCard.js` renders `vs` instead of `@` when `game.neutral_site` is true, and the season holds **20 neutral-site games — 9 NFL and 11 CFB** out of 1,379. Those are the international games and the Week 1 neutrals. Dropping the marker outright would render an NFL game in London as a home game.

**So: the marker renders only when it carries information.**

- `neutral_site = false` → **nothing between the two team stacks.** The away-then-home order carries it, as Joe says.
- `neutral_site = true` → **`vs`**, exactly as today.

### Why this also settles the wrap prompt 31 declined to fix

Prompt 31 measured `.mbody` at 152 px at 390 px and found that forcing one line truncated **122 of 124 names**, so it kept `flex-wrap: wrap` deliberately. Removing the `@` from 98.5% of cards frees roughly 28 px — the glyph plus its two gaps — taking each name's budget from about 31 px to about 41 px. **That is not enough to hold one line on the longest names, and it does not need to be.**

What made the wrap look broken was a lone symbol stranded on its own row between the away team's sub-info and the home team. With no symbol, a wrap simply moves the home team's stack below the away team's — a clean two-row matchup, which is the shape the outside audit's §10 proposed and which reads as intentional rather than as a fault.

**So `flex-wrap: wrap` stays.** Do not remove it. Prompt 31's other three fixes — `flex: 0 1 auto`, `min-width: 0`, and the reference's ellipsis — stay exactly as shipped; they are what stops names overflowing when the row is tight.

**Neutral-site games keep the `vs` inline**, so on those 20 cards the marker can still wrap to its own row. At 1.5% of the season that is acceptable and it is the honest trade — the alternative is hiding a fact about where the game is played.

### Acceptance

- Screenshots at **360, 390 and 430 px** of: a short matchup that fits one line, a long matchup that wraps, and one of the 20 neutral-site games showing `vs`. **Query the database for a real neutral-site game rather than constructing one.**
- Confirm the wrapped state reads as a two-row matchup with nothing orphaned — this is the whole justification, so **look at it and say whether it holds**, do not just assert it.
- Report the per-name width budget before and after, against prompt 31's 152 px measurement.
- Confirm zero overflow and zero silent truncation at all three widths.
- No card-height regression beyond what wrapping already caused; report the heights against prompt 29's 68.3 / 91.3 / 186.3 px.

---

## Stage 2 — the duplicate timezone line

Prompt 31 flagged it: `web/components/NavBanner.js:33` renders `<span className="muted">all times ET · Cleveland</span>`. Prompt 31's audit correctly left it alone because it is a timezone *statement*, not a clock suffix, and was outside that brief's enumeration.

It now duplicates the footnote. On desktop `/weeks` and `/history` the page says the times are Eastern twice; on mobile that span is `display: none`, so Today never had one, which is the gap the footnote was added to fill.

**Cowork's call: delete the span.** The footnote covers the whole app in one place, which is the point of having it, and one statement is better than two. **Keep the `· Cleveland` fact** — that is market information the footnote does not carry — by folding it into the footnote: *All times are Eastern · Cleveland market.* If that reads badly at 390 px, report it and leave the footnote as it was; do not invent a third location.

---

## Stage 3 — the count line wraps at 360 px

Prompt 31: *"68 College Football broadcasts wraps to two lines at 360 px. No overflow."*

Not a defect, but worth one measurement before it is accepted. The date picker and the count share a row; at 360 px the longest sport label plus a two-digit count exceeds it.

**Report the measured widths first.** Then, if the fix is genuinely one property — letting the count sit on its own line under the date rather than beside it at ≤ 380 px, say — apply it. **If it is more than that, report and change nothing.** Joe's phone is 390 px or wider, where it does not wrap, so this is tidiness, not a problem.

---

## Stage 4 — the time column's unspent width

Prompt 31 measured, and deliberately did not spend: the widest time text went from `6:00 PM ET` at 77.3 px to `6:00 PM` at 55.9 px, so **22 px could come off the 78 px desktop column**, and on mobile the 54 px track still wraps by **1.9 px** where 56 px would unwrap it.

**Joe's decision, and it is small:**

- **Mobile: take the 2 px.** 54 → 56 px unwraps the time, and it costs the matchup 2 px of the 152 px it has — under 1.5%, well inside the noise, and it removes a wrap that serves no purpose.
- **Desktop: leave the 78 px column alone.** Desktop has width to spare, the column is not crowding anything, and narrowing it would be change for its own sake.

Report the rendered time at both widths after, and confirm the mobile time no longer wraps.

---

## Stage 5 — the reference and the report

**Rule 23.** `docs/design/mobile_demo.html` renders `<span class="atbig">@</span>` unconditionally inside `.duel.hug`. Stage 1 changes that behaviour. **Update the reference in the same commit** so it renders the marker only for neutral sites, and record the divergence note prompt 31 already put there about `.duel.hug` — check whether that note is now stale and correct it if so.

`docs/rendering-contract.md` describes the card's matchup. **Read the relevant section and report whether stage 1 contradicts it.** If it does, this needs a version bump and the text updated in the same commit; if the contract is silent on the marker, say so and add one line recording the rule. Do not bump silently either way.

**Report** per stage: what changed, the sha, the evidence, every judgment call. Gates before and after. Call out specifically:

- The three screenshots from stage 1, including a real neutral-site game.
- **Your own read on whether the wrapped two-row state looks intentional.** That judgment is the reason this design was chosen; if it looks wrong, Joe needs to hear that from you rather than discover it.
- Whether the contract needed a bump.
- **Anything in this brief that turned out wrong.** Eight reports running have found bad citations in their own briefs; that has been the most useful part of each.

---

## Explicitly out of scope

- **The phone grid** — prompt 32 carries the team-colour bands, and prompt 30's zoom rewrite is still awaiting Joe's phone.
- **Removing `flex-wrap: wrap`** — prompt 31 measured that it truncates 122 of 124 names. It stays.
- **An abbreviation tier on team names** — considered and not needed once the marker comes off.
- **Restacking the card into two fixed rows** — the wrap already degrades to that shape when it needs to, without reopening the card contract.
- **The desktop time column** — measured, deliberately unspent.
- Anything in `pipeline/`, `adapters/`, or the database.
