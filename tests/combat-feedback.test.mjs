import assert from 'node:assert/strict';
import {
  earnSpecialMeter, makeHealthTrail, advanceHealthTrail, healthFillRect,
  SPECIAL_MIN_CHARGE, METER_PER_DAMAGE, HEALTH_TRAIL_TOTAL, HEALTH_TRAIL_HOLD, MAX_HEALTH,
} from '../src/combat/CombatFeedback.ts';

assert.equal(MAX_HEALTH,200,'fighter HP doubles without altering strike damage');
assert.equal(SPECIAL_MIN_CHARGE, 15);
assert.equal(METER_PER_DAMAGE, 0.6);
assert.equal(earnSpecialMeter(0, 5), 3, 'a real light hit awards damage-proportional meter');
assert.equal(earnSpecialMeter(0, 20), 12, 'a heavy or special hit earns more proportionally');
assert.equal(earnSpecialMeter(10, 0), 10, 'no gain for blocked, missed or dodged attacks');
assert.equal(earnSpecialMeter(10, -3), 10, 'no meter from negative HP changes');
assert.equal(earnSpecialMeter(95, 20), 100, 'meter does not overflow maximum');
assert.ok(earnSpecialMeter(0, 24)<SPECIAL_MIN_CHARGE,
  '24 HP damage is not yet enough for a 15% special');
assert.ok(earnSpecialMeter(0, 25)>=SPECIAL_MIN_CHARGE,
  '25 HP damage earns the first stage of the special');

// 100 -> 80 HP creates a 20 HP red segment that holds for 350 ms.
let hp=makeHealthTrail(100);
assert.deepEqual(hp,{displayed:100,target:100,from:100,elapsed:HEALTH_TRAIL_TOTAL});
hp=advanceHealthTrail(hp,80,1/60);
assert.equal(hp.displayed,100);
assert.equal(hp.target,80);
hp=advanceHealthTrail(hp,80,HEALTH_TRAIL_HOLD);
assert.equal(hp.displayed,100,'red damage remains for the initial 350 ms');
hp=advanceHealthTrail(hp,80,(HEALTH_TRAIL_TOTAL-HEALTH_TRAIL_HOLD)/2);
assert.ok(hp.displayed>80 && hp.displayed<100,'trail eases toward actual health');
hp=advanceHealthTrail(hp,80,HEALTH_TRAIL_TOTAL);
assert.equal(hp.displayed,80,'no ghost damage after the 0.5-second delay');

// A second incoming hit resets the delay and keeps the old red exposure.
hp=makeHealthTrail(100);
hp=advanceHealthTrail(hp,80,0);
hp=advanceHealthTrail(hp,80,0.425);
assert.ok(Math.abs(hp.displayed-90)<1e-7);
hp=advanceHealthTrail(hp,60,0);
assert.ok(Math.abs(hp.displayed-90)<1e-7);
assert.equal(hp.target,60);
hp=advanceHealthTrail(hp,60,0.2);
assert.ok(Math.abs(hp.displayed-90)<1e-7);
hp=advanceHealthTrail(hp,60,0.5);
assert.equal(hp.displayed,60);
hp=advanceHealthTrail(hp,100,0);
assert.equal(hp.displayed,100,'healing/round reset has no red trail');

// The new 200 HP maximum must not clamp away the extra 100 points.
let doubleHealth=makeHealthTrail(MAX_HEALTH);
doubleHealth=advanceHealthTrail(doubleHealth,175,0);
assert.equal(doubleHealth.displayed,MAX_HEALTH);
assert.equal(doubleHealth.target,175);
doubleHealth=advanceHealthTrail(doubleHealth,MAX_HEALTH,0);
assert.equal(doubleHealth.displayed,MAX_HEALTH,'new round fully restores 200 HP');
assert.equal(advanceHealthTrail(doubleHealth,250,0).target,MAX_HEALTH,
  'health trails clamp at the new maximum');

// P1 bar empties from right, P2 from left; red is visible only in lost zone.
const p1=healthFillRect(112,300,80,false);
const p1ghost=healthFillRect(112,300,100,false);
assert.deepEqual(p1,{x:112,width:240});
assert.deepEqual(p1ghost,{x:112,width:300});
const p2=healthFillRect(548,300,80,true);
const p2ghost=healthFillRect(548,300,100,true);
assert.deepEqual(p2,{x:608,width:240});
assert.deepEqual(p2ghost,{x:548,width:300});
const halfHealth=MAX_HEALTH/2;
assert.equal(healthFillRect(112,300,halfHealth/MAX_HEALTH*100,false).width,150,
  'HUD must normalize 100/200 HP to a half-filled bar');
console.log('✓ Meter economy and both 0.5s red health trails: passed.');
