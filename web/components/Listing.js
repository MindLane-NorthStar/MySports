'use client';

// Client shell for a page's games: the listings cards, the mobile grid, and the one detail panel they
// share. The pages themselves stay Server Components - they fetch, this renders and handles taps.
//
// M11's near-live refresh lives here too: while any game on the page is inside its window, the route
// is revalidated every REFRESH_SECONDS. A page with nothing in flight does not poll at all.

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SportBand from './SportBand.js';
import MobileGrid from './MobileGrid.js';
import GameDetail from './GameDetail.js';
import { indexStandings, indexRankings } from '../lib/standings.js';
import { REFRESH_SECONDS, SPORTS, SPORT_LABEL } from '../lib/config.js';
import { offServiceSummary } from '../lib/offservice.js';

function anyInFlight(games) {
  const now = Date.now();
  return (games || []).some((g) => {
    if (g.result_status === 'in_progress') return true;
    if (g.result_status === 'final' || !g.canonical_kickoff_at_utc) return false;
    const t = new Date(g.canonical_kickoff_at_utc).getTime();
    return Number.isFinite(t) && now >= t - 15 * 60_000 && now <= t + 4 * 60 * 60_000;
  });
}

/**
 * `floatFavorites` - WHY MY TEAMS TURNS IT OFF (prompt 53 stage 6).
 *
 * The float tests `isFavorite` (does this row carry one of Joe's thirteen clubs?) while the SCOPE
 * tests `isMine` (does this row belong in MY TEAMS at all?). They are deliberately different
 * questions - a race has no team to be one of - and under `scope=mine` that difference surfaces as
 * a tautology:
 *
 *   an NFL or CFB band contains ONLY favourites, so EVERY row floats under a "Your teams" label
 *   with a trailing hairline separating a list from nothing;
 *   a NASCAR band is in scope via TEAMLESS_SPORTS but fails `isFavorite`, so nothing floats and no
 *   label renders at all.
 *
 * Measured on 2026-09-05 under MY TEAMS: College Football (4 rows) and MLB (1) both fully labelled,
 * NASCAR, UFC and AEW unlabelled - one page, some bands entirely labelled and others entirely not,
 * for a reason invisible to the reader. Under MY TEAMS the PAGE is the label, so the band-level one
 * is noise. Under ALL GAMES it is exactly the marker it was built to be and is unchanged.
 */
