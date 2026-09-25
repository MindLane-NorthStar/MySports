# Prompt 122 — Icon v9 install and deploy

File this brief verbatim at `docs/prompts/122-icon-v9-install-and-deploy.md` (renumber if 122 is taken).

Commit and push are authorized for this work: `CLAUDE.md` defines the unwaivable stop list, and Joe
asked for the deploy explicitly. **S4 still binds — never commit or push over a red gate.** Stop and
report instead.

---

## Stage 0 — clean up two files Cowork could not delete

Cowork's device shell mounts this repo with deletes blocked, so a diagnostic left two stray files
inside `.git`. Neither is tracked and neither affects history, but `index.lock` will block `git add`
and `git commit` until it is gone.

```
.git/index.lock      0 bytes, created by a read-only `git status` that could not clean up after itself
.git/_probe          0 bytes, a write-permission probe
```

Delete both, then confirm `git status` runs without the "unable to unlink" warning.

Leave `AGENTS.md` and `assets/_audit_tmp/` alone. Both were already untracked before this work and are
not mine to tidy.

---

## Stage 1 — what is already in the tree

Cowork wrote these. They are untracked by design (`assets/` is untracked on purpose and is not drift):

```
assets/brand/icon-v9/app-icon-mysports-tv-v9-1024.png   1024x1024   the master
assets/brand/icon-v9/icon-512.png                        512x512
assets/brand/icon-v9/icon-192.png                        192x192
assets/brand/icon-v9/apple-touch-icon-180.png            180x180
assets/brand/icon-v9/icon-48.png                          48x48
```

v9 is v8 with two corrections. The wordmark's letter-spacing was tightened and its width reduced, and
the set and the six league marks were scaled to 90%. Measured clearance from each element to the iOS
squircle, on the shipped master:

| element | v8 | v9 |
|---|---|---|
| MYSPORTS TV | 27.3 px | **59.9 px** |
| NASCAR | 35.9 | **46.3** |
| CFB | 55.9 | **65.6** |
| NFL / NHL / NBA | 82.6 / 80.6 / 85.3 | **93.9 / 92.3 / 92.9** |

Nothing else about the composition changed: same layout, same marks, same blacked-out screen.

---

## Stage 2 — install

1. Retire the current master, following the existing convention (`-v5-retired`, `-v6A-rejected`,
   `-v7-retired`):
   `git mv assets/brand/app-icon-mysports-tv.png assets/brand/app-icon-mysports-tv-v8-retired.png`
2. Copy `assets/brand/icon-v9/app-icon-mysports-tv-v9-1024.png` to
   `assets/brand/app-icon-mysports-tv.png`.
3. Replace each live file from its matching derivative:

   | live file | source | expected size |
   |---|---|---|
   | `web/public/brand/app-icon-mysports-tv.png` | `icon-v9/app-icon-mysports-tv-v9-1024.png` | 1024 |
   | `web/public/icon-512.png` | `icon-v9/icon-512.png` | 512 |
   | `web/public/icon-192.png` | `icon-v9/icon-192.png` | 192 |
   | `web/app/apple-icon.png` | `icon-v9/apple-touch-icon-180.png` | 180 |
   | `web/app/icon.png` | `icon-v9/icon-48.png` | 48 |

   Confirm each destination's current pixel size before overwriting and match it. If any destination
   is not the size above, stop and report rather than resizing.

4. Read `web/app/manifest.js` and confirm the icon entries still point at those paths with the right
   `sizes` strings. No change is expected — the paths and sizes are unchanged from v8. Report what you
   found either way.

---

## Stage 3 — verify before committing

1. `md5sum` each of the five live files against its source in `assets/brand/icon-v9/`. All five must
   match byte for byte. Report the hashes.
2. Confirm `assets/brand/app-icon-mysports-tv-v8-retired.png` exists and that
   `assets/brand/app-icon-mysports-tv.png` now matches the v9 master.
3. Run the five gates, each reported as its own command with its own output.

---

## Stage 4 — commit and push

Only if every gate is green.

Commit message, subject line:

```
icon: v9 pulls the wordmark and NASCAR off the mask
```

Body should record that the wordmark's clearance to the squircle went from 27.3 px to 59.9 px by
tightening tracking to 0.004 and narrowing the type to 82% of the tile, that the set and the six
marks went to 90%, and that v8 is retired alongside v5, v6A and v7.

Then push. Vercel builds from `main`, so the push is the deploy.

---

## Stage 5 — report

State the deployed commit, the Vercel build result, and the gate results. Then remind Joe of the two
things the deploy does not do:

- An **installed** PWA caches its icon. His current home-screen tile will keep showing v8 until he
  removes it and re-adds it from Safari. A fresh "Add to Home Screen" picks up v9 immediately.
- The launcher tile is separate. Cowork wrote `MySports TV.png` (1254x1254, matching the other tiles)
  into `mylife-hq.com/FINAL ICONS/`. Wiring it into the MyLife HQ launcher grid is its own milestone
  in FinishLine and is **not** part of this brief.

**Do not** touch the banner, the marks, or anything outside the files named above.
