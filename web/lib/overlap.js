// The overlap rule (Joe, 2026-09-03) - rendering contract v1.6.5.
//
// Two programs on the same network row whose blocks overlap SPLIT THE DIFFERENCE: the earlier one's
// end and the later one's start each move by half the overlap, meeting at its midpoint, so they sit
// side by side in ONE row instead of forcing a second lane. A 12:30 kickoff ending 4:00 and a 3:30
// kickoff ending 7:00 both become 3:45.
//
// Why it matters: block lengths are POLICY, not measurement - every CFB game is drawn 210 minutes
// wide whatever it actually runs. So a 12:30 and a 3:30 on the same network "overlap" by 30 minutes
// purely as an artefact of that estimate, and that artefact alone was generating a whole extra row.
//
// THREE LIMITS, each there to stop the rule hiding something real:
//   * over 60 minutes of overlap -> second row. That much is not an estimate artefact.
//   * three or more mutually overlapping -> lanes. A network airs one thing at a time, so a
//     three-way overlap means the estimates are wrong, and three squeezed chips would hide it.
//   * either chip would fall under 60 minutes wide -> second row. A chip too narrow to show its
//     matchup is worse than an extra row.
//
// PRESENTATIONAL ONLY. It changes the rendered block, never canonical_kickoff_at_utc, never
// block_minutes, never anything written to the database. The detail panel still shows real times.
//
// Mirrored exactly by pipeline/overlap.py for the archived PC grid, and pinned to it by the shared
// fixtures in tests/fixtures/overlap_cases.json.

export const MAX_SPLIT_MIN = 60;
export const MIN_CHIP_MIN = 60;

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

/**
 * @param {Array<{start:number,end:number}>} items one network row's blocks, minutes
 * @returns {{items:Array, split:Array<[number,number]>, guarded:Array<[number,number]>}}
 *          `items` is a new array in the input's order; split/guarded are index pairs.
 */
export function splitOverlaps(items, { maxSplitMin = MAX_SPLIT_MIN, minChipMin = MIN_CHIP_MIN } = {}) {
  const rows = Array.isArray(items) ? items : [];
  const out = rows.map((it) => ({ ...it }));
  const order = out.map((it, i) => i).sort((x, y) => out[x].start - out[y].start || out[x].end - out[y].end);

  // Any block overlapping two or more others is out of the pairwise rule entirely, and so is
  // everything it overlaps - a chain of three cannot be resolved two at a time.
  const blocked = new Set();
  for (const i of order) {
    const partners = order.filter((j) => j !== i && overlaps(out[i], out[j]));
    if (partners.length >= 2) {
      blocked.add(i);
      for (const j of partners) blocked.add(j);
    }
  }

  const split = [];
  const guarded = [];
  for (let k = 0; k < order.length - 1; k += 1) {
    const i = order[k];
    const j = order[k + 1];
    if (blocked.has(i) || blocked.has(j)) continue;
    const a = out[i];
    const b = out[j];
    if (!(a.end > b.start)) continue;                 // no overlap
    const ov = a.end - b.start;
    if (ov > maxSplitMin) continue;                   // too much to be an estimate artefact
    // floor, so Python's // and JavaScript's Math.floor land on the same minute
    const mid = Math.floor((a.end + b.start) / 2);
    if (mid - a.start < minChipMin || b.end - mid < minChipMin) {
      guarded.push([i, j]);
      continue;
    }
    a.end = mid;
    b.start = mid;
    split.push([i, j]);
  }
  return { items: out, split, guarded };
}
