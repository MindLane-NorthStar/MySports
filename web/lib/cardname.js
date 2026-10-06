// THE NAME A CARD PRINTS FOR A TEAM (prompt 127).
//
// It lived in components/MatchupCard.js, which still re-exports it under the same name, so
// GameDetail and MobileGrid import it from there unchanged. It moved because that file is JSX and
// `node --test` cannot import it, and app/api/my-games/route.js has to print the card's own name
// rather than a second copy of the rule - the same move prompt 126 made for `cardBroadcast`.

/** display_name is the media-standard short form; short_name is the fallback. Never the full name. */
export function cardName(team, fallbackId) {
  return team?.display_name || team?.short_name || team?.canonical_name || team?.abbreviation || fallbackId || 'TBD';
}
