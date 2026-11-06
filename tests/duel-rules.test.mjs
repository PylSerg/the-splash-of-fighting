import assert from 'node:assert/strict';
import {
  forwardHeld, resolveDuel, chooseDuelInput, duelDamage, canDuelCatchTarget,
  DUEL_DURATION, DUEL_WHIFF_RECOVERY, DUEL_RESULT_ANIMATION, DUEL_GUARD_STUN,
  DUEL_DAMAGE, DUEL_RUNA_DAMAGE,
  DUEL_TIE_PUSH, DUEL_GUARD_PUSH,
} from '../src/combat/DuelRules.ts';

assert.equal(DUEL_DURATION,2,'duel selection lasts exactly two seconds');
assert.equal(DUEL_WHIFF_RECOVERY,.3,'a missing challenge causes 300ms recovery');
assert.equal(DUEL_RESULT_ANIMATION,.55,
  'both hidden choices need a full synchronized visual strike before HP changes');
assert.equal(DUEL_GUARD_STUN,.5,
  'a successful defensive A stuns the attacker for a full half-second');
assert.ok(DUEL_RESULT_ANIMATION>DUEL_WHIFF_RECOVERY,
  'the resolving cinematic should have enough frames to display both attacks');
assert.ok(DUEL_GUARD_PUSH>DUEL_TIE_PUSH,'defensive block pushes much farther than equal moves');
assert.equal(duelDamage(false),DUEL_DAMAGE);
assert.equal(duelDamage(true),DUEL_RUNA_DAMAGE);
assert.ok(DUEL_DAMAGE>11 && DUEL_RUNA_DAMAGE>14,'duel deals elevated damage');

// Forward is relative to the fighter, not an absolute screen direction.
assert.equal(forwardHeld(1,false,true),true);
assert.equal(forwardHeld(-1,true,false),true);
assert.equal(forwardHeld(1,true,false),false);
assert.equal(forwardHeld(-1,false,true),false);
assert.equal(forwardHeld(1,true,true),false);
assert.equal(forwardHeld(-1,false,false),false);

const wins={heavy:'light',light:'kick',kick:'heavy'};
for(const a of ['heavy','light','kick']){
  assert.equal(resolveDuel(a,a),'tie',a+' versus itself is knockback only');
  for(const d of ['heavy','light','kick']){
    assert.equal(resolveDuel(a,d),a===d?'tie':wins[a]===d?'attacker':'defender',
      a+' vs '+d+' follows triangle Y > X > B > Y');
  }
  assert.equal(resolveDuel(a,'block'),'guard',
    'defender may always block and repel an incoming attack');
  assert.equal(resolveDuel(a,null),'attacker',
    'a valid attack wins against an absent choice');
}
for(const d of ['heavy','light','kick'])
  assert.equal(resolveDuel(null,d),'defender',
    'defender attacks successfully if attacker does not choose');
assert.equal(resolveDuel(null,null),'tie','no choice by either fighter is a draw');
assert.equal(resolveDuel(null,'block'),'guard','defensive A is honored even if attacker times out');

// The defender can choose A; the attacker can never choose block.
const keys={light:false,heavy:false,kick:false,block:true};
assert.equal(chooseDuelInput(keys,true),'block');
assert.equal(chooseDuelInput(keys,false),null);
assert.equal(chooseDuelInput({...keys,heavy:true},true),'block',
  'simultaneous defender A has precedence');
assert.equal(chooseDuelInput({...keys,block:false,heavy:true},false),'heavy');
assert.equal(chooseDuelInput({...keys,block:false,light:true},true),'light');
assert.equal(chooseDuelInput({...keys,block:false,kick:true},false),'kick');
assert.equal(chooseDuelInput({...keys,block:false},true),null,
  'unselected input stays private until resolution');
// A duel opener is a non-damaging high challenge, not an automatic
// cutscene. Only a standing IDLE or ordinary horizontal walking target
// may be challenged. Every other combat state must count as a MISS.
const upright={
  airborne:false,crouching:false,isRolling:false,
  knockedDown:false,knockedOut:false,blocking:false,
  attackActive:false,grabActive:false,stunned:0,grabRecovery:0,
  comboRecovering:false,duelRecovering:false,recoiling:false,
  walking:false,
};
assert.equal(canDuelCatchTarget(upright),true,'idle grounded defender is duel eligible');
for(const side of ['forward','backward']){
  assert.equal(canDuelCatchTarget({...upright,walking:true,direction:side}),true,
    `walking ${side} never prevents a duel`);
}
// An already raised guard is NOT standing idle: A must be picked INSIDE
// the duel, not held before the zero-damage challenge connects.
for(const [description,patch] of [
  ['crouching',{crouching:true}],
  ['jumping',{airborne:true}],
  ['rolling',{isRolling:true}],
  ['knocked down',{knockedDown:true}],
  ['knocked out',{knockedOut:true}],
  ['standing block',{blocking:true}],
  ['regular attack',{attackActive:true}],
  ['special attack',{attackActive:true,walking:true}],
  ['crouch attack',{attackActive:true,crouching:true}],
  ['opponent duel starter',{attackActive:true}],
  ['grabbing or grabbed',{grabActive:true}],
  ['stunned',{stunned:.15}],
  ['grab recovery',{grabRecovery:.30}],
  ['three-hit combo recovery',{comboRecovering:true}],
  ['duel miss recovery',{duelRecovering:true}],
  ['still being pushed back',{recoiling:true}],
]){
  assert.equal(canDuelCatchTarget({...upright,...patch}),false,
    `${description} must count as missed duel`);
}
// Contact evaluation and full-animation completion BOTH use the same rule.
// Invalidating once must persist, even if the target returns to idle.
let challengeContact=canDuelCatchTarget({...upright,walking:true});
challengeContact=challengeContact && canDuelCatchTarget({...upright,airborne:true});
challengeContact=challengeContact && canDuelCatchTarget(upright);
assert.equal(challengeContact,false,'jump during follow-through permanently forfeits duel');
challengeContact=canDuelCatchTarget(upright);
challengeContact=challengeContact && canDuelCatchTarget({...upright,crouching:true});
challengeContact=challengeContact && canDuelCatchTarget({...upright,walking:true});
assert.equal(challengeContact,false,'crouch then stand cannot restore a missed duel');

console.log('✓ Duel target eligibility: standing/walking only; all other states miss.');
console.log('✓ Duel triangle, defensive A, input timing and mirrored forward direction: passed.');
