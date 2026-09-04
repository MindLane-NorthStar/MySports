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

import { etTime, teamColor, dayParts, slotContent } from '../lib/format.js';
import { teamLogoDarkUrl, markUrl } from '../lib/config.js';
import { showsMark } from '../lib/marks.js';
import { standingParts, standingFor, rankFor } from '../lib/standings.js';

// STACK_H (54 = 22 + 16 + 16) is gone with markStyle(): the network mark is no longer sized against
// the three-line stack, it is fitted to a fixed box per breakpoint in CSS.

/** display_name is the media-standard short form; short_name is the fallback. Never the full name. */
export function cardName(team, fallbackId) {
  return team?.display_name || team?.short_name || team?.canonical_name || team?.abbreviation || fallbackId || 'TBD';
}

/** Tiered shrink BEFORE truncation: a long name gets smaller type, not an ellipsis. */
export function nameSize(name) {
  const n = (name || '').length;
  if (n > 19) return 11;
  if (n > 13) return 12.5;
  return 15;
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
function TeamStack({ team, teamId, sport, standings, rankings, season, week, probable, showProbable }) {
  const name = cardName(team, teamId);
  const id = team?.id || teamId;
  const row = standings ? standingFor(standings, id, season) : null;
  // CFB only: { poll, rank }, CFP before AP. Every other sport passes null and never reaches a poll.
  // The POLL travels with the number because line 2 prints it - "AP #14 · Big Ten", not "#14".
  const ranked = sport === 'cfb' && rankings ? rankFor(rankings, id, season, week) : null;
  const { record, rest } = standingParts(row, sport, team?.conference?.name, ranked);
  return (
    <div className="tcol">
      <div className="tl1">
        <img src={teamLogoDarkUrl(id)} alt="" loading="lazy" />
        <b style={{ fontSize: `${nameSize(name)}px` }}>{name}</b>
        {/* C2: the record joins the name. It does not shrink with the name - it is short, and a
            squeezed "70-71" would be unreadable long before a squeezed team name is. */}
        {record ? <span className="tl1-rec">{record}</span> : null}
      </div>
      {/* Absent means ABSENT, per line: no blank row is reserved for anything that does not exist. */}
      {rest ? <div className="tcol-rec">{rest}</div> : null}
      {showProbable ? <div className="tcol-pitch">{probable || 'Starter TBA'}</div> : null}
    </div>
  );
}

/** The broadcast the card names. Primary first, then a linear row, then whatever is left. */
export function cardBroadcast(game) {
  const rows = (game.broadcasts || []).filter((b) => b.active !== false);
  if (!rows.length) return null;
  return rows.find((b) => b.is_primary) || rows.find((b) => b.delivery_surface === 'LINEAR') || rows[0];
}

// networkText() lived here and is gone with A3: it was the only caller's only use, and it carried
// the 'No linear telecast' string that prompt 24 flagged as a false certainty on games with no
// broadcast row at all. The venue replaces it, so both go together.

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
  const { home, away, sport } = game;
  const b = cardBroadcast(game);
  // Just the URL. The mark's box is CSS now, per breakpoint, so the card never computes hf.
  const mark = showsMark(b) ? markUrl(b.service_id) : null;
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

      <div className="mbody">
        {/* the '@' sits between the away name's last character and the home logo - content flow,
            never a fixed centre column */}
        <div className="duel hug">
          <TeamStack
            team={away} teamId={game.away_team_id} sport={sport} standings={standings}
            rankings={rankings} season={game.season} week={game.week}
            probable={game.probable_away_pitcher} showProbable={isMlb}
          />
          {/* NOTHING between the stacks on an ordinary game - away-above-home carries it, and Joe
              asked for the @ to go. `vs` STAYS for neutral sites, because there the order carries
              nothing: 20 games in the loaded season are neutral (11 CFB, 9 NFL), and dropping the
              marker outright would render an NFL game in London as a home game. Stacked, it is a
              short row of its own between the two teams rather than a hug between two columns -
              which is if anything clearer, because a neutral site is a fact about the fixture and
              now reads on its own line. */}
          {game.neutral_site ? <span className="at">vs</span> : null}
          <TeamStack
            team={home} teamId={game.home_team_id} sport={sport} standings={standings}
            rankings={rankings} season={game.season} week={game.week}
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
          <img src={teamLogoDarkUrl(slot.markSide === 'home' ? home?.id : away?.id)} alt="" loading="lazy" />
        ) : slot.tied ? (
          // A word where every other card has a mark. Joe chose this over a blank row and over
          // showing both marks, with that cost named at decision time.
          <span className="mslot-tied">Tied</span>
        ) : null}
        {/* ONE SET OF ROW CLASSES FOR EVERY STATE. The odds rung used to render row 2 at 14px and
            row 3 at 11px where the score rung used 17px and 13px, so the slot was 57.3px tall on a
            priced game and 69.5px on a final - two silhouettes in the column v1.6.6 claimed had one.
            Stage 1 measured that; this is where it stops. */}
        {slot.row2 ? <span className="mscore">{slot.row2}</span> : null}
        {slot.row3 ? (
          <span className="mslot-state" data-tone={slot.tone}>{slot.row3}</span>
        ) : null}
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button type="button" className="mcard" onClick={() => onOpen(game)}>
        {body}
      </button>
    );
  }
  return <div className="mcard">{body}</div>;
}
