// The listings card (prompt 14 §3.4, restacked by Joe's C1 ruling) - Today, Weeks and History.
//
//   [ time ] [ away tcol ]   [ MARK ]   [ favoured logo + ML ]
//   [ date ] [ home tcol ]              [ O/U ]
//            venue
//
// FOUR columns: time | body | processed mark | right slot. The mark sits BETWEEN the matchup and the
// slot, in its own column, vertically centred - not inside the body and not left of the matchup.
//
// C1: THE TWO TEAMS STACK, away above home. They used to sit side by side and share the body's width
// between them, which is why prompt 31 measured .mbody at 152px against the ~250px two names need and
// left flex-wrap in place to stop names truncating. Stacking makes that permanent instead of
// conditional: each name now has the whole body width to itself at every viewport, rather than only
// at the widths where the row happened to wrap.
//
// tcol line 1  logo (DARK variant - it floats on charcoal, addendum M12) + name + RECORD
// tcol line 2  where that record places the club - the rest of the standing line
// tcol line 3  MLB only: the probable starter, or 'Starter TBA'
//
// C2 moved the record up onto line 1. Each line renders only when it has something to say; a club with
// no record shows no record, and the line below it still shows the division. See lib/standings.js.
//
// The venue line stays at the foot of the body, under both teams.

import { useRef } from 'react';
import { etTime, teamColor, dayParts, slotContent } from '../lib/format.js';
import { teamLogoDarkUrl } from '../lib/config.js';
import TeamMark from './TeamMark.js';
import { cardBroadcast, cardMark } from '../lib/cardbroadcast.js';
import { cardName } from '../lib/cardname.js';
import { standingParts, standingFor, rankFor } from '../lib/standings.js';
import { useTextMeasurer, useElementWidth } from '../lib/useTextMeasurer.js';
import { fitNameAndRecord } from '../lib/cardGeometry.js';

// STACK_H (54 = 22 + 16 + 16) is gone with markStyle(): the network mark is no longer sized against
// the three-line stack, it is fitted to a fixed box per breakpoint in CSS.

// The name a card prints for a team. THE RULE IS lib/cardname.js (prompt 127), for the reason the
// note on `cardBroadcast` below gives: this file is JSX, and /api/my-games prints the same name. It
// is still exported from here, which is where GameDetail and MobileGrid import it from.
export { cardName };

/**
 * The FIRST-PAINT size only. The real decision is fitNameAndRecord(), measured against the room the
 * row actually has; this is what renders before that measurement exists (server output, and the tick
 * before the fonts resolve), so it stays a cheap character-count guess.
 *
 * Character count is why prompt 42 existed: it cannot know that "South Alabama" is thirteen
 * characters and still needs 110px in the 81px a 390px card has. Kept, exported and tested as the
 * fallback it now is - not as the rule.
 */
export function nameSize(name) {
  const n = (name || '').length;
  if (n > 19) return 11;
  if (n > 13) return 12.5;
  return 15;
}

