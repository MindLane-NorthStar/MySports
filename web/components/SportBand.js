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
import { offServiceSummary } from '../lib/offservice.js';
import { favoriteIds, splitFavorites } from '../lib/favorites.js';
import favoritesDoc from '../../data/favorites.json';

// College football has no mark of its own in web/public/leagues; the banner uses the CFP mark for the
// college slot, so the band follows the banner rather than inventing a second convention.
const MARK = { cfb: 'cfp', nfl: 'nfl', nba: 'nba', nhl: 'nhl', mlb: 'mlb' };

export default function SportBand({ sport, label, games, standings, showDay = false, onOpen, showHeader = true }) {
  const [showAll, setShowAll] = useState(false);

  const summary = useMemo(() => offServiceSummary(games), [games]);
  const offIds = useMemo(() => new Set(summary.off.map((g) => g.id)), [summary]);
  const pendingIds = useMemo(() => new Set(summary.pending.map((g) => g.id)), [summary]);

  // E5: only genuinely ineligible games are hidden. Market-pending games are exempt in BOTH toggle
  // states, and the visible set is the original array minus `off`, so everything keeps its
  // chronological position rather than being regrouped.
  const shown = useMemo(
    () => (showAll ? games : (games || []).filter((g) => !offIds.has(g.id))),
    [showAll, games, offIds],
  );

  // D6, now PER BAND rather than across the whole page: a favourite floats to the top of its own
  // sport, not above another sport's games.
  const favIds = useMemo(() => favoriteIds(favoritesDoc), []);
  const { favorites, rest } = useMemo(() => splitFavorites(shown, favIds), [shown, favIds]);

  if (!games?.length) return null;

  const rowClass = (g) =>
    [pendingIds.has(g.id) ? 'pending-row' : null, offIds.has(g.id) ? 'offsvc-row' : null]
      .filter(Boolean).join(' ') || undefined;

  const row = (g) => (
    <div key={g.id} className={rowClass(g)} data-market-tbd={pendingIds.has(g.id) || undefined}>
      <MatchupCard game={g} standings={standings} showDay={showDay} onOpen={onOpen} />
    </div>
  );

  return (
    <section className="band" aria-label={label || sport}>
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
          <span className="offsvc-total">{summary.lines.total}</span>
          {summary.lines.on ? <span>{summary.lines.on}</span> : null}
          {summary.lines.pending ? <span className="offsvc-pending">{summary.lines.pending}</span> : null}
          {summary.lines.off ? <span>{summary.lines.off}</span> : null}
          {summary.offCount ? (
            <button type="button" className="offsvc-toggle" onClick={() => setShowAll((v) => !v)}
                    aria-expanded={showAll}>
              {showAll ? 'Hide them' : 'Show all'}
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
