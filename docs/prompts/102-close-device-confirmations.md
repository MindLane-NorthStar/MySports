# Prompt 102 — close the two device confirmations, and pay the rule-30 comment debt

Two blocks, no code, no count should move. Block A closes two open items that Joe's phone settled on
2026-09-16. Block B pays a correction `docs/handoff-status.md` records as owed under rule 30.

Read `docs/handoff-status.md` first as always. The gate floors are there and nowhere else.

---

## BLOCK A — the two open items are closed

### What Joe confirmed, and how — read this carefully before writing anything

On **2026-09-16**, after prompt 101 deployed, Joe tested on his iPhone and reported: *"It works —
we're good."* He was testing two specific things, given to him as numbered steps: whether the navbar
appears on the FIRST scroll-down after switching to WEEK, and whether the top of MYSPORTS TV is still
washed out after tapping the navbar to restore the banner. Both passed.

**The evidence is of two different kinds and the record must not blur them.**

*Measured, by Cowork, at pixel scale:*

Two screenshots from one iPhone, one install, one minute (8:13), taken after a delete-and-reinstall
of the PWA, so both ran prompt 99 rev B. Both 723 × 1568.

- Fresh open: the status band is a flat `#282828`, uniform across all 723 columns, no gradient, and
  the wordmark renders at full brightness.
- Tap-restored, BEFORE prompt 101: the band is `#020202` with a downward fade dying out at y≈152 of
  1568 — about 90 CSS px from the top of the screen. The wordmark's gold glyph rows span y=111–149
  and measure **0.484** of fresh-open brightness at the top of the capitals, recovering through
  0.560, 0.585, 0.634, 0.680, 0.721, 0.768, 0.816, 0.863 to **0.894** at the baseline, and parity
  below y≈155. Below 90 CSS px the two shots are identical, delta 0.0 on every sampled row.

An earlier, unmatched pair measured 92 CSS px and 0.50 → 0.88 over the same span. Two independent
sets agree.

*Reported, by Joe, by eye:* that after prompt 101 both behaviors are correct on the device. **There is
no post-fix pixel measurement.** Say so in the record. Do not write "measured" where the evidence is
a person looking at a phone.

### What to change

**`docs/handoff-status.md`** — the two items currently beginning:

- `**OPEN — THE STATUS BAR IS `black` NOW, AND ONLY JOE'S PHONE CAN SAY WHETHER THAT FIXED THE WASH
  (prompt 99, register §48).**`
- `**OPEN — BLOCK B IS PROVISIONAL UNTIL JOE'S PHONE AGREES (prompt 101, register §50).**`

Both become CLOSED, dated 2026-09-16, naming what was confirmed and by which kind of evidence. Keep
the withdrawal of §48's pre-measured pull-up exactly as it stands — that is a live instruction and
closing the item must not bury it.

One caveat to carry into the prompt-99 closeout rather than paper over: that item's criteria were *"a
dark opaque bar owned by iOS, the banner starting just below it, and no wash over the wordmark **or
the collapsed header**."* The banner half is measured. The collapsed header was never measured for
wash — Joe has reported the navbar rendering correctly across several screenshots, and that is the
basis. Record it at that strength.

**`docs/enhancement-register.md` §48 and §50** — remove the provisional language and record the
confirmation. The lines that need to change include §50's `4036-4037` (*"ships PROVISIONAL — its
wiring is proven, its premise is not, and only Joe's phone can settle it (rule 25)"*) and its Block B
heading at `4080` (`(PROVISIONAL)`).

### THE ONE THING MOST LIKELY TO BE GOT WRONG HERE

**§50's hypothesis stays a hypothesis.** Joe's phone confirmed the OUTCOME — the wordmark is no
longer washed. It did not confirm the MECHANISM. The claim at §50 `4101` — that an element holding
the top edge suppresses iOS 27's scroll-edge scrim — rests on three consistent observed states and
still is not proof. A working fix is evidence for the hypothesis, not a demotion of it to fact.

