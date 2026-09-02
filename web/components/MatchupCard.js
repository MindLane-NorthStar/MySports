// The LOCKED listings card (prompt 14 §3.4) - Today and Weeks, every sport.
//
//   [ time ]  [ away tcol ] @ [ home tcol ]        [ favoured logo + ML ]
//             network text (+ mark for access-profile networks)          [ O/U ]
//
// tcol line 1  logo (DARK variant - it floats on charcoal, addendum M12) + name
// tcol line 2  record + standing, OMITTED ENTIRELY when there is none
// tcol line 3  MLB only: the probable starter, or 'Starter TBA'
//
// The '@' HUGS the away name: it sits in the content flow between the away column and the home logo,
// not in a fixed centre column, so the matchup reads as one sentence rather than a table row.

import { etTime, resultLabel, hasScore, teamColor, shortDay } from '../lib/format.js';
import { teamLogoDarkUrl } from '../lib/config.js';
import { markStyle, showsMark } from '../lib/marks.js';
import { standingLine, standingFor } from '../lib/standings.js';

// The three-line stack the network mark is sized against: 22 + 16 + 16.
const STACK_H = 54;

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
 * Line 1 only. The name row is what the '@' hugs, so it must be its own flow element - if the record
 * and pitcher lines shared a column with it, the column would be as wide as its WIDEST line and the
 * '@' would drift out to a de-facto aligned column, which is exactly what the rule forbids.
 */
function TeamName({ team, teamId }) {
  const name = cardName(team, teamId);
  return (
    <span className="tname">
      <img src={teamLogoDarkUrl(team?.id || teamId)} alt="" loading="lazy" />
      <b style={{ fontSize: `${nameSize(name)}px` }}>{name}</b>
    </span>
  );
}

/** Lines 2 and 3, under their own team. An absent standing renders NOTHING, never a blank line. */
function TeamSub({ team, teamId, sport, standings, season, probable, showProbable }) {
  const row = standings ? standingFor(standings, team?.id || teamId, season) : null;
  const line = standingLine(row, sport, team?.conference?.name);
  if (!line && !showProbable) return <div className="dsub" />;
  return (
    <div className="dsub">
      {line ? <div className="tcol-rec">{line}</div> : null}
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

function networkText(game, b) {
  if (b?.network?.canonical_name) return b.network.canonical_name;
  if (b?.label) return b.label;
  if (game.network_status === 'tbd') return 'Network TBD';
  if (game.network_status === 'no_linear_telecast') return 'No linear telecast';
  if (game.network_status === 'stream_exclusive') return 'Streaming exclusive';
  return 'Not on your services';
}

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

function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}

export default function MatchupCard({ game, standings, showDay = false, onOpen }) {
  const { home, away, sport } = game;
  const b = cardBroadcast(game);
  const mark = showsMark(b) ? markStyle(b.service_id, STACK_H) : null;
  const fav = favourite(game);
  const state = resultLabel(game);
  const score = hasScore(game) ? `${game.away_score} - ${game.home_score}` : null;
  const isMlb = sport === 'mlb';

  const body = (
    <>
      <div className="seam" aria-hidden="true">
        <span style={{ background: teamColor(away?.primary_color) }} />
        <span style={{ background: teamColor(home?.primary_color) }} />
      </div>

      <div className="mtime">
        {etTime(game.canonical_kickoff_at_utc, game.kickoff_status)}
        {showDay ? <span className="mtime-day">{shortDay(game.viewing_day)}</span> : null}
      </div>

      <div className="mbody" style={{ minWidth: 0 }}>
        {/* the '@' sits between the away name's last character and the home logo - content flow,
            never a fixed centre column */}
        <div className="duel">
          <TeamName team={away} teamId={game.away_team_id} />
          <span className="at">{game.neutral_site ? 'vs' : '@'}</span>
          <TeamName team={home} teamId={game.home_team_id} />
        </div>
        <div className="dsubs">
          <TeamSub
            team={away}
            teamId={game.away_team_id}
            sport={sport}
            standings={standings}
            season={game.season}
            probable={game.probable_away_pitcher}
            showProbable={isMlb}
          />
          <TeamSub
            team={home}
            teamId={game.home_team_id}
            sport={sport}
            standings={standings}
            season={game.season}
            probable={game.probable_home_pitcher}
            showProbable={isMlb}
          />
        </div>

        {/* grey network text under EVERY matchup; the mark only when the profile has an opinion */}
        <div className="mnet">
          {mark ? (
            <img className="mnet-mark" src={mark.src} height={mark.height} alt="" loading="lazy" />
          ) : null}
          <span className="mnet-text">{networkText(game, b)}</span>
        </div>
      </div>

      <div className="mslot">
        {score ? <span className="mscore">{score}</span> : null}
        {fav && !score ? (
          <>
            <img src={teamLogoDarkUrl(fav.side === 'home' ? home?.id : away?.id)} alt="" loading="lazy" />
            <span>
              <span className="mslot-ml">{fav.ml === null ? '-' : signed(fav.ml)}</span>
              {fav.odds?.total != null ? (
                <span className="mslot-ou" style={{ display: 'block' }}>
                  O/U {Number(fav.odds.total)}
                </span>
              ) : null}
            </span>
          </>
        ) : null}
        {!fav && !score ? (
          <span
            className="mslot-state"
            data-tone={game.result_status === 'final' ? 'final' : game.result_status === 'in_progress' ? 'live' : 'sched'}
          >
            {state || 'Sched'}
          </span>
        ) : null}
        {score ? (
          <span className="mslot-state" data-tone={game.result_status === 'final' ? 'final' : 'live'}>
            {state}
          </span>
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
