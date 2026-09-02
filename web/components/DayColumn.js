// One day of a week, as a LISTING column. /weeks renders these and never a grid: the grid is the
// renderer's artifact, archived per day; the Weeks page is a schedule people scan.

import { etTime } from '../lib/format.js';
import { shortDay } from '../lib/format.js';
import { networkName } from '../lib/queries.js';

function teamShort(t, fallback) {
  return t?.abbreviation || t?.short_name || t?.canonical_name || fallback || 'TBD';
}

export default function DayColumn({ day, games }) {
  return (
    <div className="daycol">
      <div className="daycol-head">
        <strong>{shortDay(day)}</strong>
        <em>{games.length || '—'}</em>
      </div>
      {games.length ? (
        <ul>
          {games.map((g) => {
            const net = networkName(g);
            return (
              <li key={g.id}>
                <span className="t">{etTime(g.canonical_kickoff_at_utc, g.kickoff_status)}</span>
                <br />
                {teamShort(g.away, g.away_team_id)} {g.neutral_site ? 'vs' : '@'}{' '}
                {teamShort(g.home, g.home_team_id)}
                {net ? (
                  <>
                    <br />
                    <span className="n">{net}</span>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
