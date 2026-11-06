import assert from 'node:assert/strict';
import {
  COMBO_ROUTES, COMBO_LINK_WINDOW, COMBO_FINISH_RECOVERY,
  comboAllows, comboFinisherUnblockable, comboIsCleanHit,
} from '../src/combat/ComboRules.ts';
import { stopsHit } from '../src/combat/HitRules.ts';

assert.equal(COMBO_ROUTES.length,6,'six distinct three-button routes');
const unique=new Set(COMBO_ROUTES.map(route=>route.join('>')));
assert.equal(unique.size,6,'all routes must be distinct');
for (const route of COMBO_ROUTES) {
  assert.equal(route.length,3);
  assert.deepEqual([...new Set(route)].sort(),['heavy','kick','light'].sort(),
    'combo requires each of X B Y exactly once');
  assert.equal(comboAllows([route[0]],route[1]),true,
    `second strike allowed in ${route.join('>')}`);
  assert.equal(comboAllows(route.slice(0,2),route[2]),true,
    `third strike allowed in ${route.join('>')}`);
  assert.equal(comboAllows([],route[0]),false,'first hit starts a chain');
  assert.equal(comboAllows(route,route[2]),false,'no fourth hit');
  assert.equal(comboAllows([route[0]],route[0]),false,'no repeats');
  assert.equal(comboAllows(route.slice(0,2),route[1]),false,
    'no repeat of the second hit');
}
assert.ok(COMBO_LINK_WINDOW >= .55 && COMBO_LINK_WINDOW <= 1,
  'inputs are timed but achievable on touch');
assert.ok(COMBO_FINISH_RECOVERY >= .3 && COMBO_FINISH_RECOVERY < .6,
  'finisher ends with a short punishable movement and attack lock');
assert.equal(comboIsCleanHit(false,5),true);
assert.equal(comboIsCleanHit(true,0),false,'a blocked strike forfeits unblockability');
assert.equal(comboIsCleanHit(false,0),false,'misses/overkill cannot unlock');
assert.equal(comboFinisherUnblockable(3,true),true,
  'third strike becomes unblockable after two clean impacts');
assert.equal(comboFinisherUnblockable(3,false),false,
  'a blocked/missed earlier hit leaves third guardable');
assert.equal(comboFinisherUnblockable(2,true),false,
  'the second strike is never unblockable');
assert.equal(comboFinisherUnblockable(1,true),false,
  'the opening attack is never unblockable');
for(const guard of ['standing','crouching']){
  for(const level of ['high','mid','low']){
    const ordinaryBlocked=stopsHit(guard,level);
    const finisherBlocked=!comboFinisherUnblockable(3,true) && ordinaryBlocked;
    assert.equal(finisherBlocked,false,
      `combo finisher ignores ${guard} guard for ${level} attack`);
  }
}
console.log('✓ Six 3-hit routes, guard bypass conditions and finisher recovery: passed.');
