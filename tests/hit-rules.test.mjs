import assert from 'node:assert/strict';
import { stopsHit, strikeBand, isBackStrike, strikeDamage, BACK_STRIKE_MULTIPLIER } from '../src/combat/HitRules.ts';

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
assert.equal(BACK_STRIKE_MULTIPLIER,1.5);
assert.equal(isBackStrike(90,100,1),true,'left side of a right-facing guard is exposed');
assert.equal(isBackStrike(110,100,1),false,'right side is the guarded front');
assert.equal(isBackStrike(110,100,-1),true,'right side of a left-facing guard is exposed');
assert.equal(isBackStrike(90,100,-1),false,'left side is the guarded front');
assert.equal(strikeDamage(11,false,false),11);
assert.equal(strikeDamage(11,true,false),17,'11 damage becomes 17 behind');
assert.equal(strikeDamage(20,false,true),10,'blocked special deals half damage');
assert.equal(strikeDamage(23,false,true),12,'odd special damage rounds up');
assert.equal(strikeDamage(20,true,false),30,'special behind deals full boosted damage');
console.log('✓ Guard directions, 1.5x back-hit bonus and half-damage guard break: passed.');
console.log('✓ Hit-level guard matrix and hitbox geometry: all assertions passed.');
