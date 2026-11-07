import assert from 'node:assert/strict';
import { stopsHit, strikeBand, fighterHurtboxBand, FIGHTER_HURTBOX, isBackStrike, strikeDamage, canAutoTurn, BACK_STRIKE_MULTIPLIER, STANDING_ATTACK_LANES } from '../src/combat/HitRules.ts';

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
// The enlarged 2D sprites now include the HEAD above the previous green box.
// These are actual shared Fighter hurtbox dimensions, not a second mock shape.
const standing=fighterHurtboxBand(false);
const crouching=fighterHurtboxBand(true);
assert.deepEqual(standing,{halfWidth:32,top:-222,height:220},
  'upright hitbox reaches the head of the larger Evi AND Runa');
assert.deepEqual(crouching,{halfWidth:29,top:-84,height:83},
  'crouch and roll have the smaller, lower hitbox');
assert.equal(FIGHTER_HURTBOX.standing.bottom,-2);
assert.equal(FIGHTER_HURTBOX.low.bottom,-1);
assert.ok(standing.halfWidth>25,'wider sprites deserve a wider active body collider');
assert.ok(standing.top<=-220,'upright head must be inside the hurtbox');
function hitsVertically(level,stance) {
  const band=strikeBand(level);
  const hurt=stance==='standing'?standing:crouching;
  return band.top<hurt.top+hurt.height && band.top+band.height>hurt.top;
}
const high=strikeBand('high');
assert.equal(high.top,-232,'Y attack begins above the full head silhouette');
assert.equal(high.top+high.height,-92,
  'high attack ends above the crouched head');
assert.ok(high.top+high.height<crouching.top,
  'standing Y attack must still MISS a ducking or rolling fighter');
assert.equal(hitsVertically('high','standing'),true,
  'high blows now touch an upright fighter at head height');
assert.equal(hitsVertically('high','crouching'),false,
  'ducking under Y stays possible, even after the sprite resize');
for(const level of ['mid','low']){
  assert.equal(hitsVertically(level,'standing'),true);
  assert.equal(hitsVertically(level,'crouching'),true);
}
assert.deepEqual(strikeBand('mid'),{top:-127,height:100},
  'X attack scales vertically with the torso of the larger fighters');
assert.deepEqual(strikeBand('low'),{top:-67,height:65},
  'B attack reaches lower legs but stops at the feet');
for (const level of ['high','mid','low']) {
  assert.ok(strikeBand(level).height > 0,
    `${level} hitbox must have positive height`);
}
const guardInputs={block:true,left:false,right:false,up:false};
assert.equal(canAutoTurn(1,guardInputs,false,0,false),false,
  'standing guard may not auto-turn to a rolling attacker behind');
assert.equal(canAutoTurn(-1,{...guardInputs,up:false},false,0,false),false);
assert.equal(canAutoTurn(1,{...guardInputs,right:false,left:true},false,0,false),false,
  'retreating guard also keeps its direction');
assert.equal(canAutoTurn(1,{...guardInputs,block:false},false,0,false),true,
  'releasing the guard permits an immediate turn');
assert.equal(canAutoTurn(1,{...guardInputs,right:true},false,0,false),true,
  'a forward-moving input is not an active defensive stance');
assert.deepEqual(STANDING_ATTACK_LANES,{heavy:'high',light:'mid',kick:'low'},
  'Y high, X mid, B low for all fighters');
assert.equal(stopsHit('standing',STANDING_ATTACK_LANES.kick),false,
  'standing block cannot guard B');
assert.equal(stopsHit('crouching',STANDING_ATTACK_LANES.kick),true,
  'crouching block guards B');
assert.equal(stopsHit('crouching',STANDING_ATTACK_LANES.light),true,
  'crouching block guards X');
assert.equal(stopsHit('crouching',STANDING_ATTACK_LANES.heavy),false,
  'high Y clears crouching targets');
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
