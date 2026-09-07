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
import {
  ENDCAP_GRADIENT, brandFor, isProgram, subtitleFor, tintToWhite, titleFor,
} from '../lib/programs.js';

const ACCESS_LABEL = {
  available: 'On your services',
  unavailable: 'Not on your services',
  out_of_market: 'Out of market',
  conditional: 'Check carriage',
  // PROMPT 57 STAGE 8. This read 'Assignment not entered' - the build describing its own
  // database state to someone who came to find out what is on television, which is the same class
  // as the developer footnote R5 removed in prompt 56. What the reader needs is that the listing is
  // not settled yet, not which table has not been filled in.
  unverified: 'Not yet confirmed',
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
  /**
   * THE PANEL DID NOT KNOW WHAT A PROGRAM WAS (prompt 59, Joe 2026-09-07: "when you click on the
   * event and the sub-card popup renders, the title bar says TBD @ TBD").
   *
   * Programs reach this panel the same way games do - `PageCount` and `Listing` wire `onOpen` to
   * both card types and render ONE <GameDetail> for whatever was tapped - and it was written for
   * matchups only. A program has no `home`, no `away` and no team ids, so `cardName` fell through
   * to its `|| 'TBD'` and printed TBD @ TBD, flanked by two <img> whose src was built from
   * `undefined`.
   *
   * THE HELPERS ARE IMPORTED, NEVER REIMPLEMENTED. `titleFor`, `subtitleFor` and `brandFor` are
   * what ProgramCard builds its head from; a second title-builder here would drift from the card's
   * within a prompt or two, which is working rule 32's exact shape.
   */
  const program = isProgram(game);
  const brand = program ? brandFor(game.brand_key) : null;
  const rows = (game.broadcasts || []).filter((b) => b.active !== false);
  const odds = (game.odds || [])[0];
  const state = resultLabel(game);
  const score = hasScore(game) ? `${game.away_score} - ${game.home_score}` : null;

  const line = (team) => standingLine(standings ? standingFor(standings, team?.id, game.season) : null, sport, team?.conference?.name);

  return (
    <div className="dpanel-scrim" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="dpanel" onClick={(e) => e.stopPropagation()}>
        <div className="dpanel-head">
          {program ? (
            <>
              {/* The card's own endcap, at panel size: charcoal tile, brand bar on its right edge,
                  mark inset. THE TYPOGRAPHIC FALLBACK SURVIVES - a brand with no art in the tree
                  renders its short title rather than an empty box or a fabricated logo, which is
                  the same promise ProgramCard makes. */}
              <span className="pcap dpanel-cap" style={{ background: ENDCAP_GRADIENT }}>
                {brand.mark_dark ? (
                  <img src={brand.mark_dark} alt="" />
                ) : (
                  <span className="pcap-type">{brand.short_title || titleFor(game).slice(0, 10)}</span>
                )}
                <span className="pcap-bar" style={{ background: brand.color }} />
              </span>
              <span className="dpanel-ptitles">
                <strong>{titleFor(game)}</strong>
                {subtitleFor(game) ? (
                  <span className="psub" style={{ color: tintToWhite(brand.color) }}>
                    {subtitleFor(game)}
                  </span>
                ) : null}
              </span>
            </>
          ) : (
            <>
              <img src={teamLogoDarkUrl(away?.id)} alt="" />
              <strong>
                {cardName(away, game.away_team_id)} @ {cardName(home, game.home_team_id)}
              </strong>
              <img src={teamLogoDarkUrl(home?.id)} alt="" />
            </>
          )}
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
            {/* The venue line carries the neutral-site fact, the same way the list card does since
                2026-09-05 - and it renders even with no venue row, because the panel is where a
                reader goes to find out exactly this. */}
            {/* A PROGRAM'S PLACE IS `location_text`, which is what ProgramCard puts on its own
                bottom line - so the row was simply absent on every program. The neutral-site
                parenthetical stays a GAME fact; a race has no neutral site to be at. */}
            {program ? (
              /* AND NOT WHEN THE HEAD ALREADY SAID IT. `subtitleFor` falls back to `location_text`
                 when a program has no subtitle of its own, which is every race - so DARLINGTON
                 RACEWAY was about to appear twice in one panel, once under the title and once
                 here. The row is for the 130 programs that carry a location; it is not for saying
                 the same thing twice. */
              game.location_text && subtitleFor(game) !== String(game.location_text).toUpperCase() ? (
                <div>
                  <span>Where</span>
                  {game.location_text}
                </div>
              ) : null
            ) : game.venue?.name || game.neutral_site ? (
              <div>
                <span>Venue</span>
                {game.venue?.name || ''}
                {game.venue?.name && game.venue?.city ? `, ${game.venue.city}` : ''}
                {game.neutral_site ? (
                  <span className="mnet-neutral">{game.venue?.name ? ' ' : ''}(neutral site)</span>
                ) : null}
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

        {/* GUARDED ON `!program` AS WELL AS THE SPORT. An MLB studio show would carry sport 'mlb'
            and render a Probable pitchers block reading TBD / Starter TBA twice. MEASURED
            2026-09-07: zero of the 307 non-game programs carry sport 'mlb' today - they are nfl 80,
            cfb 31, nascar 98, aew 35, wwe 36, indycar 18, ufc 9 - so this is LATENT rather than a
            live defect, and the guard is here because the day an MLB pregame show loads is not the
            day to discover it. */}
        {!program && sport === 'mlb' ? (
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
