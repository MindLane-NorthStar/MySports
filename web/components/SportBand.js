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
import { favoriteIds, isFavorite } from '../lib/favorites.js';
import favoritesDoc from '../../data/favorites.json';
// D4: the mark table now lives in config.js - the mobile grid header needs the same one.
import { sportMarkUrl } from '../lib/config.js';

// `floatFavorites` exists for 05 section 11. The page-level YOUR TEAMS section it was written
// against was retired by prompt 51 stage 4a, so the float is D6's only mechanism now and lives at
// BAND level. WEEK MODE keeps it on: it groups by DAY, and lifting a favourite out of its day
// destroys the calendar the week exists to be.
//
// PROMPT 53 STAGE 6 ADDED THE ONE EXCEPTION: under `scope=mine` the caller passes
// `floatFavorites={false}`, because a band that contains nothing BUT favourites has nothing to
// float them away from. See Listing's note.
//
// (This said "/weeks and /history keep the float on" until prompt 53; both are redirects.)
//
// `sectionLabel` AND `headingClass` ARE GONE (R4, prompt 56). They existed so the page-level YOUR
// TEAMS heading could share `.band-headrow` with C3's per-band count line. Prompt 51 retired the
// section and prompt 50 retired the count, after which the only caller still passing `sectionLabel`
// was WEEK MODE passing a WEEKDAY - which meant every Tuesday was being marked with the retired
// page-level favourites-section class. `Listing` renders the heading at the outer level in every
// arrangement now, so nothing passes either prop and both are removed rather than left unset.
export default function SportBand({ sport, label, games, standings, rankings, showDay = false, onOpen,
                                    showHeader = true, markFavorites = true }) {
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

  /**
   * THE FLOAT IS GONE AND THE CARD CARRIES A MARK INSTEAD (prompt 82 block D2, Joe 2026-09-09).
   *
   * WHAT WAS WRONG. `app/page.js` sorts every row through `chronological(rows, favIds)` - time, then
   * a studio show, then a favourite - and this band then took that correctly ordered list and
   * SPLIT it, rendering favourites in a `.favgroup` above everything else. The page sorted and the
   * band un-sorted it. Joe's ruling is that a band reads as a timeline with a favourite winning
   * only a TIE, so the hoist is what had to go.
   *
   * `splitFavorites` WENT WITH IT - see lib/favorites.js. `isFavorite` stays, because the mark
   * needs exactly that predicate and nothing more.
   */
  const favIdSet = markFavorites ? favIds : null;

  if (!games?.length) return null;

  // The badge is a class on the row WRAPPER and the text lives in globals.css - MatchupCard is
  // locked and nothing here reaches inside it. The buckets are mutually exclusive by the if/else in
  // offServiceSummary, so at most one cue class can ever apply and no card can render both badges.
  /**
   * THE FAVOURITE IS A FOURTH WRAPPER CLASS, and it does NOT behave like the other three.
   *
   * The first three are MUTUALLY EXCLUSIVE by the if/else in `offServiceSummary`, so at most one can
   * ever apply. `fav-row` is orthogonal: an off-service game can perfectly well be one of Joe's, and
   * both cues have to show. They COMPOSE - `.offsvc-row.fav-row` gets the dim and the gold border -
   * and a test pins that, because "one silently wins" is the failure this shape invites.
   */
  const rowClass = (g) =>
    [tbdIds.has(g.id) ? 'networktbd-row' : null,
     pendingIds.has(g.id) ? 'pending-row' : null,
     offIds.has(g.id) ? 'offsvc-row' : null,
     favIdSet && isFavorite(g, favIdSet) ? 'fav-row' : null]
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

  // THE NAME COMES FROM THE CALLER, AND THERE IS DELIBERATELY NO FALLBACK (prompt 60 stage 4).
  //
  // `label || sport` was always truthy until MY TEAMS reached the flat branch under ALL SPORTS,
  // where both are null. `Listing` now passes `flatLabel` - "My teams" - so that section is named.
  //
  // A BLANKET FALLBACK WAS WRITTEN FIRST AND TAKEN BACK OUT, because the before/after snapshot
  // caught it changing ALL GAMES: on 2026-09-13 the FIRST BAND renders through this same flat path
  // with `sport={P.sport}`, which is null under ALL SPORTS - so that inner section has been
  // nameless on every ALL SPORTS day since it shipped, and the fallback would have named it.
  //
  // THAT IS NOT A DEFECT, AND THE PLATFORM WAS CHECKED RATHER THAN RECALLED (rule 34). Read out of
  // Chromium's own accessibility tree: an unnamed <section> is exposed as `generic`, and a named one
  // as `region`. So the nameless section is not a broken landmark - it is not a landmark at all,
  // which is right for a plain container. Naming it would PROMOTE it to a region nested inside
  // `.fband`, which is already a region named by its own <h2>: one landmark's worth of content
  // announced twice. MY TEAMS is the opposite case and is why `flatLabel` exists - there the flat
  // section IS the page's list, and a named region is the useful thing to have.
  //
  // THE REST OF THIS PATH WAS CHECKED FOR THE SAME ASSUMPTION rather than only the aria-label:
  // `sportMarkUrl(sport)` and the <h2> are both inside `showHeader`, which is false on every flat
  // render, so neither is reached; `offServiceSummary` and `rowClass` are both
  // per-row and sport-agnostic; and the card choice is made per row by `isProgram`, never by the
  // band's sport. The aria-label was the only one.
  return (
    <section className="band" aria-label={label || sport || undefined}>
      {/* B2: the heading and the count shared ONE row. .band-headrow carries the hairline so it
          spans the whole line rather than stopping under the title.

          THE ROW IS NOW GATED ON `showHeader` (R4, prompt 56). It used to render unconditionally,
          which was harmless only because the flat arrangement put `sectionLabel` inside it; with
          that prop gone, an ungated row would paint a bare hairline above the cards with nothing on
          it. There is one thing left that can go in this row, so the row follows it.

          THE PER-BAND COUNT LINE IS GONE (prompt 50 stage 4b). One line renders at the FOOT of the
          page instead - components/PageCount.js. This retires "every band reports its counts", the
          `4250aa9` fix carried as do-not-regress since prompt 21; Joe's instruction supersedes it
          and prompt 50 stage 6 struck the old note rather than leaving it standing. */}
      {showHeader ? (
        <div className="band-headrow">
          <header className="band-head">
            {sportMarkUrl(sport) ? <img className="band-mark" src={sportMarkUrl(sport)} alt="" /> : null}
            <h2 className="band-title">{label || sport}</h2>
          </header>
        </div>
      ) : null}

      {/* ONE LIST, IN CLOCK ORDER. The `.favgroup` bracket that stood here is retired (prompt 82
          block D2) and so is the long note explaining it - a comment describing an element that no
          longer exists is the stale-note failure this repo keeps paying for.

          WHAT IT WAS AND WHY IT WENT. Prompt 59 replaced D6's "YOUR TEAMS" micro-label with a gold
          left rule after Joe called the old treatment "like an afterthought", and that bracket was
          right for a list whose order carried no meaning. Joe's 2026-09-09 ordering ruling gives
          position meaning - time first, then a studio show, then a favourite - and a group floating
          to the top of a list sorted by the clock contradicts it. The gesture survives as a MARK on
          the card (`fav-row` above); the HOIST is what was wrong.

          The gold left rule itself is not lost: `.scopeline` still uses it to mark the MY TEAMS
          scope, which is where "this is about your teams" is still said once. */}
      <div className="cards">{(games || []).map(row)}</div>
    </section>
  );
}
