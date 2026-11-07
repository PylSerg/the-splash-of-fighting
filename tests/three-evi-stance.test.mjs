import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  EVI_FIGHT_YAW,EVI_FRONT_FOOT_Z,EVI_REAR_FOOT_Z,
  EVI_STANCE_LEAD,EVI_STANCE_REAR,
  threeEviStance,threeStanceForwardX,
} from '../src/three/ThreeEviStance.ts';

assert.ok(EVI_FIGHT_YAW>.9 && EVI_FIGHT_YAW<1.22,
  'the 3D fighter must be meaningfully turned toward enemy, not camera');
assert.equal(EVI_STANCE_LEAD,'right');
assert.equal(EVI_STANCE_REAR,'left');
assert.ok(EVI_FRONT_FOOT_Z>0 && EVI_REAR_FOOT_Z<0,
  'leading leg is genuinely staggered forward in model space');

const idle={name:'idle',time:0};
const walk={name:'walk',time:.35,backwards:false};
const guard={name:'guard',time:.35};
const low={name:'guardLow',time:.35};
const high={name:'heavy',time:.35,elapsed:.42,startup:.42,duration:.9};
const special={name:'special',time:.35,elapsed:.55,startup:.42,duration:.9};
const states=[idle,walk,guard,low,high,special,
  {name:'crouch',time:0},{name:'jump',time:.4},
  {name:'roll',time:.3,progress:.45}];

for(const state of states){
  const right=threeEviStance(1,state);
  const left=threeEviStance(-1,state);
  assert.ok(threeStanceForwardX(1,state)>.77,
    state.name+' must point noticeably RIGHT toward rival, not into lens');
  assert.ok(threeStanceForwardX(-1,state)<-.77,
    state.name+' must point noticeably LEFT toward rival, not into lens');
  assert.ok(Math.abs(right.rootYaw+left.rootYaw)<1e-12,
    'root yaw must mirror automatically for both play directions');
  assert.ok(right.leadHipDepth>.06 && right.rearHipDepth<-.06,
    state.name+' needs front and rear leg separation');
  assert.ok(right.leadArmPitch<right.rearArmPitch-.20,
    'fan arm should be the leading arm, opposite hand guards');
  assert.ok(right.leadFootYaw>0 && right.rearFootYaw<0,
    'feet must not be parallel to camera');
  assert.ok(right.pelvisYaw!==right.chestYaw && right.chestYaw!==right.headYaw,
    'hips, chest and head must not share a single front-facing rotation');
  assert.ok(Math.abs(right.fanYaw)>.5,
    'fan must compensate torso and body yaw to face opponent');
  for(const [k,v] of Object.entries(right))
    assert.ok(Number.isFinite(v),'valid stance pose '+state.name+':'+k);
  assert.deepEqual({...right,rootYaw:-right.rootYaw},left,
    'left-facing fighter must mirror while preserving joint stance');
}
const right=threeEviStance(1,idle);
assert.ok(Math.abs(right.pelvisYaw+right.chestYaw+right.headYaw)>.05);
assert.ok(right.chestYaw<0 && right.headYaw>0,
  'shoulders rotate open, head turns back to track the enemy');
const forward=Math.sin(EVI_FIGHT_YAW);
const lateral=Math.cos(EVI_FIGHT_YAW);
const leadFootX=lateral*.142+forward*right.leadHipDepth;
const rearFootX=lateral*(-.142)+forward*right.rearHipDepth;
assert.ok(leadFootX-rearFootX>.32,
  'feet form a readable forward/backward stagger on-screen');
assert.ok(threeEviStance(1,high).chestYaw>right.chestYaw,
  'shoulders rotate INTO horizontal Y attack without changing collision');
assert.ok(threeEviStance(1,special).leadArmPitch<right.leadArmPitch,
  'fan-side arm extends further for charged special');

const renderer=readFileSync(new URL('../src/three/ThreeEviLayer.ts',import.meta.url),'utf8');
assert.match(renderer,/this\.root\.rotation\.y=stance\.rootYaw/,
  'apply true side-angle yaw instead of camera-facing -.19 radians');
assert.doesNotMatch(renderer,/this\.root\.rotation\.y=frame\.face===1\?-\.19/,
  'remove the old near-frontal default orientation');
for(const fragment of [
  'this.pelvis.rotation.y=stance.pelvisYaw',
  'this.chest.rotation.y=stance.chestYaw',
  'this.head.rotation.y=stance.headYaw',
  'this.rightShoulder.rotation.x=stance.leadArmPitch',
  'this.leftShoulder.rotation.x=stance.rearArmPitch',
  'this.rightHip.position.z=stance.leadHipDepth',
  'this.leftHip.position.z=stance.rearHipDepth',
  'this.rightFoot.rotation.y=stance.leadFootYaw',
  'this.leftFoot.rotation.y=stance.rearFootYaw',
  'this.fan.rotation.y=stance.fanYaw',
]){
  assert.ok(renderer.includes(fragment),
    'real 3D meshes must adopt independent combat pose: '+fragment);
}
assert.match(renderer,/this\.root\.scale\.set\(frame\.face,1,1\)/,
  'keep game-authoritative left/right mirroring and knockback direction');
assert.match(renderer,/eviPoseFor\(input\)/,
  'new combat stance must coexist with unchanged move animation timings');
console.log('✓ 3/4 Evi fighting stance: facing, shoulder/hip/head turns, guard, legs, feet, both sides.');
