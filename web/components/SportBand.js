'use client';

// One sport's slice of a day: its mark and label, its own count line, and its rows.
//
// This is the band the feature study assumed and the app did not have - Today rendered one flat list
// of every sport sorted by kickoff. Everything that used to be computed once for the whole page is
// computed HERE instead, per band, which is what makes the numbers mean something: "18 not on your
// services" across a mixed day tells a viewer nothing, while "18 not on your services" under MLB
// tells them their baseball night is mostly out-of-market RSNs.
//
// The same component renders the FLAT case with `showHeader={false}` - today that is WEEK MODE
// with a sport selected, where the weekday is already the heading - without a second copy of the
// count line, the toggle, the favourites float and the row wrappers. One implementation, two
// arrangements. (This said "/weeks and /history" until prompt 53; both routes have been redirects
// since prompt 50 made the app one route.)
//
// It renders AROUND MatchupCard and never inside it. The card is locked (contract v1.6.4 + Mobile
// Grid Addendum v1.0): the off-service dim, the MARKET TBD cue, the favourites rule and the YOUR TEAMS
// label all live on wrappers and band-level elements.

import { useMemo } from 'react';
import MatchupCard from './MatchupCard.js';
import ProgramCard from './ProgramCard.js';
import { isProgram } from '../lib/programs.js';
import { offServiceSummary } from '../lib/offservice.js';
import { favoriteIds, splitFavorites } from '../lib/favorites.js';
import favoritesDoc from '../../data/favorites.json';
// D4: the mark table now lives in config.js - the mobile grid header needs the same one.
import { sportMarkUrl } from '../lib/config.js';

// `floatFavorites` and `sectionLabel` exist for 05 section 11. The page-level YOUR TEAMS section
// they were written against was retired by prompt 51 stage 4a, so the float is D6's only mechanism
// now and lives at BAND level. WEEK MODE keeps it on: it groups by DAY, and lifting a favourite out
// of its day destroys the calendar the week exists to be.
//
// PROMPT 53 STAGE 6 ADDED THE ONE EXCEPTION: under `scope=mine` the caller passes
// `floatFavorites={false}`, because a band that contains nothing BUT favourites has nothing to
// float them away from. See Listing's note.
//
// (This said "/weeks and /history keep the float on" until prompt 53; both are redirects.)
export default function SportBand({ sport, label, games, standings, rankings, showDay = false, onOpen,
                                    showHeader = true, floatFavorites = true, sectionLabel = null,
                                    headingClass = 'favlabel' }) {
  // THE BAND NO LONGER FILTERS AND NO LONGER COUNTS (prompt 50 stage 4). Both moved to the page:
  // one count line at the foot, and the hiding decided once by splitHidden() before these rows are
  // handed down. The band renders what it is given.
  //
  // The summary survives for ONE job - the row wrapper classes below. `offServiceSummary`'s buckets
  // are what put MARKET TBD and NETWORK TBD on the card and the dim on an off-service row, and those
  // are card states that R3's retirement of the COUNT LINE does not touch.
  const summary = useMemo(() => offServiceSummary(games), [games]);
  const offIds = useMemo(() => new Set(summary.off.map((g) => g.id)), [summary]);
  const pendingIds = useMemo(() => new Set(summary.pending.map((g) => g.id)), [summary]);
  const tbdIds = useMemo(() => new Set(summary.tbd.map((g) => g.id)), [summary]);

  const favIds = useMemo(() => favoriteIds(favoritesDoc), []);

  // D6's in-band float, retained for /weeks and /history. On `/` this is switched off and the page
  // hoists favourites into their own section instead (05 section 11), so `favorites` is empty and
  // `rest` is everything - one flat list, no marker and no trailing rule.
  const split = useMemo(() => splitFavorites(games || [], favIds), [games, favIds]);
  const favorites = floatFavorites ? split.favorites : [];
  const rest = floatFavorites ? split.rest : (games || []);

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

        {/* THE PER-BAND COUNT LINE IS GONE (prompt 50 stage 4b). One line renders at the FOOT of the
            page instead - components/PageCount.js. This retires "every band reports its counts",
            the `4250aa9` fix carried as do-not-regress since prompt 21; Joe's instruction supersedes
            it and stage 6 strikes the old note rather than leaving it standing. */}
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
