'use client';

// One sport's slice of a day: its mark and label, its own count line, and its rows.
//
// This is the band the feature study assumed and the app did not have - Today rendered one flat list
// of every sport sorted by kickoff. Everything that used to be computed once for the whole page is
// computed HERE instead, per band, which is what makes the numbers mean something: "18 not on your
// services" across a mixed day tells a viewer nothing, while "18 not on your services" under MLB
// tells them their baseball night is mostly out-of-market RSNs.
//
// The same component renders the FLAT case with `showHeader={false}`, so /weeks and /history keep
// their current structure without a second copy of the count line, the toggle, the favourites float
// and the row wrappers. One implementation, two arrangements.
//
// It renders AROUND MatchupCard and never inside it. The card is locked (contract v1.6.4 + Mobile
// Grid Addendum v1.0): the off-service dim, the MARKET TBD cue, the favourites rule and the YOUR TEAMS
// label all live on wrappers and band-level elements.

import { useMemo, useState } from 'react';
import MatchupCard from './MatchupCard.js';
import ProgramCard from './ProgramCard.js';
import { isProgram } from '../lib/programs.js';
import { offServiceSummary, countParts } from '../lib/offservice.js';
import { favoriteIds, isFavorite, splitFavorites } from '../lib/favorites.js';
import favoritesDoc from '../../data/favorites.json';
// D4: the mark table now lives in config.js - the mobile grid header needs the same one.
import { sportMarkUrl } from '../lib/config.js';

