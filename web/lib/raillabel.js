// Rail labels for the mobile grid (fix round 2026-09-03, item 5).
//
// The rail tile is 69pt wide. A network with a published mark shows the mark; a network without one -
// every out-of-market RSN - shows its NAME, and that name has to survive the tile intact.
//
// The old behaviour was a single line with `text-overflow: ellipsis`, which produced "Marlins.T...",
// "Cardinals...", "Chicago ..." - a mid-word cut that tells the reader nothing. **No name may render
// with an ellipsis in the rail.** Instead the name is reduced the way a person would say it:
//
//   1. drop everything from a sponsor clause on  ("Marlins.TV presented by Werner, Hoffman, Greig &
//      Garcia" -> "Marlins.TV", "Cardinals.TV Presented by bet365" -> "Cardinals.TV");
//   2. drop trailing generic words that carry no identity once space is short (Network, Sports
//      Network, Sports, TV) - but never the whole name;
//   3. pack the remaining words into at most TWO lines of at most 10 characters, breaking only at word
//      boundaries;
//   4. if a single word is still longer than the line, use its own abbreviation - the leading capitals
//      when it has them, otherwise a hard truncation WITHOUT an ellipsis, which at least reads as a
//      shortening rather than a mistake.

const LINE_MAX = 10;
const MAX_LINES = 2;

/** Everything from a sponsor clause onward is not part of the network's name. */
export function stripSponsor(name) {
  return String(name || '')
    .replace(/[,(]?\s*\bpresented\s+by\b.*$/i, '')
    .replace(/[,(]?\s*\bsponsored\s+by\b.*$/i, '')
    .replace(/[,(]?\s*\bin\s+association\s+with\b.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Split into words. A DOT is a word boundary too: "Marlins.TV" is two words, not one, and treating it
 * as one produced "MTV" from Mariners.TV - the initials of a different network entirely.
 */
function words(name) {
  return name.split(/[\s.]+/).filter(Boolean);
}

/**
 * Trailing words that add nothing once the tile is this narrow. Never returns an empty list, and never
 * strips a word ending in '+': SEC Network+ is not SEC Network, and the '+' is the whole difference.
 */
function trimGeneric(list) {
  const generic = new Set(['network', 'networks', 'sports', 'tv', 'channel', 'home']);
  const out = list.slice();
  while (out.length > 1) {
    const last = out[out.length - 1];
    if (last.endsWith('+') || !generic.has(last.toLowerCase().replace(/[^a-z]/g, ''))) break;
    out.pop();
  }
  return out;
}

/**
 * A single word too long for a line: prefer its own internal capitals ("SportsNetPittsburgh" style),
 * else a hard cut - never an ellipsis. Only reached for one unbroken word, so it cannot manufacture
 * initials across a name the way splitting on dots used to.
 */
function shortenWord(word) {
  if (word.length <= LINE_MAX) return word;
  const caps = word.replace(/[^A-Z0-9]/g, '');
  if (caps.length >= 3 && caps.length <= LINE_MAX) return caps;
  return word.slice(0, LINE_MAX);
}

/**
 * -> array of at most two lines, each at most LINE_MAX characters, no ellipsis anywhere.
 * "NBCS BA" -> ["NBCS BA"], "Chicago Sports Network" -> ["Chicago"], "Marlins.TV presented by ..." ->
 * ["Marlins.TV"], "Space City Home Network" -> ["Space City"].
 */
export function railLabel(name) {
  const cleaned = stripSponsor(name);
  if (!cleaned) return [];

  // a name that already fits is left exactly alone
  if (cleaned.length <= LINE_MAX) return [cleaned];

  const parts = trimGeneric(words(cleaned));
  if (parts.length === 1) return [shortenWord(parts[0])];

  const lines = [];
  let current = '';
  for (const raw of parts) {
    const word = shortenWord(raw);
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= LINE_MAX) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === MAX_LINES) break;
    }
  }
  if (lines.length < MAX_LINES && current) lines.push(current);
  return lines.slice(0, MAX_LINES);
}
