// The home-page banner. The PHONE breakpoint is BannerMobileV2 - banner v2 artwork, one inline SVG
// with its coordinates baked in. The DESKTOP breakpoint is still the JSON-drawn SVG below, from
// web/lib/banner-layout.json; it is replaced in its own commit so either breakpoint can be
// reverted alone.
//
// Server component on purpose. The layout JSON already carries every number the drawing needs -
// including `ar`, the width/height of each PNG, written by scripts/build_brand_marks.py - so this
// renders as a pure function of that file with no image library, no measurement and no client JS.
// Moving a mark is a JSON edit; it never becomes a code change.
//
// WHY THE FILTER IDS ARE PREFIXED. Both breakpoints are in the DOM at once and CSS hides one of them
// (`.bn-pc`/`.bn-mobile`, swapped at 700px). SVG filter ids are document-global, so if both SVGs
// declared `id="ds"` the hidden copy could win the lookup - and Chromium renders NOTHING, not an
// unfiltered shape, when a filter id resolves into a display:none subtree. Every id here is therefore
// namespaced by breakpoint ('pc-' / 'mo-'), which is also what the reference SVGs in
// docs/design/banner/ do. BannerMobileV2 follows the same discipline with its own 'bn' prefix, so
// the two SVGs cannot collide while both are mounted.

import layout from '../lib/banner-layout.json';
import BannerMobileV2 from './BannerMobileV2.jsx';

const GOLD = '#F0C850';
const WHITE = '#FFFFFF';
// Spark palette, keyed by the JSON's one-letter `kind`. g/w are four-point stars; c/m/r are dots.
const DOT = { c: '#5ED8F0', m: '#F05ED2', r: '#F06060' };

const r1 = (n) => Math.round(n * 10) / 10;

// A mark's drawn height: leagues render at their natural h (a league is an identity, not a badge),
// while network and program marks are scaled by the frozen ink-normalization factor so they carry
// the same visual weight as each other.
function box(m) {
  const h = m.kind === 'league' ? m.h : m.h * (m.hf ?? 1);
  const w = h * (m.ar ?? 1);
  return { x: r1(m.cx - w / 2), y: r1(m.cy - h / 2), w: r1(w), h: r1(h) };
}

function Defs({ p }) {
  return (
    <defs>
      <filter id={`${p}-ds`} x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity=".7" />
      </filter>
      <filter id={`${p}-glow`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="1.2" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id={`${p}-wm`} x="-20%" y="-50%" width="140%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor={GOLD} floodOpacity="1" />
        <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={GOLD} floodOpacity=".5" />
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity=".8" />
      </filter>
      <filter id={`${p}-sub`} x="-10%" y="-50%" width="120%" height="200%">
        <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity=".9" />
      </filter>
    </defs>
  );
}

function Spark({ s, p }) {
  const glow = `url(#${p}-glow)`;
  if (s.kind === 'g' || s.kind === 'w') {
    const { x, y, r } = s;
    // Four-point star as two mirrored quadratic pairs - the same path the reference SVGs emit.
    const d =
      `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r}` +
      ` Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`;
    return <path d={d} fill={s.kind === 'g' ? GOLD : WHITE} filter={glow} opacity=".95" />;
  }
  // A dot reads heavier than a star of the same nominal radius, so the JSON's r is damped for dots.
  return <circle cx={s.x} cy={s.y} r={r1(s.r * 0.56)} fill={DOT[s.kind] ?? WHITE} filter={glow} />;
}

function Stage({ side, p }) {
  const b = layout[side];
  const tv = box({ ...b.tv, kind: 'tv' });
  return (
    <svg
      className="scatter"
      viewBox={`0 0 ${b.w} ${b.h}`}
      width={b.w}
      height={b.h}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <Defs p={p} />
      {b.sparks.map((s, i) => (
        <Spark key={`${p}-s${i}`} s={s} p={p} />
      ))}
      <image href={b.tv.href} x={tv.x} y={tv.y} width={tv.w} height={tv.h} filter={`url(#${p}-ds)`} />
      {b.marks
        .filter((m) => !m.pending)
        .map((m) => {
          const g = box(m);
          return (
            <image
              key={`${p}-${m.slug}`}
              href={m.href}
              x={g.x}
              y={g.y}
              width={g.w}
              height={g.h}
              filter={`url(#${p}-ds)`}
            >
              <title>{m.slug}</title>
            </image>
          );
        })}
      {/* Title and subhead live INSIDE the SVG so they scale with the stage instead of drifting
          against it - an HTML overlay would need its own font-size curve at every width. The
          subhead's x is nudged by half its letter-spacing: SVG adds the tracking after the final
          glyph too, which pushes a text-anchor="middle" run left by exactly that much. */}
      <text
        x={b.w / 2}
        y={b.title.y}
        textAnchor="middle"
        fontFamily="Barlow Condensed"
        fontWeight="700"
        fontSize={b.title.size}
        letterSpacing={b.title.ls}
        fill="#fff"
        filter={`url(#${p}-wm)`}
      >
        {'MYSPORTS '}
        <tspan fill={GOLD}>TV</tspan>
      </text>
      <text
        x={r1(b.w / 2 + b.sub.ls / 2)}
        y={b.sub.y}
        textAnchor="middle"
        fontFamily="Barlow Condensed"
        fontWeight="600"
        fontSize={b.sub.size}
        letterSpacing={b.sub.ls}
        fill="#9AA0A8"
        filter={`url(#${p}-sub)`}
      >
        {b.subhead}
      </text>
    </svg>
  );
}

export default function Banner() {
  return (
    <header className="banner">
      <div className="bn-pc">
        <Stage side="pc" p="pc" />
      </div>
      <div className="bn-mobile">
        <BannerMobileV2 />
      </div>
    </header>
  );
}