export default function Listing({ games, standingsRows, rankingsRows, day, sport, generatedAt,
                                  showDay = false, grid = false, bands = false, heading = null,
                                  headingClass = 'favlabel', nowMinute = null, gridOnly = false,
                                  floatFavorites = true }) {
  const [open, setOpen] = useState(null);

  /**
   * Close the detail panel AND drop the focus the tap left on the card.
   *
   * `.mcard` is a <button>, so tapping one focuses it; when the panel closes, focus returns there and
   * `button.mcard:focus-visible` paints its 2px gold outline. Joe read that ring as a state on the
   * card - a favourite flag, an on-now marker - which is exactly what it looks like when it appears
   * after a tap and stays. Blurring on close clears it.
   *
   * The rule itself is untouched: a keyboard user tabbing onto a card still gets the ring, because
   * :focus-visible fires on that path and nothing blurs it. Only the tap-then-close path is cleared,
   * and only when the focused element is actually the card.
   */
  const closePanel = useCallback(() => {
    const el = typeof document !== 'undefined' ? document.activeElement : null;
    if (el && el instanceof HTMLElement && el.classList.contains('mcard')) el.blur();
    setOpen(null);
  }, []);
  const router = useRouter();
  const standings = useMemo(() => indexStandings(standingsRows), [standingsRows]);
  // C3: college football's line 2 is a POLL rank, so the card needs the polls as well as the table.
  // Empty for every page with no CFB game on it, which is most of them.
  const rankings = useMemo(() => indexRankings(rankingsRows), [rankingsRows]);

  useEffect(() => {
    if (!anyInFlight(games)) return undefined;
    const id = setInterval(() => router.refresh(), REFRESH_SECONDS * 1000);
    return () => clearInterval(id);
  }, [games, router]);

  // THE PAGE-LEVEL YOUR TEAMS SECTION IS RETIRED (prompt 51 stage 4a, R4).
  //
  // 05 §11 lifted favourites OUT of their sport bands into one page-level section. R4 replaces that
  // with the MY TEAMS SCOPE - the toggle in the control stack - and D6's original arrangement comes
  // back in its place: favourites float to the top of THEIR OWN sport band, marked by a hairline and
  // a faint uppercase micro-label at BAND level.
  //
  // Until this stage both mechanisms were on screen at once: prompt 50 built the scope and recorded
  // the section's retirement in its docs stage, but assigned the work to no build stage. This is the
  // build catching up to the record.
  //
  // THE CARD IS UNTOUCHED, which is the one thing that survived D6 unchanged: the marker lives at
  // band level and never on the card, so the locked card contract stays closed.
  //
  // Bands render in SPORTS order - `config.js` SPORTS, which is nfl, cfb, mlb, nba, nhl, nascar,
  // indycar, ufc, wwe - not in kickoff order. The order is the
  // product's, so a quiet sport does not jump the page because it happened to start first. They are
  // built from ALL the games now rather than from a `rest` remainder, because nothing is hoisted out
  // of them any more.
  const grouped = useMemo(() => {
    if (!bands) return null;
    const by = new Map();
    for (const g of games || []) {
      if (!by.has(g.sport)) by.set(g.sport, []);
      by.get(g.sport).push(g);
    }
    const known = SPORTS.filter((s) => by.has(s));
    const extra = [...by.keys()].filter((s) => !SPORTS.includes(s)).sort();
    return [...known, ...extra].map((s) => [s, by.get(s)]);
  }, [bands, games]);

  // D3: the grid no longer requires a single selected sport. It was gated on `sport` because block
  // length is per-sport policy and one grid could only use one number; MobileGrid now takes that
  // per game, so ALL renders every sport on one timeline, in rail order, exactly as one sport does.
  // Still ONE grid, not one per band. The archived PC grid stays per (sport, day) - that is a
  // rendered artefact from the daily job, not something the app composes.
  const showGrid = Boolean(grid && games.length);

  // The mobile grid follows what the bands actually show: everything except genuinely ineligible
  // games. Computed here because the grid spans bands - and it is deliberately built from the WHOLE
  // day, not from `rest`, so hoisting favourites into their own section does not remove them from
  // the grid. The grid shows what it showed.
  const gridGames = useMemo(() => {
    const off = new Set(offServiceSummary(games).off.map((g) => g.id));
    return (games || []).filter((g) => !off.has(g.id));
  }, [games]);

  // 05 section 11: DOM order is YOUR TEAMS -> bands -> grid. At <=699px CSS `order` lifts the grid
  // between the section and the bands, so the phone reads YOUR TEAMS -> grid -> bands. `order`
  // needs a flex parent, which is what .listing is; a column flex container lays block children out
  // the way a block does, and .band carries a BOTTOM margin only, so there is nothing for flex's
  // lack of margin collapsing to change. Measured before and after at both widths to be sure.
  //
  // The jump chip is gone with the same ruling: with the grid second on a phone it had nothing left
  // to jump past.
  return (
    <div className="listing">
      {/* GRID VIEW SUPPRESSES THE LIST (prompt 53 stage 3). `gridOnly` was passed by page.js and
          NEVER DESTRUCTURED here - `git grep gridOnly` returned exactly one line in the whole repo,
          the call site - so GRID VIEW removed the sport bands' headings via `bands={!P.isGrid}` and
          changed nothing else. It added a grid on a phone and, above 699px where `.mgrid-only` is
          `display: none`, added NOTHING: it was one click from LIST and strictly worse.

          The grid is the primary object in this view. Nothing else renders beside it. */}
      {gridOnly ? null : bands ? (
        <>
          {/* THE CALLER'S HEADING, WHEN THERE IS ONE, RENDERS ABOVE THE BANDS. In the flat branch it
              goes down INTO SportBand as `sectionLabel` (C3, so the count could share its row); with
              bands there are several SportBands and no single one to carry it, so it renders here as
              the OUTER level. Nothing is lost: the per-band count was retired in prompt 50 stage 4
              and the count line is page-level now, so the reason it had to live inside the band is
              gone. Day mode passes no heading and is unaffected. */}
          {heading ? <p className={headingClass}>{heading}</p> : null}
          {/* D6's in-band float - the hairline and the YOUR TEAMS micro-label inside each sport
              band. Prompt 50 passed false here because a page-level section was doing that job;
              that section was retired in prompt 51 stage 4a, so this is the only mechanism now.
              `floatFavorites` comes from the caller because MY TEAMS has to switch it off - see
              the note on the prop. */}
          {grouped.map(([s, rows]) => (
            <SportBand key={s} sport={s} label={SPORT_LABEL[s] || s} games={rows}
                       standings={standings} rankings={rankings} showDay={showDay} onOpen={setOpen}
                       floatFavorites={floatFavorites} />
          ))}
        </>
      ) : (
        // THE FLAT ARRANGEMENT: one SportBand with its header off, used where the caller supplies
        // its own heading. Today that is WEEK MODE with a sport selected, where the weekday is the
        // heading and a sport band beneath it would repeat what the tile already says.
        //
        // This comment used to read "/weeks and /history keep their flat structure". BOTH ROUTES ARE
        // RETIRED - they are redirects (web/app/weeks/page.js, web/app/history/page.js) and have
        // been since prompt 50 made the app one route.
        //
        // Same component, header off, so the count line, the toggle, the favourites float and the
        // row wrappers have one implementation. The caller's heading renders through the SAME header
        // row the sport bands use, and the count joins it identically; it used to be an <h3> outside
        // this component, which is why the count could only sit below it.
        <SportBand sport={sport} label={null} games={games} standings={standings}
                   rankings={rankings} showDay={showDay} onOpen={setOpen} showHeader={false}
                   sectionLabel={heading} headingClass={headingClass}
                   floatFavorites={floatFavorites} />
      )}

      {/* THE MOBILE GRID IS MOBILE-ONLY. It used to render at every width, so a desktop MLB day whose
          archived PC grid had not been rendered showed a phone grid stretched across a 1060px column,
          and a desktop CFB day showed BOTH. The Mobile Grid Addendum is explicit that its deviations
          are phone-only - M5's shorthand hour axis says "PC keeps v1.2 labels" - so above the
          breakpoint the desktop grid is the archived PC render and nothing else. CSS-gated at the
          same 699px the rest of the app uses, so no JS width state and no hydration mismatch. */}
      {showGrid ? (
        <div className="mgrid-only">
          <MobileGrid games={gridGames} sport={sport} day={day} standings={standings} onOpen={setOpen}
                      nowMinute={nowMinute} />
        </div>
      ) : null}

      {/* position: fixed, so it takes no part in the flex ordering above. */}
      {open ? (
        <GameDetail game={open} standings={standings} generatedAt={generatedAt} onClose={closePanel} />
      ) : null}
    </div>
  );
}
