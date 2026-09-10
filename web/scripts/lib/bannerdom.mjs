// THE BANNER, AS THE BROWSER RECEIVED IT — the reader `qa-shots` asserts with and the mutation
// probe attacks (prompt 84, rule 24).
//
// WHY THIS IS A MODULE AND NOT TWO COPIES. Prompt 81 block E changed the banner three ways and
// every guard it shipped with was a PYTHON test reading JSX as text. That is rule 24 verbatim: a
// fact established on the Python side is no evidence the JS runtime agrees. The fix is assertions
// against the served DOM — but an assertion nobody has broken on purpose is a claim, not a guard,
// so `probes/banner-mutation.mjs` breaks each fact and expects the matching check to fail.
//
// Both of those have to exercise THE SAME predicates. A probe that re-implements the gate's checks
// proves its own copy works and nothing about the gate, which is the defect prompt 74's mutation
// sweep was written to catch one layer up. Hence one reader, one predicate list, two callers.
//
// BOTH BREAKPOINTS ARE ALWAYS IN THE DOM. `Banner.js` mounts BannerDesktopV2 and BannerMobileV2 at
// once and CSS chooses which paints (`.bn-pc` / `.bn-mobile`), so the caller says which one it
// means. The desktop half is the one worth the trouble: there is no desktop generator, it is
// hand-transcribed, and it is invisible from a phone viewport.

export const BREAKPOINTS = {
  mobile: { root: '.bn-mobile', pfx: 'bn' },
  desktop: { root: '.bn-pc', pfx: 'bd' },
};

/** Read every fact prompt 81 block E changed, out of the live document. */
export async function readBanner(page, key) {
  const { root, pfx } = BREAKPOINTS[key];
  return page.evaluate(({ root, pfx }) => {
    const svg = document.querySelector(`${root} svg`);
    if (!svg) return { missing: true };
    const halo = svg.querySelector(`text[filter="url(#${pfx}TitleHalo)"]`);
    const tv = svg.querySelector('image[href*="tv-cutout"]');
    return {
      missing: false,
      // E3 — the blacked-out set. The attribute the browser resolved, not the source string.
      tv: tv ? tv.getAttribute('href') : null,
      // E2 — the dark halo. `#C6AF7A` here is the gold glow come back.
      haloFill: halo ? halo.getAttribute('fill') : null,
      haloOpacity: halo ? halo.getAttribute('opacity') : null,
      haloText: halo ? halo.textContent : null,
      goldPass: !!svg.querySelector(`text[fill="url(#${pfx}Gold)"]`),
      oldGlow: !!svg.querySelector(`[id="${pfx}TitleGlow"], [filter="url(#${pfx}TitleGlow)"]`),
      // E4 — the re-tapered tails, every stop of both gradients.
      glows: [0, 1].map((i) => {
        const g = svg.querySelector(`#${pfx}Glow${i}`);
        return g ? [...g.querySelectorAll('stop')].map((st) => [
          st.getAttribute('offset'), st.getAttribute('stop-opacity'),
        ]) : null;
      }),
    };
  }, { root, pfx });
}

/**
 * The checks, as {id, label, pass, detail}. `id` is what the mutation probe names, so a renamed
 * label cannot silently detach a mutation from the check it is supposed to break.
 */
export function bannerChecks(b, key) {
  const { pfx } = BREAKPOINTS[key];
  const out = [
    { id: 'present', label: `${key}: the banner SVG is in the served DOM`, pass: !b.missing, detail: '' },
  ];
  if (b.missing) return out;

  out.push({
    id: 'cutout',
    label: `${key}: the television is the BLACKED-OUT cutout`,
    pass: b.tv === '/banner/tv-cutout-dark.png',
    detail: String(b.tv),
  });

  // BOTH PASSES, because proving the halo went dark is worthless if the wordmark stopped painting.
  out.push({
    id: 'halo',
    label: `${key}: the title halo is #000000 under #${pfx}TitleHalo, with no opacity dimmer`,
    pass: b.haloFill === '#000000' && b.haloOpacity === null && b.haloText === 'MYSPORTS TV',
    detail: `fill=${b.haloFill} opacity=${b.haloOpacity} text=${JSON.stringify(b.haloText)}`,
  });
  out.push({
    id: 'gold',
    label: `${key}: the gold wordmark still paints over it, and the gold GLOW is gone`,
    pass: b.goldPass && !b.oldGlow,
    detail: `gold pass ${b.goldPass}, ${pfx}TitleGlow present ${b.oldGlow}`,
  });

  // FIVE STOPS ENDING AT ZERO — the COUNT matters as much as the value. Block E4 ADDED the 95% stop
  // rather than moving the 100% one; a four-stop gradient ending at 0 is the outright zeroing that
  // prompt 45 measured at 11.38% of the stage and that Joe did not choose.
  b.glows.forEach((stops, i) => {
    out.push({
      id: `glow${i}`,
      label: `${key}: #${pfx}Glow${i} has five stops and its tail reaches zero`,
      pass: !!stops && stops.length === 5 && stops[3][0] === '95%'
            && stops[4][0] === '100%' && Number(stops[4][1]) === 0,
      detail: stops ? stops.map(([o, a]) => `${o}:${a}`).join(' ') : 'gradient not found',
    });
  });
  return out;
}
