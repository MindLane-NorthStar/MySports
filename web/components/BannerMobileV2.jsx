// MySports TV — home banner v2, PHONE breakpoint. GENERATED from banner-mobile-v2.json by
// scripts/build_banner_mobile.py. Do not hand-edit: edit the JSON and regenerate.
// Stage 428x155, scales to the container width. Assets live in web/public/banner/.
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
// THE GLOWS' OUTER STOPS ARE LEFT AS DESIGNED (0.021 / 0.028, not 0). They make the ellipse
// boundary a faint hard edge, which overflow:visible exposes in the band as a 3.4/255 line above
// the stage. Fading them to zero removes it, and was measured: it also repaints the annulus between
// the 82% and 100% rings, changing 10.6% of the visible stage by up to 6/255. That is a far bigger
// change to the artwork than the artifact is worth, so the tails stay.
//
export default function BannerMobileV2() {
  return (
    <svg viewBox="0 0 428 155" width="100%" role="img" aria-labelledby="bnTitle" overflow="visible" style={{ display: "block" }}>
    <title id="bnTitle">MySports TV. Every game. Every channel. One place.</title>
    <defs>
    <linearGradient id="bnBg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="155"><stop offset="0" stopColor="#272727"/><stop offset=".45" stopColor="#232323"/><stop offset="1" stopColor="#1A1A1A"/></linearGradient>
    <radialGradient id="bnGlow0" gradientUnits="userSpaceOnUse" cx="346" cy="82" r="138" gradientTransform="translate(346,82) scale(1,0.73913043478260869565) translate(-346,-82)"><stop offset="0%" stopColor="rgb(255,170,60)" stopOpacity="0.32"/><stop offset="45.3%" stopColor="rgb(255,170,60)" stopOpacity="0.176"/><stop offset="82%" stopColor="rgb(255,170,60)" stopOpacity="0.058"/><stop offset="100%" stopColor="rgb(255,170,60)" stopOpacity="0.021"/></radialGradient>
    <radialGradient id="bnGlow1" gradientUnits="userSpaceOnUse" cx="334" cy="84" r="66" gradientTransform="translate(334,84) scale(1,0.84848484848484848485) translate(-334,-84)"><stop offset="0%" stopColor="rgb(255,170,60)" stopOpacity="0.42"/><stop offset="45.3%" stopColor="rgb(255,170,60)" stopOpacity="0.231"/><stop offset="82%" stopColor="rgb(255,170,60)" stopOpacity="0.076"/><stop offset="100%" stopColor="rgb(255,170,60)" stopOpacity="0.028"/></radialGradient>
    <linearGradient id="bnGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E0D1A5"/><stop offset=".42" stopColor="#C6AF7A"/><stop offset=".7" stopColor="#B39A69"/><stop offset="1" stopColor="#8C7650"/></linearGradient>
    <filter id="bnTitleGlow" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="bnMark" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#ffffff" floodOpacity=".22" result="halo"/><feDropShadow in="halo" dx="0" dy="2" stdDeviation="1.2" floodColor="#000000" floodOpacity=".55"/></filter>
    <filter id="bnTv" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#000000" floodOpacity=".65" result="s"/><feDropShadow in="s" dx="0" dy="0" stdDeviation="6" floodColor="rgb(255,150,40)" floodOpacity=".28"/></filter>
    </defs>
    <rect x="0" y="-90" width="428" height="245" fill="url(#bnBg)"/>
    <ellipse cx="346" cy="82" rx="138" ry="102" fill="url(#bnGlow0)"/>
    <ellipse cx="334" cy="84" rx="66" ry="56" fill="url(#bnGlow1)"/>
    <image href="/banner/tv-cutout.png" x="294.05" y="36.0" width="79.9" height="84" preserveAspectRatio="xMidYMid meet" filter="url(#bnTv)"/>
    <image href="/banner/nbc.png" x="15.99" y="65.5" width="19.23" height="19" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/fox.png" x="49.95" y="69.25" width="27.11" height="11.5" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/espn.png" x="91.86" y="69.25" width="46.28" height="11.5" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/cbs.png" x="152.9" y="69.25" width="41.4" height="11.5" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/abc-gray.png" x="209.0" y="65.5" width="19.0" height="19" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/paramount.png" x="16.01" y="95.0" width="52.18" height="12" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/dazn.png" x="79.2" y="91.5" width="19.0" height="19" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/prime.png" x="109.28" y="93.5" width="46.83" height="15" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/appletv.png" x="167.19" y="94.0" width="26.81" height="14" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/guardstv.png" x="205.0" y="89.0" width="22.99" height="24" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/tnt.png" x="16.0" y="117.5" width="19.0" height="19" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/netflix.png" x="50.89" y="121.25" width="42.83" height="11.5" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/peacock.png" x="109.5" y="121.25" width="37.2" height="11.5" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/usa.png" x="162.54" y="121.0" width="27.31" height="12" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/tbs.png" x="205.77" y="121.0" width="22.26" height="12" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/mlb.png" x="316.93" y="11.0" width="34.15" height="18" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/nfl.png" x="267.78" y="31.0" width="20.44" height="28" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/nhl.png" x="374.55" y="32.0" width="22.91" height="26" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/cfp.png" x="254.98" y="67.0" width="18.04" height="26" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/ufc.png" x="379.3" y="73.5" width="37.4" height="13" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/nba.png" x="271.83" y="100.0" width="12.35" height="28" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/wwe.png" x="378.87" y="103.0" width="24.27" height="22" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <image href="/banner/nascar.png" x="298.02" y="129.0" width="71.95" height="12" preserveAspectRatio="xMidYMid meet" filter="url(#bnMark)"/>
    <text x="14" y="36.88" fontFamily="'Barlow Condensed', 'Barlow Condensed Fallback', Impact, sans-serif" fontWeight="700" fontSize="36" letterSpacing="1.62" fill="#C6AF7A" opacity=".55" filter="url(#bnTitleGlow)">MYSPORTS TV</text>
    <text x="14" y="36.88" fontFamily="'Barlow Condensed', 'Barlow Condensed Fallback', Impact, sans-serif" fontWeight="700" fontSize="36" letterSpacing="1.62" fill="url(#bnGold)">MYSPORTS TV</text>
    <text x="16" y="53.0" fontFamily="'Barlow Condensed', 'Barlow Condensed Fallback', Impact, sans-serif" fontWeight="600" fontSize="10" letterSpacing="1.7" fill="#A4AAB2">EVERY GAME. EVERY CHANNEL. ONE PLACE.</text>
    </svg>
  );
}
