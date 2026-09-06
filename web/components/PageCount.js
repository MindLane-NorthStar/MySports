'use client';

// THE PAGE'S COUNT LINE, and the reveal for what it hid (prompt 50 stage 4b/4c).
//
// It renders ONCE, at the foot of the page, below the last band. Until prompt 50 every sport band
// carried its own line - "every band reports its counts", the `4250aa9` fix the handoff has listed
// as do-not-regress since prompt 21. Joe's new instruction supersedes it, and stage 6 records the
// reversal rather than leaving the old note standing.
//
// WHAT THE REVEAL DOES, AND WHY IT DOES IT HERE. Tapping the line opens the hidden games as a
// section IMMEDIATELY BELOW IT, grouped by sport, chronological within each group. Nothing above the
// reader moves.
//
// That last part is the whole reason for the shape. The control is at the FOOT of the page. If the
// revealed games expanded back into their sport bands - which is where they belong, and is what the
// per-band toggle used to do - the reader would tap and the visible screen would not change, while
// the page silently grew by several thousand pixels ABOVE them. On a 56-game November Saturday that
// is a scroll position thrown away.
//
// COWORK'S CALL, FLAGGED FOR JOE'S VETO. Grouping by sport rather than one flat chronological list
// is a judgement: the games came out of sport bands, so they read back most naturally under sport
// headings. One flat list ordered by kickoff is the alternative and is a two-line change.

import { useMemo, useState, useCallback } from 'react';
import MatchupCard from './MatchupCard.js';
import ProgramCard from './ProgramCard.js';
import GameDetail from './GameDetail.js';
import { isProgram } from '../lib/programs.js';
import { pageCountLine, revealLabel } from '../lib/offservice.js';
import { indexStandings, indexRankings } from '../lib/standings.js';
import { SPORTS, SPORT_LABEL, sportMarkUrl } from '../lib/config.js';

export default function PageCount({ summary, hidden = [], standingsRows, rankingsRows, showDay = false }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  // The same index Listing builds, from the same rows - a revealed card must render the standings
  // line and the CFB poll rank exactly as it would have in its band.
  const standings = useMemo(() => indexStandings(standingsRows), [standingsRows]);
  const rankings = useMemo(() => indexRankings(rankingsRows), [rankingsRows]);
  // Blur the card on close, or its :focus-visible ring stays and reads as a state on the card -
  // the same thing Joe reported about the bands (Listing.js has the long version).
  const closeDetail = useCallback(() => {
    const el = typeof document !== 'undefined' ? document.activeElement : null;
    if (el && el instanceof HTMLElement && el.classList.contains('mcard')) el.blur();
    setDetail(null);
  }, []);
  if (!summary) return null;

  const line = pageCountLine(summary);
  const label = revealLabel(hidden.length);

  // Bands render in SPORTS order, not kickoff order - the same order the page above uses, so the
  // revealed section reads as the page's own missing rows rather than as a differently-sorted list.
  const grouped = [];
  if (open && hidden.length) {
    const by = new Map();
    for (const g of hidden) {
      if (!by.has(g.sport)) by.set(g.sport, []);
      by.get(g.sport).push(g);
    }
    const known = SPORTS.filter((s) => by.has(s));
    const extra = [...by.keys()].filter((s) => !SPORTS.includes(s)).sort();
    for (const s of [...known, ...extra]) grouped.push([s, by.get(s)]);
  }

  return (
    <section className="pagecount" aria-label="What is on your services">
      <p className="pagecount-line">
        <span className="pagecount-total">{line}</span>
        {label ? (
          <>
            {' '}
            {/* A real <button> with aria-expanded, because it is a disclosure whatever it looks
                like. It keeps the 44px target: this is the one control gating access to every
                hidden game, and prompt 25 called it the most important of the three for that
                reason. The shortened ALL SPORTS bar is stage 2c's deliberate exception and does
                not extend here. */}
            <button type="button" className="offsvc-toggle" aria-expanded={open}
                    aria-controls="pagecount-hidden" onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide them' : label}
            </button>
          </>
        ) : null}
      </p>

      {open && grouped.length ? (
        <div className="pagecount-hidden" id="pagecount-hidden">
          {grouped.map(([s, rows]) => (
            <section className="band" key={s} aria-label={SPORT_LABEL[s] || s}>
              <div className="band-headrow">
                <header className="band-head">
                  {sportMarkUrl(s) ? <img className="band-mark" src={sportMarkUrl(s)} alt="" /> : null}
                  <h2 className="band-title">{SPORT_LABEL[s] || s}</h2>
                </header>
              </div>
              <div className="cards">
                {rows.map((g) => (
                  // The dim stays: these are shown BECAUSE they were hidden, so the row has to say
                  // why it is here. `.offsvc-row` is the same wrapper class the band used, and the
                  // eligibility verdict behind it is still read from viewer_game_eligibility and
                  // never recomputed in JS.
                  <div key={g.id} className="offsvc-row">
                    {isProgram(g) ? (
                      <ProgramCard program={g} showDay={showDay} onOpen={setDetail} />
                    ) : (
                      <MatchupCard game={g} standings={standings} rankings={rankings}
                                   showDay={showDay} onOpen={setDetail} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {/* position: fixed, so it takes no part in the layout above and cannot move the page. */}
      {detail ? <GameDetail game={detail} standings={standings} onClose={closeDetail} /> : null}
    </section>
  );
}
