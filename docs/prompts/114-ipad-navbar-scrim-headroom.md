# Prompt 114: The iPad's top edge gets headroom below the scrim, and rev B gets its real bytes

This builds on `ec99819` (prompt 113 rev C, pushed 2026-09-22). Before starting, check that `git rev-parse --short HEAD` returns `ec99819`, that `git rev-parse --short origin/main` also returns `ec99819`, and that `git status --porcelain` shows only untracked `assets/` entries. If any check fails, stop and report.

*(Numbering: 114 as prompt 113 reserved it. Preemption stays 115.)*

Written by Cowork on 2026-09-23 from a read of the tree at `ec99819` through the device bridge and a pixel measurement of Joe's three iPad screenshots of 2026-09-22 (Project: `ipad-2026-09-22-shot1-fresh-open.png`, `-shot2-scrolled-navbar.png`, `-shot3-tap-restored.png`; 2732 × 2048, DPR 2, 1366 × 1024 CSS, landscape, standalone PWA, installed that day, iPadOS 27, 2021 iPad Pro 12.9"). **Every file:line below was read from the tree. Verify each one before acting on it.**

---

## What is wrong, in one paragraph

On the iPad, the collapsed navbar (`.chdr`) and the tap-restored banner sit under iOS 27's scroll-edge scrim. The navbar wordmark reads at 0.29–0.57 of banner gold, top to bottom. The restored banner wordmark follows 0.55 → 1.00 against the fresh-open shot. The date picker row below the navbar is untouched. The phone is clean on the same build (Joe, 2026-09-22). Register §50's Block B hypothesis says "an element holding the top edge suppresses the scrim." That hypothesis is **false on the iPad**: `.chdr` holds the top edge with an opaque ground, and it is scrimmed.

## What Cowork measured, and where earlier documents were wrong

**1. `.chdr` is sticky, and it is at `globals.css:3232-3239`**, not `:3173-3180` as the 2026-09-15 evidence file quoted: `position: sticky; top: 0; z-index: 40; background: var(--spot-2); padding-top: env(safe-area-inset-top, 0px); display: none;`. It is shown by `html[data-hdr='collapsed'] .chdr` (`:3253-3255`). The banner pin is `html[data-pin='banner'] .banner { position: sticky; top: 0; z-index: 40 }` (`:3373-3377`). The banner hides on collapse at `:3392-3394`. The banner's top padding is `:2054` (base) and `:2077-2084` (`display-mode: standalone`, `+ 4px - 14px`). **Two comments near the block are stale:** `:3196` says "FIXED, NOT STICKY" (prompt 58's text; prompt 62's note at `:3210` supersedes it), and `:3396` says "`.chdr` stays FIXED." `:3671` cites `:3057`, `:1859` and `:1882`, which no longer point at those rules.

**2. On the iPad the web view starts 32 CSS px below the screen top, and `env(safe-area-inset-top)` is 0, the same as on the phone.** The evidence file assumed a 24 px status bar. This figure is **inferred** from two independent fits, not read from the device:

- In shot 2, the navbar's hairline (`.chdr-inner`'s bottom border) is the 1 CSS px row at y = 75.0. `.chdr-inner` is 44 px, border-box (`:3407-3416`), so the row spans 32.0–76.0.
- In shot 1, the desktop banner's wordmark ink spans y = 45.0–83.0. `.bn-pc` shows at 1366 wide (`:2096`). The SVG is `viewBox 0 0 1400 200` (`components/BannerDesktopV2.jsx:19`), which is 0.9757 scale at 1366. The title baseline is 51.76 at 55 px (`web/lib/banner-desktop-v2.json`, `title`). Bold caps top out at 708/1000, so first ink is at 12.82 stage px, which is 12.51 CSS px. The SVG's top is therefore at 45.0 − 12.5 = **32.5**.
- **Only one geometry fits both.** If the web view starts at 0 with a 32 px inset, `.chdr-inner` would be at 32, but the banner's padding would be 32 + 4 − 14 = 22, so its ink would land at 34.5 and not 45.0. That is 21 device px off. If the web view starts at 32 with an inset of 0, both land at 32.
- The status bar's clock is vertically centered in a 32 px band. In shot 1, the band 0–31 is flat `#272727`, which is the page's top color, sampled by iOS. So the `black` style (`app/layout.js:40`) does not give an opaque black bar on the iPad the way it does on the phone, but the web view still starts below the bar.

