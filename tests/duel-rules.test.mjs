import assert from 'node:assert/strict';
import {
  forwardHeld, resolveDuel, chooseDuelInput, duelDamage,
  DUEL_DURATION, DUEL_WHIFF_RECOVERY, DUEL_DAMAGE, DUEL_RUNA_DAMAGE,
  DUEL_TIE_PUSH, DUEL_GUARD_PUSH,
} from '../src/combat/DuelRules.ts';

assert.equal(DUEL_DURATION,2,'duel selection lasts exactly two seconds');
assert.equal(DUEL_WHIFF_RECOVERY,.3,'a missing challenge causes 300ms recovery');
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
console.log('✓ Duel triangle, defensive A, input timing and mirrored forward direction: passed.');
