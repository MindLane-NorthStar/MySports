'use client';

// The listings card for a PROGRAM - rendering contract v1.7, derived from the grid block.
//
//   [ time ] [ mark · title · subtitle · crew ]   [ MARK ]   [ Sched | Live | Final ]
//   [ date ]
//
// IT IS MatchupCard's SILHOUETTE, NOT A SECOND ONE. Same `.mcard` plate, radius, hairline, left time
// column, network-mark column and right slot - so the two fixed centred columns prompts 39-42 spent
// three passes aligning keep their centrelines down a mixed page. What changes is only the body:
// a program has no opponent, so where a game stacks two teams a program shows its brand mark, its
// title and its subtitle.
//
// MatchupCard IS NOT TOUCHED. It is locked at v1.6.15 and everything prompt 46 stage 5 protected
// stays protected; this file sits beside it and SportBand chooses between them per row.
//
// WHAT IT DELIBERATELY DOES NOT SHOW: records, standings, and odds. A race has no record and a
// wrestling show has no line. Register §9 puts UFC and NASCAR odds under `show_odds`, and no odds
// provider is wired for either - so the slot renders the schedule state and nothing is invented to
// fill the space.

import { etTime, dayParts } from '../lib/format.js';
import { markUrl } from '../lib/config.js';
import { showsMark } from '../lib/marks.js';
import {
  brandFor, crewNames, eligibilityMissing, isProgram, slotWord, subtitleFor, titleFor,
  tintToWhite, ENDCAP_GRADIENT,
} from '../lib/programs.js';

/** The program's own primary broadcast row, for the network-mark column. */
export function programBroadcast(row) {
  const rows = (row?.broadcasts || []).filter((b) => b?.active !== false);
  if (!rows.length) return null;
  return rows.find((b) => b.is_primary) || rows.find((b) => b.delivery_surface === 'LINEAR') || rows[0];
}

export default function ProgramCard({ program, showDay = false, onOpen }) {
  const brand = brandFor(program?.brand_key);
  const b = programBroadcast(program);
  const mark = showsMark(b) ? markUrl(b.service_id) : null;
  const slot = slotWord(program);
  const subtitle = subtitleFor(program);
  const crew = crewNames(program);
  const missing = eligibilityMissing(program);

  const body = (
    <>
      {/* The card's own top seam. On a game this is the two team colours meeting; on a program it is
          the design's MIRRORED seam - brand at both ends, charcoal at the centre - so the two card
          types share a silhouette without sharing a colour rule that cannot apply. */}
      <div className="seam" aria-hidden="true">
        <span style={{ background: brand.color }} />
        <span style={{ background: brand.color }} />
      </div>

      <div className="mtime">
        {etTime(program.canonical_kickoff_at_utc, program.kickoff_status)}
        {showDay && dayParts(program.viewing_day || program.start_at) ? (
          <span className="mtime-day">
            <span className="mtime-weekday">{dayParts(program.viewing_day || program.start_at).weekday}</span>
            <span className="mtime-date">{dayParts(program.viewing_day || program.start_at).monthDay}</span>
          </span>
        ) : null}
      </div>

      <div className="mbody pbody">
        <div className="pbrand">
          {/* The endcap, at list size. Charcoal tile, brand bar on its right edge, mark inset and
              fit-boxed - never brand-coloured and never white-backed (design of record, "Anatomy").
              A brand with no art in the tree renders its short title as a TYPOGRAPHIC mark rather
              than a fabricated logo; the run's report lists every one of those for Joe. */}
          <span className="pcap" style={{ background: ENDCAP_GRADIENT }}>
            {brand.mark_dark ? (
              <img src={brand.mark_dark} alt="" loading="lazy" />
            ) : (
              <span className="pcap-type">{brand.short_title || titleFor(program).slice(0, 10)}</span>
            )}
            <span className="pcap-bar" style={{ background: brand.color }} />
          </span>
          {/* NO STAGE WASH ON THE LIST ROW. The wash is the GRID block's signature - a mirrored
              gradient across a wide, centred block. Behind a left-aligned title that wraps to two
              or three lines it reads as a smear rather than a stage, measured on the fixture board.
              The brand still carries: the endcap bar at full strength and the card's own seam. */}
          <span className="ptitles">
            <b className="ptitle">{titleFor(program)}</b>
            {subtitle ? (
              <span className="psub" style={{ color: tintToWhite(brand.color) }}>{subtitle}</span>
            ) : null}
          </span>
        </div>

        {/* The venue/service line, in the place the game card puts its venue - so the bottom line of
            every card in a band is the same kind of fact. */}
        <div className="mnet">
          {program.location_text ? <span className="mnet-text">{program.location_text}</span> : null}
          {crew.length ? <span className="pcrew">{crew.join(' · ')}</span> : null}
          {/* §2a': a program with NO eligibility row has not been judged. It is never rendered as
              though it were fine - the cue is visible and the run counts it. */}
          {missing ? <span className="pelig-missing">ELIGIBILITY MISSING</span> : null}
        </div>
      </div>

      {mark ? (
        <img className="mnet-mark" src={mark} alt="" loading="lazy" />
      ) : (
        <span className="mnet-mark mnet-mark-empty" aria-hidden="true" />
      )}

      <div className="mslot" data-kind="state">
        <span className="mslot-state" data-tone={slot.tone || undefined}>{slot.text}</span>
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button type="button" className="mcard pcard" onClick={() => onOpen(program)}>{body}</button>
    );
  }
  return <div className="mcard pcard">{body}</div>;
}

/** True when this row should render as a program card rather than a matchup card. */
export { isProgram };
