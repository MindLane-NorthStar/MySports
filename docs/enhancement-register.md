# MySports — Enhancement Register

**This file lives in the repo** and is mirrored to the Claude project at `claude/enhancement-register.md`. The repo copy is the source; the project copy is written from it. Edit here.

---

> **INCOMPLETE — §1 through §13 are not in this file yet.**
>
> Prompt 26 stage 1a was to relocate the register from the Claude project into the repo, because prompt 25 could not open two of its five named authorities and had to work from what its brief quoted inline — the same gap prompt 23 flagged for `claude/src/mobile_demo.html`. The stage's own instruction was: *if a source file is missing from your working tree, list it in the report and skip it rather than reconstructing it from quotes.*
>
> No copy of the register exists in this working tree. The only near-miss is `docs/feature-study/patches/enhancement-register-s11.md`, which is a pointer fragment for §11 and not the register. So nothing was relocated and **nothing here is reconstructed**.
>
> This file exists because §14 below is a binding ruling supplied verbatim by Joe in prompt 26, and it is the authority for that prompt's stage 2, which shipped. A ruling that governs shipped code has to live in the repo. §1–§13 arrive when Joe supplies the source file; until then they are in the Claude project and that copy is authoritative for them.

---

## 14. THE ACTIVE CHIP INVERTED — 2026-09-03, after prompt 25 measured the marks on gold

§13's selected-chip rule read: the active chip sits on a gold plate, so its mark uses the **raw**
art, not `_dark` (contract v1.3e, light plate = raw).

**A consequence nobody priced.** Prompt 25 stage 3 measured every league mark composited on the real
gold plate (`--gold` `#f0c850`). The CFP mark — which §13 itself chose for the CFB chip, logo-only —
is effectively invisible on it: **100% of its opaque ink below 3:1, best case 1.61:1**, confirmed by
eye as a ghost. This is not a `_dark` problem: `cfp_dark` reads 10.05:1 on charcoal. The raw art is
light-on-light and no treatment fixes that.

And it is not only CFP. Raw-on-gold, measured: cfp 1.23 · nba 1.50 · nfl 1.83 · indycar 1.91 ·
mlb 2.08 · nhl 3.35 · ufc 3.40 · aew 8.76 · nascar 10.00 · wwe 10.55. Five of ten below 3:1.
Prompt 25's caveat is on record and endorsed: a multi-colour mark always has *some* ink near any
ground, and the NFL shield reads clearly on gold by eye at 9.20:1 best ink — it trusted the render
over the arithmetic, which is working rule 13 behaving correctly. CFP is the one that genuinely fails.

**Ruling: invert the active chip.** The active chip becomes a **charcoal plate with a gold border**,
not a gold fill. Every chip then floats on charcoal in both states and takes `_dark` always.

- One mark state on the chip row instead of two.
- No new art. The CFP problem disappears, and so do the four other weak raw-on-gold marks.
- It scales: every future league mark is only ever asked to read on one ground.
- Contract v1.3e's light-plate context still exists and is unchanged — it governs grid caps and light
  tint plates (addendum M12). It simply no longer applies to chips.
- **Cost, named:** a bordered chip reads quieter than a filled plate. The active state must stay
  unmistakable at a glance — gold border *and* gold text, not border alone.

This amends §13's selected-chip rule only. Marks-only chips, the chip roster, the AEW amendment, the
CFP choice for the CFB chip, the scrolling row and the band-header rule are all unchanged.