**3. The feather is about 36 CSS px deep inside the web view.** Shot 1 against shot 3, mean gray difference across CSS x 550–1250 (empty ground): 1.09 at y = 64, 0.49 at 66, 0.07 at 68, 0.01 at 70, 0.00 from 72 down. In shot 2 the navbar's opaque `#1b1b1b` ground reaches flat 27 at y = 67. So the feather ends at screen y ≈ 68–72, which is 36–40 px below the web view's top edge. The phone's feather was ≈ 31 px below its bar (register §50). The current first-ink positions inside the web view:

| element | first ink, below the web view's top edge | inside the feather? |
|---|---|---|
| navbar wordmark (`.chdr-wm`) | 14 px (screen 46) | yes, all of it |
| navbar toggles | ≈ 13 px | yes |
| banner wordmark (desktop) | 12.5 px (screen 45) | top ~24 px of the glyphs |
| date picker text | ≈ 60 px | no (measured 219, full brightness) |

**4. What was searched.** All three `env(safe-area-inset-top)` rules in `globals.css` (`:2054`, `:2083`, `:3237`), the only uses outside comments, QA tools and tests. The tablet band's definition (`:2410-2412`, `:2421-2423`: `(max-width: 699px), (pointer: coarse)`), which is prompt 110's touch band and **also matches the phone**. `nav.test.mjs:278-288`, which requires exactly three literal `safe-area-inset-top` tokens in `globals.css`, one each in `.banner`, `.banner` standalone and `.chdr`. `CollapsedHeader.js:196-204`, whose `--stack-h` observer measures `.chdr`'s **border box**, so a spacer inside `.chdr` is carried into the picker's sticky offset with no arithmetic. `lib/headerstate.js:150-157` (`expandHeader()` scrolls to 0) and `AutoScroll.js:202`, `:247-248` (the Block B re-arm).

## The fix shape Cowork chose, and why

Handoff step 4 left two candidates open. **Headroom scoped to the tablet band is the one to build. The opaque-strip candidate is rejected.**

- **The opaque strip cannot be built.** Under `black`, the page's highest paintable row is the web view's top edge, and `.chdr` already paints opaque `--spot-2` there. Shot 2 shows that strip scrimmed. Reaching above it means returning to `black-translucent`. That reverses prompt 99, whose finding was that iOS 27 composites the blur above the web view, over an opaque `.chdr`. It also cannot be scoped to tablets, because it is one install-time meta tag.
- **Headroom does not depend on the mechanism.** Whatever arms the scrim, it is a feather about 36 px deep anchored to the web view's top edge. Ink placed below it cannot be dimmed by it. Nothing in this fix depends on register §50's unproven explanation.
- **What it costs, stated plainly:** a 32 px dark band above the navbar and the banner on the iPad, in every state, fresh open included. The navbar grows from 44 to 76 px, about 3% of a 992 px landscape web view. It gives back some of the space prompts 46, 50 and 51 removed, **on the tablet only**. The "no headroom" ruling (prompt 102, register §50 "What this does not do") was made on phone evidence and stays in force for the phone.
- **32 px, not 24.** The minimum that clears both wordmarks is 22–24 px. 32 px puts first ink 44–46 px below the edge, 4–10 px clear of where the difference reaches zero.
- **Register §48's pull-up stays contraindicated.** It moves the wordmark up, into a feather that is deeper on the iPad than on the phone.

### The scope condition, and why it is not prompt 110's

`(pointer: coarse)` alone matches the phone. `(min-width: 700px) and (pointer: coarse)` would also match an iPhone in landscape (932 × 430). **Use `(min-width: 700px) and (min-height: 600px) and (pointer: coarse)`.** That matches the iPad in both orientations (1366 × 992, 1024 × 1334) and excludes both phone orientations. Not gated on `display-mode: standalone`, deliberately: Chromium cannot match that condition, so it would be untestable in any gate, and the only cost outside the installed app is 32 px of ground in an iPad Safari tab. If you find evidence this condition matches something it should not, stop and report.

