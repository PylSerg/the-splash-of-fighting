import assert from 'node:assert/strict';
import { stopsHit, strikeBand } from '../src/combat/HitRules.ts';

const expected = {
  standing: { high: true, mid: true, low: false },
  crouching: { high: false, mid: true, low: true },
  none: { high: false, mid: false, low: false },
};
for (const [stance, levels] of Object.entries(expected)) {
  for (const [level, blocked] of Object.entries(levels)) {
    assert.equal(stopsHit(stance, level), blocked,
      `${stance} guard vs ${level}: expected ${blocked}`);
  }
}
// Relative-to-ground geometry: crouching hurtbox top is -73, so high hits
// standing fighters but must pass cleanly over crouching fighters.
const hurtboxes = {
  standing: { top: -145, bottom: -3 },
  crouching: { top: -73, bottom: -1 },
};
function hitsVertically(level, stance) {
  const band = strikeBand(level);
  const hurt = hurtboxes[stance];
  return band.top < hurt.bottom && band.top + band.height > hurt.top;
}
assert.equal(hitsVertically('high','standing'), true);
assert.equal(hitsVertically('high','crouching'), false);
for (const level of ['mid','low']) {
  assert.equal(hitsVertically(level,'standing'), true);
  assert.equal(hitsVertically(level,'crouching'), true);
}
for (const level of ['high','mid','low']) {
  assert.ok(strikeBand(level).height > 0,
    `${level} hitbox must have positive height`);
}
console.log('✓ Hit-level guard matrix and hitbox geometry: all assertions passed.');
