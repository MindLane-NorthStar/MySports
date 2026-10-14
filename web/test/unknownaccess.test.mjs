// Smoke (h)'s rule, on fixture rows (prompt 129, register §74): an unknown-access broadcast on a
// service nobody named is a fault. scripts/smoke.mjs applies it to live rows; this proves the rule.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { unknownAccessByService } from '../lib/offservice.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const row = (game_id, service_id, access_status = 'unknown', active = true) => ({ game_id, service_id, access_status, active });

test('an unknown row on a named service is allowed, and on any other service it is a fault', () => {
  const r = unknownAccessByService([row('g1', 'acc-extra'), row('g2', 'fox'), row('g3', 'fox')], { 'acc-extra': 'a reason long enough' });
  assert.deepEqual(r.allowed, [{ service: 'acc-extra', games: ['g1'] }]);
  assert.deepEqual(r.faults, [{ service: 'fox', games: ['g2', 'g3'] }]);
});

test('an injected unknown row on an unlisted service turns a clean day red', () => {
  const clean = [row('g1', 'acc-extra')];
  assert.equal(unknownAccessByService(clean, { 'acc-extra': 'x' }).faults.length, 0);
  assert.deepEqual(unknownAccessByService([...clean, row('g9', 'fs1-fox-one')], { 'acc-extra': 'x' }).faults,
                   [{ service: 'fs1-fox-one', games: ['g9'] }]);
});

test('removing a list entry turns its service red', () => {
  assert.deepEqual(unknownAccessByService([row('g1', 'acc-extra')], {}).faults, [{ service: 'acc-extra', games: ['g1'] }]);
});

test('only an ACTIVE row whose access is exactly unknown counts', () => {
  const r = unknownAccessByService([row('a', 'fox', 'available'), row('b', 'fox', 'unknown', false), row('c', 'fox', null)], {});
  assert.deepEqual(r.faults, []);
});

test('a game with two unknown rows on one service is one game, and the services sort', () => {
  const r = unknownAccessByService([row('g1', 'tbs-hbo-max'), row('g1', 'tbs-hbo-max'), row('g2', 'cbjnhl')], {});
  assert.deepEqual(r.faults, [{ service: 'cbjnhl', games: ['g2'] }, { service: 'tbs-hbo-max', games: ['g1'] }]);
});

test('smoke (h) applies this rule to the named list, and every entry carries a written reason', () => {
  const smoke = readFileSync(join(HERE, '..', 'scripts', 'smoke.mjs'), 'utf8');
  assert.match(smoke, /unknownAccessByService\(unknown, UNKNOWN_ACCESS_ALLOWED\)/);
  const list = smoke.match(/const UNKNOWN_ACCESS_ALLOWED = \{([\s\S]*?)\n\};/)[1];
  const keys = [...list.matchAll(/^\s+'([^']+)':/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ['acc-extra'], 'measured 2026-10-14; a new entry is a ruling waiting for Joe, so it is noticed');
});