---

## Block A: the clearance

1. **One token and one media block**, placed after the banner-pin and collapse rules (after `:3394`). Declare the token where the other layout tokens live, with a comment carrying the measurement above. The name is your call; `--ipad-top-clear: 32px` is a fine one.
2. **The navbar:** inside the media block, `.chdr::before { content: ''; display: block; height: var(<token>); }`. A pseudo-element spacer, **not** a change to `.chdr`'s `padding-top`, and there are two reasons. `nav.test.mjs:278-288` pins exactly three `safe-area-inset-top` tokens, and the inset is 0 here anyway. And the spacer is inside `.chdr`'s border box, so it paints `--spot-2` and `--stack-h` carries it. Confirm `.chdr` has no existing `::before` (Cowork found none) and that `.chdr-inner`'s hairline (LINE 1, the comment at `:3418`) stays at the row's bottom.
3. **The banner:** inside the same block, `padding-top: var(<token>)` on `.bn-pc`. It is the element that shows at ≥ 700 px (`:2085`, `:2096`). Leave `.banner`'s own `padding-top` rules (`:2054`, `:2083`) untouched. The padding shows `.banner`'s gradient (`:2063`). Measure the seam between that band and the SVG's own `#272727` stage top at DPR 2. If the step is more than 1/255, paint the band from the artwork's first stop, taken from `banner-desktop-v2.json` or its token (never retyped, rule 16), and report which you did.
4. **The stale comments (rule 30, comments only):** correct `:3196`, `:3396` and the three dead line references at `:3671` to say what is true, and add a pointer from the `.chdr` block to the new media block. Prove the change is comment-only: with comments stripped, the stylesheet outside the new block must be byte-identical before and after (same sha256), and comment delimiters must still balance. Prompt 102 did this.
5. **Do not change:** `app/layout.js` (the status bar style stays `black`), any `.banner` padding rule, `.chdr`'s own declarations, `BannerTap.js`, anything under `max-width: 699px`, the mobile banner, or the artwork JSON.

## Block B: tests and measurements. Nothing is loosened.

1. **First, measure whether Playwright's Chromium matches `(pointer: coarse)` with `hasTouch: true`** at 1366 × 1024, before you write any assertion that relies on it. Report `matchMedia` for each clause of the condition. If coarse cannot be emulated, stop Block B and report it. Do not substitute a width-only rule.
2. **`nav.test.mjs`:** pin the media block's condition list as a set (the way `:299-312` does for the grid mirrors), assert the three clauses, and assert that the literal-token count at `:279` is still 3.
3. **A geometry table in Chromium** (report it, and add the load-bearing rows to `qa-shots.mjs`). Rows: `.chdr-inner` top, `.chdr` border-box height, `--stack-h`, `.pickrow` top when collapsed, `.bn-pc` SVG top, and banner wordmark first ink. Columns: before and after, at four viewports:
   - 1366 × 1024 coarse (the iPad). Expected: +32 on every row except `.pickrow`, which follows `--stack-h`.
   - 1024 × 1366 coarse (the iPad portrait). Expected: the same.
   - 390 × 844 coarse (the phone). Expected: **zero change on every row**.
   - 932 × 430 coarse (the phone, landscape). Expected: zero change.
   - 1440 × 900 fine (the desktop). Expected: zero change.
4. **The phone is untouched.** Prove it with **pixels, not just styles**: the phone's existing `qa-shots` PNGs must be byte-identical before and after. Report the file count and the hash comparison.
5. **The collapse still compensates on the iPad.** At 1366 × 1024 coarse, scroll past the sentinel and record the first card's top on screen before and after the collapse. It must not jump (prompt 60's promise), and it must hold with the taller bar. Then tap the navbar wordmark and confirm the Block B re-arm still leaves `data-pin` at `banner` after one animation frame (register §50).
6. **Mutation checks on every new or changed assertion:** drop each media clause in turn, set the token to 0, move the spacer onto `.chdr`'s `padding-top`, and remove `.bn-pc`'s padding. Show each one going red, then restore.

