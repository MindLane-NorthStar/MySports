# Prompt 82 — close Block F, push, then run Block D2

Block F is approved. Four corrections first, then the commit, then the push, then Block D2 of
prompt 81 (already filed at `docs/prompts/81-mlbtv-deeplink-favourite-mark-icon-v8-banner.md` — read
it there rather than from memory).

**JOE'S EXPLICIT APPROVAL, AND ITS EXACT SCOPE.** He approves committing Block F and pushing `main`.
That approval covers the three commits named in §2 and nothing else. **It does not extend to D2 or
to E** — both still end with the work in the tree and a diff for Joe, uncommitted and unpushed.

---

## 1. Four corrections before Block F commits

Nothing here is a rewrite. All four are additions to what is already staged.

### 1a. Fix the floor table now, in this commit — not in a later block

`docs/handoff-status.md` reads **514 passed + 1 skipped** and **552** in the gate-floor table.
Verified: that is what the file says. The tree sat at **515 + 1** and **560** before Block F, because
prompt 80's committed work moved both and the geometry section was updated while the table was not.

Fix it here rather than deferring, for three reasons:

- **Rule 30's own instruction** is to correct a misleading note in the same commit as the work it
  misled. It has already misled: prompt 81 quoted 514 and 552 out of that table into a brief.
- **That table is the single authority by design.** Prompt 66 deleted the second copy from
  `CLAUDE.md` after it was wrong four times in one week. A stale sole authority is worse than a
  second copy, because nobody diffs it against anything.
- **D2 and E will each move `test:unit` again.** Left alone, the next reader sees one unexplained
  jump instead of two explained ones.

**Record both movements, do not silently overwrite.** The table should end at 515 + 1 / 568 / 33 / 91
/ all hard stops, and the prose beside it should say plainly that prompt 80 took pytest 514 → 515 and
`test:unit` 552 → 560 without the table being updated, and that Block F added 8 (`mlbdeeplink.test.mjs`)
to reach 568. The gap is the useful part of the record; erasing it wastes the correction.

### 1b. Mutation-check the enumeration test

Three mutations, three kills, tree restored each time — that is the discipline working, and the
regex, the `href` prop and the DIRECTV `href` are all genuinely defended.

The rule-32 enumeration test is not among them, and it is the one doing the most load-bearing work in
the block: it is the only thing that will catch a **future** MLB-app service silently missing this
treatment, which is the exact failure rule 32 exists for. Mutate it: add a third `mlb.com` URL to the
`WATCH` map and confirm the test fails. If it does not, it is counting something that cannot change
and it is the eighth vacuous assertion this repo has found. Restore the tree either way and say which
happened.

### 1c. The `mlb-network` exclusion keeps both of its reasons

The call is right. Make sure the note records **both** reasons and not just the first, because they
have very different shelf lives. The AASA path list is a 2026-09-07 snapshot of a file MLB can
rewrite without telling anyone; if that becomes the only reason on record, the decision quietly rests
on a fact that may already have changed. The second reason — MLB Network is a linear cable channel,
not the per-game MLB.TV product — does not depend on anything outside this repo and is what should
carry the ruling.

### 1d. Report the secret gate

Nothing is wrong: rule 3 runs at commit time and Block F has not committed. It simply was not in the
report. Run it on ADDED lines only, with `grep` and never `findstr`, and put the result in the commit
report rather than leaving it assumed.

### 1e. Re-run the gates

1b changes the tree twice, so the gates are re-run after the tree is restored — all five, as their
own commands, results read from the runner and never from the exit code of a chained command
(rule 26). Report all five against the floors as **corrected in 1a**.

---

## 2. Commit and push — and know what the push actually carries

Stage by explicit path (rule 4). `assets/` and `web/public/banner/tv-cutout-dark.png` stay unstaged;
the latter is Block E's.

**`main` is ahead of `origin/main` by 2 before this commit, so the push sends THREE commits, not
one.** Verified with `git status -sb`. This is the point at which Joe's held approval on prompt 80
is spent, and he is spending it deliberately:

| commit | what it carries |
|---|---|
| `dce1948` | geometry — the tripwire becomes the day's span, which standings cannot move |
| `4e495b8` | order — a favourite outranks a stranger at the same minute (D1) |
| *this one* | watch — the MLB.TV link is per-game |

Push `main`. **There is no programmatic deploy check in this repo** — `scripts/` and
`.github/workflows/` contain nothing Vercel-aware, and the only mention is in
`docs/deployment-contract.md`. Do not invent one and do not claim a deploy is green from a successful
push. Report that the push succeeded, name the three commits, and hand the deploy check to Joe.

**Why this push is worth making before D2 and E:** rule 12 means `next build` cannot run locally at
all, so the Vercel build is the only compile check that exists anywhere in this workflow. Block F is
five files, one of them a new test — the cheapest change that will ever go through that check, and
the right one to send before ten files of D2 and five stages of E are stacked on top of it.

### What Joe checks on the device (rule 25)

Two things land in this deploy, so say both in the report:

1. **The MLB.TV link, tapped from inside MySports TV** — this is Block F3's open instrument. The MLB
   app opening means the in-app hand-off works and the question is closed. Safari opening means
   `target="_blank"` is the next one-line test, exactly as the research note now says.
2. **D1's ordering**, from `4e495b8` — a pregame show before the game it precedes, and a favourite
   ahead of a stranger at the same minute.

Icons and banner art are **not** in this deploy; that is Block E. If Joe's home-screen tile still
shows the old icon, that is expected and is not a failed deploy.

---

## 3. Then Block D2

Read Block D2 from `docs/prompts/81-mlbtv-deeplink-favourite-mark-icon-v8-banner.md` and run it as
written. Three things carried forward from Block F that apply to it directly:

- **Mutation-check every assertion, including the enumerative ones.** D2 rewrites
  `favbracket.test.mjs` wholesale and retires assertions in three more files; a rewritten test that
  cannot fail is worse than the deleted one it replaced.
- **The geometry tripwire's two halves are not the same thing.** Block **count**, lane count and row
  count are the hard stop (`CLAUDE.md:211`); block **widths** and `scrollWidth` are "REPORTED, not
  asserted — data-derived and legitimately drifting" (`:220`). Block F's MLB figures came back
  `3 / {229} / 569` against an older `{228} / 568` and that is sanctioned drift, not a hit. Do not
  report a width change as a tripwire failure, and do not treat one as licence to ignore a count
  change.
- **`docs/handoff-status.md`'s floor table is correct as of this commit.** Keep it that way — if D2
  moves `test:unit`, the table moves in D2's commit.

End D2 with the work in the tree, all five gates reported, the QA shots rendered at **both** the 1px
and the 2px reads so Joe picks from a picture, and a diff. **Do not commit and do not push.**

Block E is not part of this prompt.
