import assert from 'node:assert/strict';
import { canBeGrabbed, blockedGrabRecoil } from '../src/combat/GrabRules.ts';

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

// A blocked grab pushes the grappler AWAY from their opponent on both sides.
assert.equal(blockedGrabRecoil(260,340,1),-170,
  'a defender on the right pushes the attacker left');
assert.equal(blockedGrabRecoil(760,680,-1),170,
  'a defender on the left pushes the attacker right');
assert.equal(blockedGrabRecoil(400,400,1),-170,
  'identical positions use facing for a deterministic away direction');
assert.equal(blockedGrabRecoil(400,400,-1),170,
  'opposite facing at identical positions also pushes away');
for(const [attacker,defender,face] of [[300,410,1],[700,530,-1]]){
  const velocity=blockedGrabRecoil(attacker,defender,face);
  const step=1/60;
  let traveled=0,v=velocity;
  // Simulate the game's decaying impact velocity over the 0.34 s recovery.
  for(let i=0;i<21;i++){
    traveled+=v*step;
    v*=Math.pow(.055,step);
  }
  assert.ok(Math.abs(traveled)>30 && Math.abs(traveled)<50,
    'guard recoil should move the attacker a small but visible distance');
  assert.equal(Math.sign(traveled),Math.sign(velocity));
}
console.log('✓ Grab rules + blocked-grab recoil direction and travel: passed.');