## Block C: the pictures, in two parts. The second part is on the device.

**C1, Chromium (untracked, in `assets/p114-ipad-scrim/`).** At 1366 × 1024, DPR 2, coarse, render three states before and after: fresh open (DAY / ALL GAMES / LIST), collapsed after a scroll, and tap-restored. Crop the top 160 CSS px at 1× and at 4×. Also write `navbar-wordmark-rows.json`: the mean RGB of the gold glyph pixels in the collapsed navbar's wordmark, per device row. Cowork compares the device against it, because this wordmark has its own top-to-bottom gold gradient, and only an unscrimmed reference separates the two.

**Then STOP.** Report, commit per the section below, and wait. Chromium has no scrim, so C1 proves geometry and nothing about legibility.

**C2, the iPad. Only after Joe types `preview`.** Push the commit to a throwaway branch: `git push origin HEAD:refs/heads/p114-ipad-scrim-preview`. **Never push `main` in this run.** This is the project's precedent (`docs/hub/hub-audit-2026-09-05.md:682`, a preview behind Vercel's Standard Protection that Joe signs in to). Report the preview URL from the Vercel check or deployment on that commit. If no preview build appears within 10 minutes, stop and report it. Then print **"Joe's device steps"** below with the real URL filled in, and end the run.

The acceptance is Cowork's, measured from Joe's three shots. It is not a gate, and this run does not decide it. The predictions, on the device, if the fix and the 32 px inference are both right: the navbar hairline at screen y ≈ 107, the navbar wordmark's first ink at ≈ 78, and the banner wordmark's first ink at ≈ 77. Every wordmark row should be ≥ 0.98 of its reference (shot 1 for the banner, C1's JSON for the navbar). If the positions come in anywhere else, the inference was wrong, and that finding matters as much as the fix.

### Joe's device steps (print verbatim, with the URL)

1. On the iPad, open **Safari**, not the MySports TV icon.
2. Tap the address bar, type the preview URL, and tap **Go**.
3. If Vercel asks you to log in, tap the method you use for Vercel and finish signing in.
4. When the app loads, tap the **Share** button (the square with an up arrow, top right of the Safari toolbar), scroll the sheet, and tap **Add to Home Screen**.
5. Change the name to **MySports Preview** and tap **Add** (top right).
6. Go to the Home Screen and open **MySports Preview**. If it shows a Vercel login again, sign in inside it. If you cannot get past the login, stop and tell Cowork. Do not push anything.
7. Hold the iPad in landscape. Within one minute:
   1. Right after the app opens, on DAY / ALL GAMES / LIST, take a screenshot (press the **top button** and **volume up** together). This is shot 1.
   2. Scroll down until the navbar appears, then take shot 2.
   3. Tap **MYSPORTS TV** in the navbar to bring the banner back, then take shot 3.
8. Attach the three screenshots in the Cowork session.
9. When Cowork is done, press and hold the **MySports Preview** icon, tap **Remove App**, then **Delete from Home Screen**. Your production MySports TV icon is not affected.

## Block D: documents, and rev B's real bytes

1. **Replace `docs/prompts/113-cap-table-on-the-ruled-band-rev-B.md` with the Project's bytes.** Cowork byte-compared the tree against the Project on 2026-09-23. **Verify before you copy.**

   | file | Project | tree at `ec99819` | result |
   |---|---|---|---|
   | `113-cap-table-on-the-ruled-band.md` | 9,937 B, `2b65861c…` | 9,937 B, `2b65861c…` | **byte-identical** |
   | `…-rev-B.md` | 5,469 B, `aef2295c…` | 5,268 B, `cf0d27bf…` | **differs.** The words are identical once Markdown is stripped, but the tree copy lost every piece of formatting: 98 backticks, 28 bold markers, 4 headings, the `---` rules and the `- ` bullets. It is a rendered-text transcription. |
   | `…-rev-C.md` | **no Project copy exists** | 8,647 B, `b4a48249…`, Markdown intact | cannot be compared |

   The Project's exact bytes are in `Claude outputs\prompt-113-rev-B-project-copy-2026-09-22.md`. Copy that file over the tree's rev B and confirm **sha256 `aef2295cb3db293450d6f71fe8e92dd9b5cc46a542cd828657442cb4c277a344`, 5,469 bytes, LF** (`.gitattributes` holds `*.md` to LF). Change nothing else in it.
2. **`docs/prompts/README.md`:** correct row `:167` and the provenance row `:265`. 113's original now has a surviving second copy, byte-identical. Rev B is replaced with the Project's bytes, and the old copy was a formatting-stripped transcription with the same words. Rev C still has no second copy (Chat wrote it, and it was never filed to the Project), so it stays at the weaker provenance, at the same strength as 103–111. Update the count sentences the way the README's own convention requires (counted from the directory, not incremented).
3. **Register §59.** Confirm first that §1–§58 each appear exactly once. Record: the iPad contradicts §50's hypothesis (an opaque sticky `.chdr` is scrimmed); the mechanism is still unknown and this fix does not depend on it; the 32 px web-view offset and the 0 inset, marked **inferred** with both fits; the 36–40 px feather; the rejected opaque-strip shape and why; the scope condition and why it is not prompt 110's; and that the phone's "no headroom" ruling stands. Add a dated line under §50 pointing to §59.
4. **`docs/rendering-contract-mobile.md`:** an amendment note (the next version after v2.4) saying M22's top-edge treatment gains a tablet clause. Amend by note, the way v2.3 did (`:14-16`), and **never overwrite frozen manifest values**.
5. **Rule 23:** check whether `docs/design/mobile_demo.html` implements anything at ≥ 700 px with a coarse pointer. Cowork expects it does not, because it is the phone reference. Say what you found. Change it only if it does.
6. **`docs/handoff-status.md`:** the gate line as usual. **Three stale clauses from yesterday:** the prompt 113 rev C, rev B and 113 lines (`:75`, `:83`, `:91`) each still say "**NOT PUSHED**", but `origin/main` is `ec99819`. Annotate each in the file's own style (`:119` and `:137` show it): `*(Superseded: pushed 2026-09-22 with <range>.)*`, with the range read from git and not from this brief. Add an OPEN item: *114 is committed, and awaits Joe's iPad shots from the preview. Milestone "iPad banner fixed" closes on Cowork's measurement of those shots, not on a gate.*
7. **File this brief** as `docs/prompts/114-ipad-navbar-scrim-headroom.md`, from `Claude outputs\prompt-114-ipad-navbar-scrim-headroom-2026-09-23.md`, byte for byte, and report its sha256.

---

## Explicitly out of scope

- The status bar style, `layout.js`, the manifest, and any service-worker or cache change.
- Any phone geometry, including the navbar's inset asymmetry note at `:3671` (a separate decision that needs a phone).
- Register §48's pull-up.
- Proving §50's mechanism. It is recorded as unknown, not investigated.
- Queue item 11 and the rim-only class. **Oklahoma State (`197`)** is a note for whoever opens item 11, not a task here.
- The `Banner.js:21` "155/428" debt, preemption, and any data or pipeline file.

## Gates and committing

Run all five gates, each as its own command with its own count. Read the floors from `docs/handoff-status.md` under **"Repo state"** beforehand, never from `CLAUDE.md`, a summary or this brief. `test:unit` and `qa-shots` should rise in Block B. For each gate that moves, report which gate, by how much, and why, and edit its floor row in the same keystroke as the movements row.

**Stages self-commit on green, in two commits: Blocks A–C1, then Block D. DO NOT PUSH `main`.** This overrides `CLAUDE.md` rule 7's default for this run: a push is a deploy, and this change is only judged on a device. The only push this run may make is C2's preview branch, and only after Joe types `preview`.

End with the undo block (`CLAUDE.md` `## Committing`): the exact revert command with both real SHAs, whether anything was one-way (the preview branch is the one remote object; give its delete command), and confirmation that `main` was not pushed. Leave the dev server stopped by path.