/** The face `.tl1 b` paints in, as a canvas font shorthand. Weight and family match the stylesheet. */
const NAME_FONT = (px) => `600 ${px}px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
/** `.tl1-rec` is 11.5px/500 tabular; its width decides whether the name can afford to keep it. */
const REC_FONT = "500 11.5px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/**
 * The record's rendered width, allowing for `font-variant-numeric: tabular-nums`.
 *
 * Canvas has no way to ask for tabular figures, so measuring "64-75" straight gives PROPORTIONAL
 * digits - narrower than what paints. That under-measure left the name a tier too large and produced
 * the one thing this whole change exists to prevent: "Tigers" at 15px beside a full record, needing
 * 46.27px in the 44.3px it actually had. Tabular figures all share the widest digit's advance, so
 * every digit is measured as a '0'. It errs by a fraction toward reserving too much for the record,
 * which costs a tier at worst and never truncates a name.
 */
function measureRecord(measure, record) {
  return measure(String(record).replace(/[0-9]/g, '0'), REC_FONT);
}

/**
 * ONE COLUMN PER TEAM - line 1 (logo + name), line 2 (record + standing), line 3 (MLB probable).
 *
 * This is the shape the locked reference uses (`.duel.hug > .tcol`), and it is what puts each team's
 * record UNDER ITS OWN NAME. The card had drifted to a split layout - names in a hugging flex row,
 * records in a separate 50/50 grid - so the away record sat hard left while the home record floated
 * at the card's midpoint, unrelated to the name above it. Keeping the three lines in one column makes
 * that misalignment structurally impossible rather than something to tune.
 *
 * The column is `flex: 0 1 auto; min-width: 0`, so the '@' still hugs: the stack is only as wide as
 * its content, and the two stacks close around the '@' rather than sitting in fixed halves.
 */
function TeamStack({ team, teamId, sport, standings, rankings, season, week, probable, showProbable,
                    rowWidth, measure }) {
  const name = cardName(team, teamId);
  const id = team?.id || teamId;
  const row = standings ? standingFor(standings, id, season) : null;
  // CFB only: { poll, rank }, CFP before AP. Every other sport passes null and never reaches a poll.
  // The POLL travels with the number because line 2 prints it - "AP #14 · Big Ten", not "#14".
  const ranked = sport === 'cfb' && rankings ? rankFor(rankings, id, season, week) : null;
  const { record, rest } = standingParts(row, sport, team?.conference?.name, ranked);

  // THE NAME OUTRANKS THE RECORD (prompt 42), and both decisions are measured rather than guessed.
  // Until the row has been measured - the server pass, and the tick before the fonts resolve - fall
  // back to the old character-count size, which useLayoutEffect-timing corrects before paint.
  const fit = rowWidth > 0 && measure
    ? fitNameAndRecord(measure, name, record ? measureRecord(measure, record) : 0, rowWidth, NAME_FONT)
    : { px: nameSize(name), showRecord: Boolean(record), truncates: false };

  return (
    <div className="tcol">
      <div className="tl1">
        {/* A placeholder team - a postseason seed with no club yet - shows a TBD badge in this box
            (prompt 116); the game's sport rides along because the embed does not carry it. */}
        <TeamMark team={team} sport={sport} src={teamLogoDarkUrl(id)} />
        <b style={{ fontSize: `${fit.px}px` }}>{name}</b>
        {/* The record is DROPPED FROM THE FLOW when the name needs its room, never hidden in place:
            visibility:hidden would keep the box and the gap, so it would concede nothing. C2's
            reasoning stands where there is room - a squeezed "70-71" reads worse than a squeezed
            name - which is exactly why the concession is all-or-nothing rather than a shrink. */}
        {record && fit.showRecord ? <span className="tl1-rec">{record}</span> : null}
      </div>
      {/* Absent means ABSENT, per line: no blank row is reserved for anything that does not exist. */}
      {rest ? <div className="tcol-rec">{rest}</div> : null}
      {/* AND THAT RULE NOW APPLIES TO THE PITCHER LINE TOO (prompt 57 stage 8). This read
          `probable || 'Starter TBA'`, so every MLB card reserved the row whether or not anything
          was known - which is the blank row the line above forbids, wearing a label.
          GameDetail KEEPS its own "Starter TBA": the panel is exactly where a reader goes to find
          out that the starter is not announced, so there the sentence IS the answer. */}
      {showProbable && probable ? <div className="tcol-pitch">{probable}</div> : null}
    </div>
  );
}

// The broadcast the card names: primary first, then a linear row, then whatever is left - kept
// whenever it shows a mark, and otherwise the row the eligibility verdict names that does (prompt
// 126). THE RULE IS lib/cardbroadcast.js; it moved there because this file is JSX and `node --test`
// cannot import it. It is still exported from here, which is where MobileGrid imports it from to
// choose a game's lane, so the card and the grid cannot name two different broadcasts.
export { cardBroadcast };

// networkText() lived here and went with A3: it was the only caller's only use. THE STRING IT
// CARRIED IS NOW GONE FROM THE REPO ENTIRELY - 'No linear telecast', which prompt 24 flagged as a
// false certainty on games with no broadcast row, left with `networkName` and the dead search chain
// that was the last thing able to reach it (prompt 57 stage 8). This note is corrected in the same
// commit as that deletion rather than left describing a live concern that no longer exists.

/** The favoured side, from the moneylines when present and the (home) spread otherwise. */
export function favourite(game) {
  const o = (game.odds || [])[0];
  if (!o) return null;
  const hm = Number(o.home_moneyline);
  const am = Number(o.away_moneyline);
  if (Number.isFinite(hm) && Number.isFinite(am) && hm !== am) {
    return hm < am ? { side: 'home', ml: hm, odds: o } : { side: 'away', ml: am, odds: o };
  }
  const sp = Number(o.spread);
  if (Number.isFinite(sp) && sp !== 0) {
    const side = sp < 0 ? 'home' : 'away';
    const ml = Number(side === 'home' ? o.home_moneyline : o.away_moneyline);
    return { side, ml: Number.isFinite(ml) ? ml : null, odds: o };
  }
  return null;
}

export default function MatchupCard({ game, standings, rankings, showDay = false, onOpen }) {
  // One measurement per card, shared by both team stacks: `.tl1` spans the body track, so the room
  // the name has is the body's width less the logo, the gaps and whatever the record wants.
  const bodyRef = useRef(null);
  const bodyWidth = useElementWidth(bodyRef);
  const { measure } = useTextMeasurer();
  const { home, away, sport } = game;
  // THE CAVALIERS' SIMULCAST COLLAPSES TO ONE CARD (prompt 106, Joe 2026-09-16). The grid shows a
  // lane per network; the list shows one card wearing the composite for the services this game
  // actually carries, and every other game wears its named row's own mark. `cardMark` composes the
  // two, collapse first, from the game's own rows - this component never reads data/local_rights.json.
  // It lives in lib/cardbroadcast.js since prompt 127, because /api/my-games names the same mark.
  // Just the URL. The mark's box is CSS now, per breakpoint, so the card never computes hf.
  const mark = cardMark(game).url;
  const fav = favourite(game);
  // Contract v1.6.6: the right slot's five rungs, decided once in a pure function so the
  // ORDERING can be tested without a DOM. See web/lib/format.js.
  const slot = slotContent(game, fav);
  const isMlb = sport === 'mlb';

  const body = (
    <>
      <div className="seam" aria-hidden="true">
        <span style={{ background: teamColor(away?.primary_color) }} />
        <span style={{ background: teamColor(home?.primary_color) }} />
      </div>

      <div className="mtime">
        {etTime(game.canonical_kickoff_at_utc, game.kickoff_status)}
        {/* B4: two deliberate lines - WEDNESDAY over SEP 2. As one string in a 56px column this
            wrapped at whatever character ran out of room, which stranded the date NUMBER alone on
            line two. */}
        {showDay && dayParts(game.viewing_day) ? (
          <span className="mtime-day">
            <span className="mtime-weekday">{dayParts(game.viewing_day).weekday}</span>
            <span className="mtime-date">{dayParts(game.viewing_day).monthDay}</span>
          </span>
        ) : null}
      </div>

      <div className="mbody" ref={bodyRef}>
        {/* the '@' sits between the away name's last character and the home logo - content flow,
            never a fixed centre column */}
        <div className="duel hug">
          <TeamStack
            team={away} teamId={game.away_team_id} sport={sport} standings={standings}
            rankings={rankings} season={game.season} week={game.week}
            rowWidth={bodyWidth} measure={measure}
            probable={game.probable_away_pitcher} showProbable={isMlb}
          />
          {/* NOTHING between the stacks, on EVERY game. Joe, 2026-09-05: "Eliminate the vs so all
              cards look the same." This retires prompt 33 stage 1, which kept `vs` on the 20
              neutral-site games (11 CFB, 9 NFL) so a London game would not read as a home game.
              The fact did not go away - it moved to the venue line below, where it is a property
              of the fixture rather than a marker wedged between two teams. */}
          <TeamStack
            team={home} teamId={game.home_team_id} sport={sport} standings={standings}
            rankings={rankings} season={game.season} week={game.week}
            rowWidth={bodyWidth} measure={measure}
            probable={game.probable_home_pitcher} showProbable={isMlb}
          />
        </div>

        {/* grey network text under EVERY matchup, mark or no mark */}
        <div className="mnet">
          {/* A3, Joe's ruling: the bottom line is the VENUE, not the network. The network MARK
              still renders in its own column two places right, which is what made this text
              redundant. Nothing renders when a game has no venue row - measured, that is 0 of
              1379 loaded games, so the blank case is theoretical rather than common. */}
          {game.venue?.name ? <span className="mnet-text">{game.venue.name}</span> : null}
          {/* THE NEUTRAL-SITE FACT LIVES HERE NOW (Joe, 2026-09-05). One size step smaller than the
              venue, italic, regular weight, --dim - the standings-line grey - so it reads as a note
              ON the venue rather than as a second venue. It renders even when no venue is loaded,
              because the fact must never be lost; the line is then the parenthetical alone. */}
          {game.neutral_site ? <span className="mnet-neutral">(neutral site)</span> : null}
        </div>
      </div>

      {/* THE MARK IS ITS OWN CARD COLUMN, between the matchup and the right slot, and the column is
          a FIXED TRACK now (Joe, 2026-09-04) - 62px on the phone, 92px above it, with the mark fitted
          to a 56x40 / 84x44 box and centred both ways. The hf-scaled height this used to carry is
          gone from the card: the frozen manifest still governs the banner and the grid rail, but on
          this surface it produced 22-45px heights and 39.7-92px widths, which is exactly the ragged
          column the ruling removes. Sizing lives in CSS so the two breakpoints stay in one place. */}
      {mark ? (
        <img className="mnet-mark" src={mark} alt="" loading="lazy" />
      ) : (
        <span className="mnet-mark mnet-mark-empty" aria-hidden="true" />
      )}

      {/* THREE ROWS, ALWAYS IN THE SAME ORDER: mark, number, word. Rungs 1, 3 and 5 return one
          row rather than three - the slot never reserves an empty one. Every branch below is a
          render of `slot`; the decision itself is not made here. */}
      <div className="mslot" data-kind={slot.kind}>
        {slot.markSide ? (
          <TeamMark team={slot.markSide === 'home' ? home : away} sport={sport}
                    src={teamLogoDarkUrl(slot.markSide === 'home' ? home?.id : away?.id)} />
        ) : slot.tied ? (
          // A word where every other card has a mark. Joe chose this over a blank row and over
          // showing both marks, with that cost named at decision time.
          <span className="mslot-tied">Tied</span>
        ) : null}
        {/* ONE SET OF ROW CLASSES FOR EVERY STATE. The odds rung used to render row 2 at 14px and
            row 3 at 11px where the score rung used 17px and 13px, so the slot was 57.3px tall on a
            priced game and 69.5px on a final - two silhouettes in the column v1.6.6 claimed had one.
            Stage 1 measured that; this is where it stops. */}
        {slot.row2 ? (
          <span className="mscore" style={slot.row2Px ? { fontSize: `${slot.row2Px}px` } : undefined}>
            {slot.row2}
          </span>
        ) : null}
        {slot.row3 ? (
          <span className="mslot-state" data-tone={slot.tone}>{slot.row3}</span>
        ) : null}
      </div>
    </>
  );

  // `data-live` IS THE SCROLL TARGET'S ONLY MARKER (prompt 67 stage 2), and it is written from
  // `result_status` on the SERVER for the same reason `nowMinute` is: the client must not hold a
  // clock. It is not styling and nothing in globals.css reads it - components/AutoScroll.js finds
  // the earliest one inside today's block and lands the reader there. `slot.kind` was the
  // alternative and is wrong for this: a live game WITH scores reports kind 'score', so half the
  // live slate would not have matched.
  const live = game?.result_status === 'in_progress' ? '1' : undefined;

  if (onOpen) {
    return (
      <button type="button" className="mcard" data-live={live} onClick={() => onOpen(game)}>
        {body}
      </button>
    );
  }
  return <div className="mcard" data-live={live}>{body}</div>;
}
