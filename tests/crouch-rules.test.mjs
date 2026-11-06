import assert from 'node:assert/strict';
import { crouchMoveForPress, sweepTrips } from '../src/combat/CrouchRules.ts';
import { stopsHit, strikeBand } from '../src/combat/HitRules.ts';

const input = {
  down:true, grounded:true, blocking:false, grabbing:false,
  rolling:false, special:false, light:false, kick:false, heavy:false,
};
const select = patch => crouchMoveForPress({...input,...patch});

// Only two crouching attacks exist. Upper Y and B+Y may not fire or buffer.
assert.equal(select({light:true}), 'sweep', 'Down + X starts a low sweep');
assert.equal(select({kick:true}), 'crouchMid', 'Down + B starts a weak mid jab');
assert.equal(select({heavy:true}), null, 'Down + Y must not attack');
assert.equal(select({kick:true,heavy:true,special:true}), null, 'Down + B+Y is not a crouch move');
assert.equal(select({light:true,kick:true}), null, 'Two overlapping buttons cannot produce a random attack');
assert.equal(select({light:true,heavy:true}), null, 'Heavy plus light is not a crouch sweep');
for (const constraints of [
  {down:false}, {grounded:false}, {blocking:true}, {grabbing:true},
  {rolling:true}, {special:true},
]) {
  assert.equal(select({...constraints,light:true}), null,
    `X is disabled for invalid crouch state: ${JSON.stringify(constraints)}`);
  assert.equal(select({...constraints,kick:true}), null,
    `B is disabled for invalid crouch state: ${JSON.stringify(constraints)}`);
}

// A successful sweep trips standing and crouching targets, but a correct
// crouching guard negates it, and jump/roll escapes remain independent.
assert.equal(stopsHit('standing','low'), false, 'high guard does not stop a low sweep');
assert.equal(stopsHit('crouching','low'), true, 'low guard prevents a trip');
assert.equal(stopsHit('standing','mid'), true, 'standing guard stops crouching B');
assert.equal(stopsHit('crouching','mid'), true, 'low guard stops crouching B');
assert.equal(sweepTrips('sweep',false,false,false),true);
assert.equal(sweepTrips('sweep',true,false,false),false,'blocked sweep does not trip');
assert.equal(sweepTrips('sweep',false,true,false),false,'airborne opponent is not tripped');
assert.equal(sweepTrips('sweep',false,false,true),false,'KO follows the knockout animation');
assert.equal(sweepTrips('crouchMid',false,false,false),false,'weak mid jab never trips');
assert.equal(sweepTrips('light',false,false,false),false,'standing X does not trip');
const low=strikeBand('low'), mid=strikeBand('mid');
const overlap=(a,b)=>a.top < b.bottom && a.top+a.height > b.top;
const crouchedHurt={top:-73,bottom:-1};
assert.ok(overlap(low,crouchedHurt),'sweep reaches crouched opponents');
assert.ok(overlap(mid,crouchedHurt),'weak mid jab reaches crouched opponents');
console.log('✓ Crouch attacks, standing-only high, guard and sweep knockdown: passed.');