// `floatFavorites` and `sectionLabel` exist for 05 section 11. On the Today page the favourites
// are hoisted to a PAGE-LEVEL section, so the in-band float is switched off there and the section
// carries the marker instead. /weeks and /history keep the float on - section 11 is scoped to `/`,
// because those two group by DAY and lifting a favourite out of its day destroys the calendar they
// exist to be. Defaults preserve their behaviour exactly.
export default function SportBand({ sport, label, games, standings, rankings, showDay = false, onOpen,
                                    showHeader = true, floatFavorites = true, sectionLabel = null,
                                    headingClass = 'favlabel' }) {
  const [showAll, setShowAll] = useState(false);

  const summary = useMemo(() => offServiceSummary(games), [games]);
  const offIds = useMemo(() => new Set(summary.off.map((g) => g.id)), [summary]);
  const pendingIds = useMemo(() => new Set(summary.pending.map((g) => g.id)), [summary]);
  const tbdIds = useMemo(() => new Set(summary.tbd.map((g) => g.id)), [summary]);

  const favIds = useMemo(() => favoriteIds(favoritesDoc), []);

  // How many games the toggle would actually REVEAL. Since A1 a favourite is never hidden, so a
  // section made entirely of favourites can report "1 unavailable" and have nothing to show - the
  // YOUR TEAMS section does exactly that. The count still says unavailable, because they are; it
  // just is not a control when pressing it would do nothing.
  const hiddenCount = useMemo(
    () => summary.off.filter((g) => !isFavorite(g, favIds)).length,
    [summary, favIds],
  );

  // E5 + 05 section 9: only genuinely ineligible games are hidden. Market-pending AND network-TBD
  // games are exempt in BOTH toggle states, and the visible set is the original array minus `off`,
  // so everything keeps its chronological position rather than being regrouped. Both carve-outs are
  // free here: neither state is ever IN `off`, so subtracting `off` exempts them by construction.

  // A FAVOURITED TEAM'S GAME IS NEVER HIDDEN, in either toggle state. Market-pending and network-TBD
  // are already exempt by construction; favourites join them by name.
  //
  // Without this the game vanished from the page entirely, and the page said so without showing it.
  // On `/` the favourites are hoisted to a page-level section from the UNFILTERED day (Listing.js),
  // which is correct - but this section then applied D4's filter to the very games it was handed for
  // being favourites, and they were already gone from their sport's band. Measured on 2026-09-12:
  // YOUR TEAMS read "5 airing · 1 unavailable" and rendered five rows, and Fresno State - a favourite
  // - appeared nowhere on the page.
  const shown = useMemo(
    () => (showAll ? games : (games || []).filter((g) => !offIds.has(g.id) || isFavorite(g, favIds))),
    [showAll, games, offIds, favIds],
  );

  // D6's in-band float, retained for /weeks and /history. On `/` this is switched off and the page
  // hoists favourites into their own section instead (05 section 11), so `favorites` is empty and
  // `rest` is everything - one flat list, no marker and no trailing rule.
  const split = useMemo(() => splitFavorites(shown, favIds), [shown, favIds]);
  const favorites = floatFavorites ? split.favorites : [];
  const rest = floatFavorites ? split.rest : shown;

  if (!games?.length) return null;

  // The badge is a class on the row WRAPPER and the text lives in globals.css - MatchupCard is
  // locked and nothing here reaches inside it. The buckets are mutually exclusive by the if/else in
  // offServiceSummary, so at most one cue class can ever apply and no card can render both badges.
  const rowClass = (g) =>
    [tbdIds.has(g.id) ? 'networktbd-row' : null,
     pendingIds.has(g.id) ? 'pending-row' : null,
     offIds.has(g.id) ? 'offsvc-row' : null]
      .filter(Boolean).join(' ') || undefined;

  // v1.7: the WRAPPER is identical for both card types - the off-service dim, the MARKET TBD cue and
  // the NETWORK TBD cue are band-level classes and apply to a race exactly as they apply to a game,
  // because both read the same eligibility verdict through the same helper. Only the card inside
  // differs, and MatchupCard is not touched to make that true.
  const row = (g) => (
    <div key={g.id} className={rowClass(g)} data-market-tbd={pendingIds.has(g.id) || undefined}
         data-network-tbd={tbdIds.has(g.id) || undefined}>
      {isProgram(g) ? (
        <ProgramCard program={g} showDay={showDay} onOpen={onOpen} />
      ) : (
        <MatchupCard game={g} standings={standings} rankings={rankings} showDay={showDay} onOpen={onOpen} />
      )}
    </div>
  );

  return (
    <section className={sectionLabel ? 'band yourteams' : 'band'} aria-label={label || sport}>
      {/* The section marker, at SECTION level and never on the card - the card contract is locked
          and nothing here reaches inside it. Same .favlabel the in-band float uses, so the two
          arrangements read identically and Joe's open ruling on its prominence still applies to one
          rule rather than two. */}
      {/* B2: the heading and the count share ONE row. .band-headrow carries the hairline so it spans
          the whole line rather than stopping under the title, and wraps the count below at narrow
          widths instead of squeezing a 1.5x heading. */}
      <div className="band-headrow">
        {sectionLabel ? <p className={headingClass}>{sectionLabel}</p> : null}
        {showHeader ? (
          <header className="band-head">
            {sportMarkUrl(sport) ? <img className="band-mark" src={sportMarkUrl(sport)} alt="" /> : null}
            <h2 className="band-title">{label || sport}</h2>
          </header>
        ) : null}

        {/* B3: ONE count, and the unavailable part IS the control - there is no second
            "Show N unavailable" saying the same number again. Still a real <button> with
            aria-expanded, because it is a disclosure, whatever it looks like. */}
        {games.length ? (
          <div className="offsvc">
            <span className="offsvc-line">
              {countParts(summary.lines).map((part, i) => (
                <span key={part.key}>
                  {i > 0 ? <span className="offsvc-sep">·</span> : null}
                  {part.key === 'unavailable' && hiddenCount ? (
                    <button type="button" className="offsvc-toggle" aria-expanded={showAll}
                            onClick={() => setShowAll((v) => !v)}>
                      {part.text}
                    </button>
                  ) : (
                    part.text
                  )}
                </span>
              ))}
            </span>
          </div>
        ) : null}
      </div>

      {favorites.length ? (
        <>
          {/* Band level, never the card. */}
          <p className="favlabel">Your teams</p>
          <div className="cards">{favorites.map(row)}</div>
          <hr className="favrule" />
        </>
      ) : null}

      <div className="cards">{rest.map(row)}</div>
    </section>
  );
}