So: the SHIP is no longer provisional; the EXPLANATION is still a hypothesis. Write both sentences.
If a future change to the pin makes the scrim come back, the next session needs to know the mechanism
was never nailed down, and a closeout that quietly upgraded it would hide exactly that.

### Where the record goes

**Amend §48 and §50 rather than opening a §51.** The register holds decisions and their reasoning;
these are the same two decisions reaching their conclusion, and splitting one decision across two
sections is the copy problem this project has paid for repeatedly. If you judge otherwise, say why in
your report before doing it — do not do both.

---

## BLOCK B — the stale `globals.css` comments, owed under rule 30

`docs/handoff-status.md` records this as owed, in an item headed **"STALE COMMENTS PROMPT 99 COULD
NOT CORRECT — `globals.css` was read-only for it (rule 30, owed)."** It names them:

- `web/app/globals.css:1960-1962` says the banner bleeds *"under the translucent status bar, which is
  the entire point of black-translucent."* Untrue since prompt 99 — the style is `black`.
- `:1966-1967` and `:2003-2004` say the artwork carries *"11 stage px"* of headroom.
- `:1993-2008`'s table says the ink lands *"EXACTLY at the band's lower edge."*

The last three have been untrue since `d24e8e0` (2026-09-07) moved the artwork up 7 stage px. The real
headroom is **4.392 stage px**, and the wordmark's first ink sits **4.41 CSS px below the bar at 430**
(4.00 at 390). The handoff item states M22 already carries the correction as Addendum v2.3.
**M22 lives in `docs/rendering-contract-mobile.md`** — register `3963` records it as amended under
rule 30 in the prompt-99 commit, and `3956` pairs it explicitly with `globals.css:1993-2008`. **Read
M22 and take the numbers from it rather than from this brief**, and if M22 and these figures disagree,
stop and report the disagreement instead of picking one.

Comments only. No selector, property, value or rule may change. `globals.css` is not read-only for
this prompt.

**Prove it is comments-only**: report `git diff --stat` for the file and confirm by inspection of the
diff that every changed line is inside a comment. A CSS comment edit that accidentally closes or
opens a block is silent and the gates would not necessarily catch it — `npm run geometry` and
`node scripts/qa-shots.mjs` are the two that would, so read their counts with that in mind.

---

## WHAT IS NOT IN SCOPE

- **Register §48's pull-up stays withdrawn.** `margin-top: calc(-100% * 4.392 / 428)` must not be
  applied, re-derived or re-proposed. Closing the open item does not revive it.
- **No headroom above the wordmark.** It was the fallback if prompt 101 Block B failed. It did not
  fail. The space stays where prompts 46, 50 and 51 left it.
- **`web/components/Banner.js:21` and the banner JSON's `stage.units` note**, which still say the
  phone banner is `width x 155/428` when the viewBox has been 428 × 135 since `d24e8e0`. Register §48
  records it as noticed-and-not-changed. It is a real debt and it is NOT this prompt — it touches a
  component and a data file, and this prompt touches neither.

## COMMITTING

Self-commit and push per rule 7, with the `## Committing` stop list in `CLAUDE.md` unwaived. This is
documents and CSS comments; the deploy is a no-op rebuild.

## THE RECORD

- Amend `docs/enhancement-register.md` §48 and §50 as above. State the section count you found and
  confirm each of §1–§50 appears exactly once.
- `docs/handoff-status.md`: the Repo state line for this prompt, both items moved to closed, and the
  rule-30 comment item closed by Block B.
- File this brief byte-identical to `docs/prompts/102-close-device-confirmations.md` and update the
  prompts README.

## GATES

All five, each reported as its own command with its own count. **No count may move** — this prompt
adds no tests and changes no behavior. A moved count is a finding, not a pass; stop and report it.

```
pytest
npm run test:unit
npm run smoke
node scripts/qa-shots.mjs
npm run geometry -- http://localhost:3000
```

`npm run geometry` defaults to port 3001 and must be pointed at the dev server explicitly.

End the report with the five counts, the `git diff --stat` for `globals.css`, whether M22 agreed with
the figures above, and what is left in the tree.
