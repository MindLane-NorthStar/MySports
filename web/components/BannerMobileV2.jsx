// MySports TV — home banner v2, PHONE breakpoint. GENERATED from banner-mobile-v2.json by
// scripts/build_banner_mobile.py. Do not hand-edit: edit the JSON and regenerate.
// Stage 428x135, scales to the container width. Assets live in web/public/banner/.
//
// PROMPT 45 - THE ARTWORK PAINTS THE SAFE-AREA BAND. Installed on iOS the web view runs under the
// status bar and .banner pads itself by env(safe-area-inset-top). That band used to be .banner's
// flat CSS gradient while the stage below it started with its own ground AND its two warm glows -
// a step of 8.7/255 under the wordmark and 10.7/255 under the TV, which is the seam Joe reported on
// 2026-09-04. The fix is overflow:visible plus a ground rect that starts above the stage, so the
// stage's own paint fills the band and there is no boundary to see.
//
// WHICH IS WHY THE THREE GRADIENTS ARE userSpaceOnUse. They were objectBoundingBox (the default),
// which defines a gradient on the unit square of the shape it fills - so growing the ground rect
// would have stretched its gradient with it and moved every pixel of the visible stage. Pinned to
// stage coordinates instead, the rect can grow and the paint cannot move. The conversion arithmetic
// is artifacts/qa/2026-09-05-banner-seam/gradient-convert.py.
//
// THE GLOWS' OUTER STOPS NOW RE-TAPER TO ZERO, and this paragraph used to say the opposite.
// Prompt 45 kept the hard tails (0.021 / 0.028) because zeroing them outright repaints the whole
// annulus between the 82% and 100% rings - measured then at 10.6% of the visible stage by up to
// 6/255, a bigger change to the artwork than the artifact was worth. Joe saw the artifact anyway
// and overrode that in conversation on 2026-09-09: the edge reads as a faint rounded outline
// around the television, which is not a thing the design has.
//
// WHAT SHIPPED IS NEITHER OPTION. A stop at 95% sitting exactly ON the current 82->100 line, then
// zero at 100%, so only the last 5% of each radius moves and every existing stop is untouched.
// Measured at the mobile breakpoint over the stage ground: the edge removed is a step of 3.0/255
// (outer) and 4.1/255 (inner); the re-taper changes 3.16% of the visible stage by at most
// 3.53/255. Zeroing outright would have changed 11.38%, which reproduces prompt 45's 10.6% and is
// why the re-taper was chosen over it.
//
export default function BannerMobileV2() {
  return (
    <svg viewBox="0 0 428 135" width="100%" role="img" aria-labelledby="bnTitle" overflow="visible" style={{ display: "block" }}>
    <title id="bnTitle">MySports TV. Every game. Every channel. One place.</title>
    <defs>
    <linearGradient id="bnBg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="135"><stop offset="0" stopColor="#272727"/><stop offset=".45" stopColor="#232323"/><stop offset="1" stopColor="#1A1A1A"/></linearGradient>
    <radialGradient id="bnGlow0" gradientUnits="userSpaceOnUse" cx="346" cy="75" r="138" gradientTransform="translate(346,75) scale(1,0.73913043478260869565) translate(-346,-75)"><stop offset="0%" stopColor="rgb(255,170,60)" stopOpacity="0.32"/><stop offset="45.3%" stopColor="rgb(255,170,60)" stopOpacity="0.176"/><stop offset="82%" stopColor="rgb(255,170,60)" stopOpacity="0.058"/><stop offset="95%" stopColor="rgb(255,170,60)" stopOpacity="0.0313"/><stop offset="100%" stopColor="rgb(255,170,60)" stopOpacity="0"/></radialGradient>
    <radialGradient id="bnGlow1" gradientUnits="userSpaceOnUse" cx="334" cy="77" r="66" gradientTransform="translate(334,77) scale(1,0.84848484848484848485) translate(-334,-77)"><stop offset="0%" stopColor="rgb(255,170,60)" stopOpacity="0.42"/><stop offset="45.3%" stopColor="rgb(255,170,60)" stopOpacity="0.231"/><stop offset="82%" stopColor="rgb(255,170,60)" stopOpacity="0.076"/><stop offset="95%" stopColor="rgb(255,170,60)" stopOpacity="0.0413"/><stop offset="100%" stopColor="rgb(255,170,60)" stopOpacity="0"/></radialGradient>
    <linearGradient id="bnGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E0D1A5"/><stop offset=".42" stopColor="#C6AF7A"/><stop offset=".7" stopColor="#B39A69"/><stop offset="1" stopColor="#8C7650"/></linearGradient>
    <filter id="bnTitleHalo" x="-25%" y="-140%" width="150%" height="380%" colorInterpolationFilters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="7.9" result="w"/><feComponentTransfer in="w" result="wide"><feFuncA type="linear" slope="1.9"/></feComponentTransfer><feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="t"/><feComponentTransfer in="t" result="tight"><feFuncA type="linear" slope="2.7"/></feComponentTransfer><feMerge><feMergeNode in="wide"/><feMergeNode in="tight"/></feMerge></filter>
    <filter id="bnMark" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#ffffff" floodOpacity=".22" result="halo"/><feDropShadow in="halo" dx="0" dy="2" stdDeviation="1.2" floodColor="#000000" floodOpacity=".55"/></filter>
    <filter id="bnTv" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#000000" floodOpacity=".65" result="s"/><feDropShadow in="s" dx="0" dy="0" stdDeviation="6" floodColor="rgb(255,150,40)" floodOpacity=".28"/></filter>
    <linearGradient id="bnSheenGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0"/><stop offset=".5" stopColor="#FFFFFF" stopOpacity=".5"/><stop offset="1" stopColor="#FFFFFF" stopOpacity="0"/></linearGradient>
    </defs>
    <rect x="0" y="-90" width="428" height="225" fill="url(#bnBg)"/>
    <ellipse cx="346" cy="75" rx="138" ry="102" fill="url(#bnGlow0)"/>
    <ellipse cx="334" cy="77" rx="66" ry="56" fill="url(#bnGlow1)"/>
    <image href="/banner/tv-cutout-dark.png" x="306.04" y="43.1" width="55.93" height="58.8" preserveAspectRatio="xMidYMid meet" filter="url(#bnTv)"/>
    <image href="/banner/nbc.png" x="15.99" y="52" width="19.23" height="19" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/fox.png" x="49.95" y="55.7" width="27.11" height="11.5" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/espn.png" x="91.86" y="55.7" width="46.28" height="11.5" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/cbs.png" x="152.9" y="55.7" width="41.4" height="11.5" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/abc-gray.png" x="209.0" y="52" width="19.0" height="19" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/paramount.png" x="16.01" y="81.5" width="52.18" height="12" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/dazn.png" x="79.2" y="78" width="19.0" height="19" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/prime.png" x="109.28" y="80" width="46.83" height="15" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/appletv.png" x="167.19" y="80.5" width="26.81" height="14" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/guardstv.png" x="205.0" y="75.5" width="22.99" height="24" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/tnt.png" x="16.0" y="104" width="19.0" height="19" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/netflix.png" x="50.89" y="107.7" width="42.83" height="11.5" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/peacock.png" x="109.5" y="107.7" width="37.2" height="11.5" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/usa.png" x="162.54" y="107.5" width="27.31" height="12" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/tbs.png" x="205.77" y="107.5" width="22.26" height="12" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/mlb.png" x="316.93" y="14" width="34.15" height="18" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/nfl.png" x="267.78" y="24" width="20.44" height="28" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/nhl.png" x="374.55" y="25" width="22.91" height="26" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/cfp.png" x="254.98" y="60" width="18.04" height="26" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/ufc.png" x="379.3" y="66.5" width="37.4" height="13" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/nba.png" x="271.83" y="93" width="12.35" height="28" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/wwe.png" x="378.87" y="96" width="24.27" height="22" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/nascar.png" x="298.02" y="119" width="71.95" height="12" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <text x="14" y="29.88" fontFamily="'Barlow Condensed', 'Barlow Condensed Fallback', Impact, sans-serif" fontWeight="700" fontSize="36" letterSpacing="1.62" fill="#000000" filter="url(#bnTitleHalo)">MYSPORTS TV</text>
    <text x="14" y="29.88" fontFamily="'Barlow Condensed', 'Barlow Condensed Fallback', Impact, sans-serif" fontWeight="700" fontSize="36" letterSpacing="1.62" fill="url(#bnGold)">MYSPORTS TV</text>
    <mask id="bnSheenMask"><text x="14" y="29.88" fontFamily="'Barlow Condensed', 'Barlow Condensed Fallback', Impact, sans-serif" fontWeight="700" fontSize="36" letterSpacing="1.62" fill="#fff">MYSPORTS TV</text></mask>
    <g mask="url(#bnSheenMask)"><rect className="bn-sheen" x="-140" y="-8" width="130" height="46" fill="url(#bnSheenGrad)"/></g>
    <text x="16" y="46" fontFamily="'Barlow Condensed', 'Barlow Condensed Fallback', Impact, sans-serif" fontWeight="600" fontSize="10" letterSpacing="1.7" fill="#A4AAB2">EVERY GAME. EVERY CHANNEL. ONE PLACE.</text>
    </svg>
  );
}
