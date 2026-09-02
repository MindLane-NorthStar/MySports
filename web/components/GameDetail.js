'use client';

// The game detail panel (prompt 14 §3.6, addendum M11).
//
// Tapping a grid block or a listings card opens this. Everything it shows is already on the game
// object the page fetched - it makes no request of its own, so opening a panel is instant and offline
// after first paint.
//
// Watch links are BEST EFFORT and say so: a curated per-service URL where we have one, DirecTV Stream
// otherwise. They are entry points to the service, never a claim that this specific game streams there.

import { useEffect } from 'react';
import { etTime, longDay, resultLabel, hasScore } from '../lib/format.js';
import { teamLogoDarkUrl, watchUrl, DIRECTV_STREAM } from '../lib/config.js';
import { markStyle, hasMark } from '../lib/marks.js';
import { standingLine, standingFor } from '../lib/standings.js';
import { cardName } from './MatchupCard.js';

const ACCESS_LABEL = {
  available: 'On your services',
  unavailable: 'Not on your services',
  out_of_market: 'Out of market',
  conditional: 'Check carriage',
  unverified: 'Assignment not entered',
  unknown: 'Unknown',
};

export default function GameDetail({ game, standings, generatedAt, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!game) return null;
  const { home, away, sport } = game;
  const rows = (game.broadcasts || []).filter((b) => b.active !== false);
  const odds = (game.odds || [])[0];
  const state = resultLabel(game);
  const score = hasScore(game) ? `${game.away_score} - ${game.home_score}` : null;

  const line = (team) => standingLine(standings ? standingFor(standings, team?.id, game.season) : null, sport, team?.conference?.name);

  return (
    <div className="dpanel-scrim" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="dpanel" onClick={(e) => e.stopPropagation()}>
        <div className="dpanel-head">
          <img src={teamLogoDarkUrl(away?.id)} alt="" />
          <strong>
            {cardName(away, game.away_team_id)} {game.neutral_site ? 'vs' : '@'} {cardName(home, game.home_team_id)}
          </strong>
          <img src={teamLogoDarkUrl(home?.id)} alt="" />
          <button type="button" className="dpanel-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="dsec">
          <div className="dgrid">
            <div>
              <span>When</span>
              {longDay(game.viewing_day)} · {etTime(game.canonical_kickoff_at_utc, game.kickoff_status)}
            </div>
            {game.venue?.name ? (
              <div>
                <span>Venue</span>
                {game.venue.name}
                {game.venue.city ? `, ${game.venue.city}` : ''}
              </div>
            ) : null}
            {score ? (
              <div>
                <span>{state}</span>
                {score}
              </div>
            ) : (
              <div>
                <span>Status</span>
                {state || 'Scheduled'}
              </div>
            )}
          </div>
        </div>

        {line(away) || line(home) ? (
          <div className="dsec">
            <h4>Records</h4>
            <div className="dgrid">
              {line(away) ? (
                <div>
                  <span>{cardName(away, game.away_team_id)}</span>
                  {line(away)}
                </div>
              ) : null}
              {line(home) ? (
                <div>
                  <span>{cardName(home, game.home_team_id)}</span>
                  {line(home)}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {sport === 'mlb' ? (
          <div className="dsec">
            <h4>Probable pitchers</h4>
            <div className="dgrid">
              <div>
                <span>{cardName(away, game.away_team_id)}</span>
                {game.probable_away_pitcher || 'Starter TBA'}
              </div>
              <div>
                <span>{cardName(home, game.home_team_id)}</span>
                {game.probable_home_pitcher || 'Starter TBA'}
              </div>
            </div>
          </div>
        ) : null}

        <div className="dsec">
          <h4>Where to watch</h4>
          {rows.length ? (
            <ul>
              {rows.map((b) => {
                const m = hasMark(b.service_id) ? markStyle(b.service_id, 30) : null;
                return (
                  <li key={`${b.service_id}-${b.feed_side}-${b.delivery_surface}`} className="dbcast">
                    {m ? <img src={m.src} height={m.height} alt="" /> : null}
                    <span>{b.network?.canonical_name || b.label || b.service_id}</span>
                    <span className="dacc" data-a={b.access_status}>
                      {ACCESS_LABEL[b.access_status] || b.access_status}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty" style={{ padding: 0 }}>
              No broadcast row for this game yet.
            </p>
          )}
          <div className="dlinks">
            {rows
              .filter((b) => b.access_status === 'available')
              .slice(0, 3)
              .map((b) => (
                <a
                  key={b.service_id}
                  className="dlink"
                  href={watchUrl(b.service_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch on {b.network?.canonical_name || b.service_id}
                </a>
              ))}
            <a className="dlink" href={DIRECTV_STREAM} target="_blank" rel="noopener noreferrer">
              DirecTV Stream
            </a>
            {game.result_status === 'final' && game.boxscore_url ? (
              <a className="dlink" href={game.boxscore_url} target="_blank" rel="noopener noreferrer">
                Box score
              </a>
            ) : null}
          </div>
        </div>

        {odds ? (
          <div className="dsec">
            <h4>Odds{odds.provider ? ` · ${odds.provider}` : ''}</h4>
            <div className="dgrid">
              {odds.spread != null ? (
                <div>
                  <span>Spread (home)</span>
                  {Number(odds.spread) > 0 ? `+${odds.spread}` : odds.spread}
                </div>
              ) : null}
              {odds.total != null ? (
                <div>
                  <span>Total</span>
                  {odds.total}
                </div>
              ) : null}
              {odds.away_moneyline != null ? (
                <div>
                  <span>{cardName(away, game.away_team_id)} ML</span>
                  {Number(odds.away_moneyline) > 0 ? `+${odds.away_moneyline}` : odds.away_moneyline}
                </div>
              ) : null}
              {odds.home_moneyline != null ? (
                <div>
                  <span>{cardName(home, game.home_team_id)} ML</span>
                  {Number(odds.home_moneyline) > 0 ? `+${odds.home_moneyline}` : odds.home_moneyline}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <p className="dstamp">
          Watch links are best effort - they open the service, not this game.
          {generatedAt ? ` Data as of ${generatedAt}.` : ''}
        </p>
      </div>
    </div>
  );
}
