import assert from 'node:assert/strict';
import { canBeGrabbed } from '../src/combat/GrabRules.ts';

const standing={
  crouching:false, airborne:false, knockedDown:false, knockedOut:false, isRolling:false,
};
const neutral={down:false,up:false,jump:false};
assert.equal(canBeGrabbed(standing,neutral),true,'stationary upright target can be grabbed');

// Horizontal walking does not appear in GrabTargetIntent on purpose:
// moving forward/back is equally capturable.
for(const direction of ['left','right']){
  assert.equal(canBeGrabbed({...standing,walking:direction},neutral),true,
    `standing target walking ${direction} must be capturable`);
}

for(const [label,change] of [
  ['crouched target',{crouching:true}],
  ['jumping target',{airborne:true}],
  ['knocked down target',{knockedDown:true}],
  ['knocked out target',{knockedOut:true}],
  ['rolling target',{isRolling:true}],
]){
  assert.equal(canBeGrabbed({...standing,...change},neutral),false,
    `${label} must avoid a grab`);
}

for(const [label,input] of [
  ['new crouch',{...neutral,down:true}],
  ['new joystick jump',{...neutral,up:true}],
  ['new jump button',{...neutral,jump:true}],
  ['forward+down diagonal',{...neutral,down:true,right:true}],
  ['back+up diagonal',{...neutral,up:true,left:true}],
]){
  assert.equal(canBeGrabbed(standing,input),false,
    `${label} must avoid grab even on its first frame`);
}
assert.equal(canBeGrabbed({...standing,crouching:true},
  {...neutral,down:false}),false,'releasing down must not erase an ongoing crouch');
assert.equal(canBeGrabbed({...standing,airborne:true},
  {...neutral,up:false}),false,'releasing jump must not erase ongoing airtime');

console.log('✓ Grab targets: standing/walking allowed; crouch, jump, rolls and input edges rejected.');
