// MySports TV — home banner v2, DESKTOP breakpoint. Stage 1400x200, scales to the container width.
// Assets live in web/public/banner/ (copied from the handoff package).
//
// THIS FILE IS HAND-WRITTEN, AND ITS HEADER USED TO SAY OTHERWISE. It read "Generated 2026-09-04
// from banner-desktop-v2.json" and "regenerate from the JSON if the design changes".
// THERE IS NO DESKTOP GENERATOR. `scripts/` holds `build_banner_mobile.py` and no equivalent for
// this breakpoint, so the only instruction the header gave was one nobody could follow. Rule 33 is
// the standing version of that mistake, and prompt 81 block E hit it: changing the halo and the
// glow tails here meant hand-editing a file that forbade hand-editing.
//
// SO THE RULE HERE IS THE OPPOSITE ONE, and it is narrow. `web/lib/banner-desktop-v2.json` is still
// the record of the design: edit the JSON first, then transcribe the affected attributes here by
// hand and change nothing else. There is no `--check` to catch a transcription slip, which is why
// COORDINATES ARE STILL NOT TOUCHED BY HAND — the marks, the stage and the cutout box came out of
// prompt 42's layout pass and no later prompt has had a reason to move one. Prompt 81 changed four
// lines: two gradients, one filter, one image href, plus the fill on the halo text pass.
export default function BannerDesktopV2() {
  return (
    <svg viewBox="0 0 1400 200" width="100%" role="img" aria-labelledby="bdTitle" style={{ display: "block" }}>
    <title id="bdTitle">MySports TV. Every game. Every channel. One place.</title>
    <defs>
    <linearGradient id="bdBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#272727"/><stop offset=".45" stopColor="#232323"/><stop offset="1" stopColor="#1A1A1A"/></linearGradient>
    <radialGradient id="bdGlow0" cx=".5" cy=".5" r=".5"><stop offset="0%" stopColor="rgb(255,170,60)" stopOpacity="0.32"/><stop offset="45.3%" stopColor="rgb(255,170,60)" stopOpacity="0.176"/><stop offset="82%" stopColor="rgb(255,170,60)" stopOpacity="0.058"/><stop offset="95%" stopColor="rgb(255,170,60)" stopOpacity="0.0313"/><stop offset="100%" stopColor="rgb(255,170,60)" stopOpacity="0"/></radialGradient>
    <radialGradient id="bdGlow1" cx=".5" cy=".5" r=".5"><stop offset="0%" stopColor="rgb(255,170,60)" stopOpacity="0.42"/><stop offset="45.3%" stopColor="rgb(255,170,60)" stopOpacity="0.231"/><stop offset="82%" stopColor="rgb(255,170,60)" stopOpacity="0.076"/><stop offset="95%" stopColor="rgb(255,170,60)" stopOpacity="0.0413"/><stop offset="100%" stopColor="rgb(255,170,60)" stopOpacity="0"/></radialGradient>
    <linearGradient id="bdGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E0D1A5"/><stop offset=".42" stopColor="#C6AF7A"/><stop offset=".7" stopColor="#B39A69"/><stop offset="1" stopColor="#8C7650"/></linearGradient>
    <filter id="bdTitleHalo" x="-25%" y="-140%" width="150%" height="380%" colorInterpolationFilters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="12.1" result="w"/><feComponentTransfer in="w" result="wide"><feFuncA type="linear" slope="1.9"/></feComponentTransfer><feGaussianBlur in="SourceAlpha" stdDeviation="3.8" result="t"/><feComponentTransfer in="t" result="tight"><feFuncA type="linear" slope="2.7"/></feComponentTransfer><feMerge><feMergeNode in="wide"/><feMergeNode in="tight"/></feMerge></filter>
    <filter id="bdMark" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#ffffff" floodOpacity=".22" result="halo"/><feDropShadow in="halo" dx="0" dy="2" stdDeviation="1.2" floodColor="#000000" floodOpacity=".55"/></filter>
    <filter id="bdTv" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#000000" floodOpacity=".65" result="s"/><feDropShadow in="s" dx="0" dy="0" stdDeviation="6" floodColor="rgb(255,150,40)" floodOpacity=".28"/></filter>
    </defs>
    <rect x="0" y="0" width="1400" height="200" fill="url(#bdBg)"/>
    <ellipse cx="1223" cy="99" rx="200" ry="120" fill="url(#bdGlow0)"/>
    <ellipse cx="1215" cy="103" rx="88" ry="74" fill="url(#bdGlow1)"/>
    <image href="/banner/tv-cutout-dark.png" x="1165.06" y="50.5" width="99.87" height="105" preserveAspectRatio="xMidYMid meet" filter="url(#bdTv)"/>
    <image href="/banner/nbc.png" x="60.01" y="93.2" width="31.98" height="31.6" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/fox.png" x="141.0" y="100.05" width="42.19" height="17.9" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/espn.png" x="232.19" y="100.05" width="72.03" height="17.9" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/cbs.png" x="353.28" y="100.05" width="64.44" height="17.9" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/abc-gray.png" x="466.7" y="93.2" width="31.6" height="31.6" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/paramount.png" x="547.39" y="100.05" width="77.83" height="17.9" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/dazn.png" x="674.2" y="93.2" width="31.6" height="31.6" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/prime.png" x="754.78" y="97.4" width="72.43" height="23.2" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/appletv.png" x="876.3" y="98.45" width="40.41" height="21.1" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/guardstv.png" x="965.75" y="91.1" width="34.3" height="35.8" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/tnt.png" x="60.0" y="140.2" width="31.6" height="31.6" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/netflix.png" x="135.47" y="147.05" width="66.66" height="17.9" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/peacock.png" x="246.05" y="147.05" width="57.91" height="17.9" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/usa.png" x="347.86" y="146.8" width="41.88" height="18.4" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/tbs.png" x="433.53" y="146.8" width="34.13" height="18.4" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/espn2.png" x="511.62" y="147.05" width="93.76" height="17.9" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/fs1.png" x="649.22" y="143.35" width="55.96" height="25.3" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/btn.png" x="749.12" y="138.1" width="59.36" height="35.8" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/secn.png" x="852.35" y="138.1" width="69.09" height="35.8" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/mlbn.png" x="965.35" y="138.1" width="34.69" height="35.8" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/mlb.png" x="1191.29" y="16.5" width="47.42" height="25" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/nfl.png" x="1127.13" y="42.0" width="27.74" height="38" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/nhl.png" x="1269.14" y="43.0" width="31.72" height="36" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/cfp.png" x="1111.51" y="87.0" width="24.98" height="36" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/ufc.png" x="1278.11" y="96.0" width="51.79" height="18" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/nba.png" x="1132.62" y="128.0" width="16.76" height="38" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/wwe.png" x="1269.9" y="131.5" width="34.19" height="31" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <image href="/banner/nascar.png" x="1164.03" y="166.5" width="101.93" height="17" preserveAspectRatio="xMidYMid meet" filter="url(#bdMark)"/>
    <text x="60" y="51.76" fontFamily="'Barlow Condensed', 'Barlow Condensed Fallback', Impact, sans-serif" fontWeight="700" fontSize="55" letterSpacing="2.48" fill="#000000" filter="url(#bdTitleHalo)">MYSPORTS TV</text>
    <text x="60" y="51.76" fontFamily="'Barlow Condensed', 'Barlow Condensed Fallback', Impact, sans-serif" fontWeight="700" fontSize="55" letterSpacing="2.48" fill="url(#bdGold)">MYSPORTS TV</text>
    <text x="62" y="80.0" fontFamily="'Barlow Condensed', 'Barlow Condensed Fallback', Impact, sans-serif" fontWeight="600" fontSize="15" letterSpacing="3.0" fill="#A4AAB2">EVERY GAME. EVERY CHANNEL. ONE PLACE.</text>
    </svg>
  );
}
