// The home-page banner: banner v2, one finished SVG per breakpoint.
//
// Server component on purpose. Both components are plain functions with no props, no state and no
// imports of their own - every coordinate is baked into the JSX, generated from
// web/lib/banner-mobile-v2.json and web/lib/banner-desktop-v2.json. Those JSON files ship as
// DOCUMENTATION of the same values; nothing reads them at build time. If the design moves, the JSON
// changes and the component is regenerated from it - coordinates are never hand-edited here.
//
// WHY BOTH ARE MOUNTED AT ONCE. CSS chooses which one paints (`.bn-pc`/`.bn-mobile`, swapped at
// 700px); both stay in the DOM. SVG ids are document-global, so a shared id could let the hidden
// copy win the lookup - and Chromium renders NOTHING, not an unfiltered shape, when a filter id
// resolves into a display:none subtree. The two components therefore namespace every id: 'bn' on the
// phone, 'bd' on the desktop.
//
// NEITHER SVG CARRIES A CSS HEIGHT. Each is width="100%" over its own viewBox, so the height is
// width x 155/428 on the phone and width x 200/1400 on the desktop, and no stylesheet has to know a
// number. The desktop sits in a centered max-width:1600px block (.bd-wrap), which caps the banner at
// 229px on wide monitors; past 1600 the wings are .banner's own gradient, which is the stage's.

import BannerMobileV2 from './BannerMobileV2.jsx';
import BannerDesktopV2 from './BannerDesktopV2.jsx';
import BannerTap from './BannerTap.js';

export default function Banner() {
  return (
    <header className="banner">
      <div className="bn-pc">
        <div className="bd-wrap">
          <BannerDesktopV2 />
          {/* PROMPT 60: the TV collapses the header. A CLIENT component inside a SERVER one, which
              is the whole reason this file stays a server component - the artwork is still rendered
              on the server and only the 55x59 button hydrates. It is positioned against `.bd-wrap`
              rather than `.bn-pc`, because `.bd-wrap` is the box the desktop SVG actually fills
              (max-width 1600px); anchoring to `.bn-pc` would drift the button right of the TV on
              anything wider than that. */}
          <BannerTap variant="desktop" />
        </div>
      </div>
      <div className="bn-mobile">
        <BannerMobileV2 />
        <BannerTap variant="mobile" />
      </div>
    </header>
  );
}
