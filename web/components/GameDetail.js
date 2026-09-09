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
import { teamLogoDarkUrl, watchUrl, mlbAppUrl, DIRECTV_STREAM } from '../lib/config.js';
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

/** LINEAR is what DIRECTV can carry. `delivery_surface`, never the service's `type` - see the note
 *  at the watch section for the 85 rows on which those two disagree. */
function isLinear(b) {
  return String(b?.delivery_surface || '').toUpperCase() === 'LINEAR';
}

/**
 * One "Watch Live on" link, wearing the service's own mark.
 *
 * JOE'S WORDS ARE "Watch Live on", not the "Watch on" this used to render. He wrote it twice.
 *
 * `watchUrl()` ALREADY IS THE FALLBACK HE DESCRIBED and needed no change: `WATCH[id] ||
 * DIRECTV_STREAM` (config.js:301). "If the network has its own streaming path, that will be the link
 * for the network. If it doesn't then both links go to DIRECTV's path."
 *
 * A SERVICE WITH NO MARK KEEPS ITS NAME as the label - `hasMark` already guarded the old list, so
 * the text fallback is native rather than added here. Of the 33 services that appear on an
 * accessible row, exactly two have no mark: `cavs-local` and `cbj-local`.
 */
function WatchLink({ service, name, href, big }) {
  // The enlarged mark is not the 30px one scaled: markStyle() takes a stack height and applies the
  // frozen per-mark ink-area factor, so both sizes are normalised the same way and a wordmark and a
  // roundel still carry equal visual weight.
  const m = hasMark(service) ? markStyle(service, big ? 46 : 26) : null;
  return (
    <a
      className={`dlink dlink-watch${big ? ' dlink-big' : ''}`}
      href={href || watchUrl(service)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="dlink-lead">Watch Live on</span>
      {m ? <img src={m.src} height={m.height} alt={name} /> : <span className="dlink-name">{name}</span>}
    </a>
  );
}

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

  // THE ACCESSIBLE BROADCASTS, IN THE ORDER THE CARD SHOWS THEM (prompt 71 stage 4).
  //
  // WHY LINEAR OUTRANKS `is_primary`, measured rather than assumed. `is_primary` behaves exactly as
  // its name claims - exactly one true row on every one of the 1,781 games in the database (the
  // 307-row bucket is `game_id: null`, which is programs keyed by `program_id`, not a defect). But
  // Joe's rule for a simulcast is explicit: "the linear network takes the enlarged slot, streamers
  // sit small beneath it... they supplement, they never replace." The two disagree on 2 of the 93
  // accessible simulcasts - `dazn` over `cavs-local` and `espn-plus` over `cbj-local` - and on those
  // two Joe's words win. `default_sort_order` breaks what is left, as its name claims (populated on
  // 1,797 of 2,769 rows; an unset one sorts last rather than first).
  const accessible = rows
    .filter((b) => b.access_status === 'available')
    .slice()
    .sort((a, b) => {
      if (isLinear(a) !== isLinear(b)) return isLinear(a) ? -1 : 1;
      if (Boolean(a.is_primary) !== Boolean(b.is_primary)) return a.is_primary ? -1 : 1;
      return (a.network?.default_sort_order ?? Number.MAX_SAFE_INTEGER)
           - (b.network?.default_sort_order ?? Number.MAX_SAFE_INTEGER);
    });

  /**
   * THE BOX SCORE, LIVE AND FINAL, NEVER BEFORE THE GAME (prompt 78, Joe's ruling 2026-09-09).
   *
   * It was `=== 'final'` alone. Joe wants the link while the game is on, which is when a box score
   * is worth the most - and NOT while it is scheduled, because an empty box score is a dead tap.
   *
   * THE LOADER HAD TO MOVE FIRST AND DID (`pipeline/load.py`, same commit). `boxscore_url` was
   * written only at finalization, so relaxing this gate on its own would have rendered a link that
   * does nothing in exactly the window it was being added for - measured at 0 of 790 scheduled CFB
   * rows. `&& game.boxscore_url` therefore still guards it, and it is not belt-and-braces: rows
   * that were in progress BEFORE that loader change have no URL yet and get no link until the next
   * refresh writes one. It fills in rather than rendering broken.
   *
   * THE LABEL SAYS WHICH IT IS, because the two are different promises: a live box score is
   * changing under the reader and a final one is a record.
   *
   * ONLY A MATCHUP CAN EVER HAVE ONE, and it is worth saying here so the next reader does not go
   * looking. `boxscore_url` is a column on `games`; the `programs` table has no such column at all,
   * so all 4,230 programs - every race, fight card, weekly show and studio show - are outside this
   * by construction rather than by a filter anyone wrote.
   */
  const boxLive = game.result_status === 'in_progress';
  const boxScore = (boxLive || game.result_status === 'final') && game.boxscore_url ? (
    <a className="dlink" href={game.boxscore_url} target="_blank" rel="noopener noreferrer">
      {boxLive ? 'Live box score' : 'Box score'}
    </a>
  ) : null;
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

        {/* WHERE TO WATCH IS ALL-OR-NOTHING (prompt 71 stage 4, Joe 2026-09-08).
            "currently the sub card shows 'where to watch' and the network logo, THEN a second line
            with 'Watch on' links. We don't want the same image and message to appear back to back."

            THE SECTION IS NOT PER ROW. Joe: "If a game is airing on a network/streamer I cannot
            access as well as ones I CAN access, the 'Where to watch' can still disappear. If a game
            is on the Orioles TV network and Guardians TV, I don't need to know it's on the Orioles
            TV network." So one accessible broadcast removes the whole list, INCLUDING the rows he
            cannot use - once he knows he can watch it, the other broadcaster is noise.

              at least one accessible   ->  the enlarged link(s) only, no <h4>, no <ul>
              none accessible           ->  the "Where to watch" list only, no links

            LINEAR vs STREAMER IS `delivery_surface`, NOT `networks_services.type`, and that was
            measured rather than picked. Both discriminate - type is
            linear_broadcast/linear_cable/streaming/local_tba, surface is LINEAR/STREAMING - but they
            DISAGREE ON 85 ROWS, all of them `local_tba` services (cavs-local, cbj-local) that are
            plainly linear and whose type is a placeholder meaning "local broadcaster to be
            announced". `delivery_surface` also describes THIS airing rather than the service in
            general, which is the right granularity for a simulcast. */}
        <div className="dsec">
          {accessible.length ? (
            <div className="dlinks dlinks-watch">
              {/* THE MLB.TV LINK CARRIES A PER-GAME ADDRESS (prompt 81 block F, Joe's tap test
                  2026-09-09). `mlb.com/tv/g<gamePk>` is claimed in MLB's apple-app-site-association
                  and Joe confirmed on the device that iOS hands it to the MLB app; the ordinary
                  `watchUrl()` destination is a web page. `WatchLink` already takes an `href` that
                  overrides `watchUrl(service)` - it is how the DIRECTV link below is built - so this
                  is one prop rather than a new component.

                  ONLY `guardians-tv`, and that is an enumeration rather than an assumption (rule 32).
                  Searched the WATCH map for every value on an mlb.com host: exactly two,
                  `mlb-network` and this one.

                  WHY `mlb-network` IS EXCLUDED, and the ORDER of these two reasons is deliberate.
                  THE ONE THAT CARRIES THE RULING: MLB Network is a LINEAR CABLE CHANNEL, not the
                  per-game MLB.TV product - a deep link to one game is meaningless for a channel that
                  runs a schedule, whatever any manifest says. That reason depends on nothing outside
                  this repo and cannot expire.
                  THE CORROBORATING ONE, AND IT IS A DATED SNAPSHOT: as harvested on 2026-09-07,
                  `/network` was not among the paths MLB's apple-app-site-association claimed
                  (`/magiclink`, `/tv/g*`, `/news/*`, `/dailywalkoff`, `/sponsorship/…`,
                  `/live-stream-games/promotions/*`). MLB can rewrite that file without telling
                  anyone, so it is evidence rather than the reason - if it ever claims `/network`,
                  the ruling above still holds and nothing here needs revisiting.

                  If a second MLB-app service ever appears it takes the same treatment, and the
                  enumeration test fails until it does - mutation-checked by adding a third mlb.com
                  entry to the map.

                  `mlbAppUrl` RETURNS NULL FOR ANYTHING ELSE, and `href={null}` falls through to
                  `watchUrl(service)` inside WatchLink - so a Guardians row on a non-MLB id, or any
                  other service, is byte-for-byte what it was. */}
              {accessible.map((b, i) => (
                <WatchLink key={`${b.service_id}-${b.feed_side}-${b.delivery_surface}`}
                           service={b.service_id}
                           name={b.network?.canonical_name || b.label || b.service_id}
                           href={b.service_id === 'guardians-tv' ? mlbAppUrl(game) : null}
                           big={i === 0} />
              ))}
              {/* ONE DIRECTV LINK PER CARD, and only when something accessible is LINEAR.
                  It was UNCONDITIONAL at this spot and rendered on every game whether or not DIRECTV
                  carried it - the route cannot tune a channel and only opens the app, so on a
                  streamer-only game it was an invitation to a dead end. One per card rather than one
                  per broadcast: a simulcast would otherwise stack three identical DIRECTV links.
                  Cowork's call; Joe can reverse it with a sentence.

                  IT CAN DOUBLE A DESTINATION, and that is as ruled rather than a bug. Joe: "If the
                  network has its own streaming path, that will be the link for the network. If it
                  doesn't then both links go to DIRECTV's path." So a network with no WATCH entry
                  produces two links to the same URL wearing different marks - the network mark says
                  whose broadcast it is, the DIRECTV mark says how he gets there. */}
              {accessible.some(isLinear) ? (
                <WatchLink service="directv" name="DIRECTV" href={DIRECTV_STREAM} big={false} />
              ) : null}
              {boxScore}
            </div>
          ) : (
            <>
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
              {boxScore ? <div className="dlinks">{boxScore}</div> : null}
            </>
          )}
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
