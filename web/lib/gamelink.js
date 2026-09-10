// THE GAME LINK - one link, one destination per sport, and the label follows the state (prompt 86,
// Joe's ruling 2026-09-10).
//
// The URL is the game's own page and never changes with the state: ESPN's game page for cfb/nfl/nba
// resolves preview -> gamecast -> recap by itself, and MLB's Gameday and the NHL's GameCenter
// already did. So only the WORDS move, and they move here:
//
//   in_progress -> Live box score     final -> Box score     anything else -> Preview
//
// THE URL SHAPES ARE NOT HERE AND MUST NOT BE. `pipeline/load.py`'s `_BOXSCORE` is their one owner
// (prompt 78's ruling: the same mapping in two languages drifts), and `livejoin.test.mjs` forbids
// them in this file. This module only reads the stored `boxscore_url`.
//
// A PURE FUNCTION, SO THE JS GATE CAN RUN IT (rule 24). The labels used to live inline in
// GameDetail's JSX, where the only possible test was a regex over the source.

import { isProgram } from './programs.js';

export const GAME_LINK_LABEL = Object.freeze({
  in_progress: 'Live box score',
  final: 'Box score',
});
export const PREVIEW_LABEL = 'Preview';

/**
 * `{ href, label }` for a game's own page, or null.
 *
 * NULL WITHOUT A STORED URL, in every state. Rows written before prompt 86's loader change and not
 * yet refreshed have none, and a link to nothing is worse than no link - it fills in on the next
 * refresh rather than rendering broken. That is prompt 78's argument for the guard, and it survives
 * the state gate's removal unchanged.
 *
 * NULL FOR A PROGRAM, always. `boxscore_url` is a column on `games` and the `programs` table has no
 * such column, so a program cannot carry one by construction; this makes the same property hold even
 * if a program row were ever handed a stray field.
 */
export function gameLink(row) {
  if (!row || isProgram(row) || !row.boxscore_url) return null;
  return { href: row.boxscore_url, label: GAME_LINK_LABEL[row.result_status] || PREVIEW_LABEL };
}
