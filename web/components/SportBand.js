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
import { offServiceSummary, countSummary } from '../lib/offservice.js';
import { favoriteIds, isFavorite, splitFavorites } from '../lib/favorites.js';
import favoritesDoc from '../../data/favorites.json';

// College football has no mark of its own in web/public/leagues; the banner uses the CFP mark for the
// college slot, so the band follows the banner rather than inventing a second convention.
const MARK = { cfb: 'cfp', nfl: 'nfl', nba: 'nba', nhl: 'nhl', mlb: 'mlb' };

// `floatFavorites` and `sectionLabel` exist for 05 section 11. On the Today page the favourites
// are hoisted to a PAGE-LEVEL section, so the in-band float is switched off there and the section
// carries the marker instead. /weeks and /history keep the float on - section 11 is scoped to `/`,
// because those two group by DAY and lifting a favourite out of its day destroys the calendar they
// exist to be. Defaults preserve their behaviour exactly.
export default function SportBand({ sport, label, games, standings, showDay = false, onOpen,
                                    showHeader = true, floatFavorites = true, sectionLabel = null }) {
  const [showAll, setShowAll] = useState(false);

  const summary = useMemo(() => offServiceSummary(games), [games]);
  const offIds = useMemo(() => new Set(summary.off.map((g) => g.id)), [summary]);
  const pendingIds = useMemo(() => new Set(summary.pending.map((g) => g.id)), [summary]);
  const tbdIds = useMemo(() => new Set(summary.tbd.map((g) => g.id)), [summary]);

  // E5 + 05 section 9: only genuinely ineligible games are hidden. Market-pending AND network-TBD
  // games are exempt in BOTH toggle states, and the visible set is the original array minus `off`,
  // so everything keeps its chronological position rather than being regrouped. Both carve-outs are
  // free here: neither state is ever IN `off`, so subtracting `off` exempts them by construction.
  const favIds = useMemo(() => favoriteIds(favoritesDoc), []);

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

  const row = (g) => (
    <div key={g.id} className={rowClass(g)} data-market-tbd={pendingIds.has(g.id) || undefined}
         data-network-tbd={tbdIds.has(g.id) || undefined}>
      <MatchupCard game={g} standings={standings} showDay={showDay} onOpen={onOpen} />
    </div>
  );

  return (
    <section className={sectionLabel ? 'band yourteams' : 'band'} aria-label={label || sport}>
      {/* The section marker, at SECTION level and never on the card - the card contract is locked
          and nothing here reaches inside it. Same .favlabel the in-band float uses, so the two
          arrangements read identically and Joe's open ruling on its prominence still applies to one
          rule rather than two. */}
      {sectionLabel ? <p className="favlabel">{sectionLabel}</p> : null}
      {showHeader ? (
        <header className="band-head">
          {MARK[sport] ? <img className="band-mark" src={`/leagues/${MARK[sport]}_dark.png`} alt="" /> : null}
          <h2 className="band-title">{label || sport}</h2>
        </header>
      ) : null}

      {/* The count block renders for EVERY band, not only ones with something hidden. A band that
          reports nothing beside one reporting four lines reads as missing data rather than as
          "everything here is available" - seen in the 2026-09-03 QA shot, where College Football
          showed its header and jumped straight to cards while MLB below it listed four lines. */}
      {games.length ? (
        <div className="offsvc">
          {/* ONE line, not four. The outlet lists are gone - they were the verbose part, and every
              revealed row already names its own network. Each COUNT stays, because D4 and E5 both
              turn on counts this line carries. */}
          <span className="offsvc-line">{countSummary(summary.lines)}</span>
          {summary.offCount ? (
            <button type="button" className="offsvc-toggle" onClick={() => setShowAll((v) => !v)}
                    aria-expanded={showAll}>
              {/* The toggle only renders when offCount is non-zero, and after prompt 24 it reveals
                  ONLY genuinely off-service games - market-pending and network-TBD are never hidden.
                  So the number is exact and the label can carry it, in the count line's own words. */}
              {showAll ? 'Hide them' : `Show ${summary.offCount} unavailable`}
            </button>
          ) : null}
        </div>
      ) : null}

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
