// One game, as a card. Server component - no interactivity of its own.
//
// `href` turns the WHOLE card into a link (the /history behaviour). The raw boxscore URL is never
// rendered as text anywhere; the card itself is the click target, which is the contract from
// pipeline/load.py's boxscore_url note.

import { etTime, resultLabel, hasScore, teamColor } from '../lib/format.js';
import { networkName } from '../lib/queries.js';
import { teamLogoUrl, SPORT_LABEL } from '../lib/config.js';

function teamName(t, fallbackId) {
  return t?.short_name || t?.canonical_name || t?.abbreviation || fallbackId || 'TBD';
}

function StatePill({ game }) {
  const label = resultLabel(game);
  if (label) {
    const tone = game.result_status === 'final' ? 'final' : game.result_status === 'in_progress' ? 'live' : 'tbd';
    return (
      <span className="pill" data-tone={tone}>
        {label}
      </span>
    );
  }
  if (game.kickoff_status === 'tbd' || game.network_status === 'tbd') {
    return (
      <span className="pill" data-tone="tbd">
        TBD
      </span>
    );
  }
  return null;
}

export default function GameCard({ game, href, showSport = true, showDay = false }) {
  const home = game.home;
  const away = game.away;
  const net = networkName(game);
  const score = hasScore(game) ? `${game.away_score} – ${game.home_score}` : null;

  const body = (
    <>
      <div className="seam" aria-hidden="true">
        <span style={{ background: teamColor(away?.primary_color) }} />
        <span style={{ background: teamColor(home?.primary_color) }} />
      </div>

      <div className="card-time">
        {etTime(game.canonical_kickoff_at_utc, game.kickoff_status)}
        {showDay ? <div>{game.viewing_day}</div> : null}
      </div>

      <div>
        <div className="card-matchup">
          <img className="logo" src={teamLogoUrl(away?.id)} alt="" loading="lazy" />{' '}
          {teamName(away, game.away_team_id)}{' '}
          <span style={{ color: 'var(--dim)' }}>{game.neutral_site ? 'vs' : '@'}</span>{' '}
          <img className="logo" src={teamLogoUrl(home?.id)} alt="" loading="lazy" />{' '}
          {teamName(home, game.home_team_id)}
        </div>
        <div className="card-meta">
          {showSport ? <span>{SPORT_LABEL[game.sport] || game.sport?.toUpperCase()}</span> : null}
          {net ? <span>{net}</span> : null}
          <StatePill game={game} />
        </div>
      </div>

      <div className="card-right">
        {score ? <span className="score">{score}</span> : null}
        {href ? <span className="card-linkhint">Box score ↗</span> : null}
      </div>
    </>
  );

  if (href) {
    return (
      <a className="card" href={href} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    );
  }
  return <div className="card">{body}</div>;
}
