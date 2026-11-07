import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groundedRollVisual} from '../src/combat/GroundedRollVisual.ts';
import {eviPoseFor,neutralEviPose,EVI_POSE_FIELDS} from '../src/combat/EviRigMotion.ts';

const start=groundedRollVisual(0);
const end=groundedRollVisual(1);
assert.equal(start.lift,0,'start on arena floor');
assert.equal(end.lift,0,'end on arena floor');
assert.equal(start.fallbackScaleY,1);
assert.equal(end.fallbackScaleY,1);
assert.equal(start.fallbackLean,0);
assert.ok(Math.abs(end.fallbackLean)<1e-10);
assert.equal(start.tuck,0);
assert.ok(end.tuck<1e-25);
for(let n=0;n<=120;n++){
  const p=n/120;
  for(const backward of [true,false]){
    const v=groundedRollVisual(p,backward);
    assert.ok(Number.isFinite(v.lift));
    assert.ok(v.lift<=0 && v.lift>=-3.000001,
      'NO airborne vertical arc: roll lifts at most 3 px');
    assert.ok(v.fallbackScaleY>=.65 && v.fallbackScaleY<=1,
      'feet anchored at floor, squashed only');
    assert.ok(Math.abs(v.fallbackLean)<=.0600001,
      'no 360-degree spin around foot or body');
    assert.ok(v.shadowScale>=.77 && v.shadowScale<=1);
    assert.equal(v.progress,p,'animation follows real gameplay roll timeline');
    const pose=eviPoseFor({name:'roll',time:p,progress:p,backwards:backward});
    for(const key of EVI_POSE_FIELDS)
      assert.ok(Number.isFinite(pose[key]),'valid animated joint '+key);
    assert.ok(pose.hipY>=0 && pose.hipY<=28.000001);
    assert.ok(pose.bodySquash>=.71 && pose.bodySquash<=1);
  }
}
assert.deepEqual(groundedRollVisual(-1),start,'pre-roll clamps to floor');
assert.deepEqual(groundedRollVisual(2),end,'post-roll clamps to floor');
assert.deepEqual(groundedRollVisual(Number.NaN),start,'invalid values cannot teleport fighter');
assert.equal(groundedRollVisual(.25).lift,groundedRollVisual(.25,true).lift,
  'backwards roll has the same height and rules');
assert.ok(Math.abs(groundedRollVisual(.25).fallbackLean+
  groundedRollVisual(.25,true).fallbackLean)<1e-10,
  'only direction of lean changes');

const base=neutralEviPose();
assert.deepEqual(eviPoseFor({name:'roll',time:0,progress:0}),base,
  'begin roll without limb teleport');
const final=eviPoseFor({name:'roll',time:1,progress:1});
for(const key of EVI_POSE_FIELDS)
  assert.ok(Math.abs(final[key]-base[key])<1e-10,
    'end roll at neutral joint '+key);
const middle=eviPoseFor({name:'roll',time:.5,progress:.5});
assert.ok(middle.hipY>25,'bend hips and knees instead of spinning whole body');
assert.ok(Math.abs(middle.kneeL-base.kneeL)>1);
assert.ok(Math.abs(middle.armL-base.armL)>1);
assert.ok(middle.bodySquash<.8,'visible low roll silhouette');
const forward=eviPoseFor({name:'roll',time:.5,progress:.5});
const backward=eviPoseFor({name:'roll',time:.5,progress:.5,backwards:true});
assert.ok(forward.torsoTilt*backward.torsoTilt<0,
  'roll lean follows actual direction instead of old facing flag');

const fighter=readFileSync(new URL('../src/combat/Fighter.ts',import.meta.url),'utf8');
assert.match(fighter,/groundedRollVisual\(/,
  'real gameplay rendering uses grounded roll transforms');
assert.match(fighter,/this\.rig\.setRotation\(puppetVisible\?0:/,
  'modular 2D puppet does not perform a full-body spin');
assert.doesNotMatch(fighter,/Math\.PI \* 2 \* progress/,
  'remove the old airborne 360-degree roll animation');
assert.match(fighter,/const ROLL_DURATION = \.46;/,
  'retain 0.46 s gameplay roll duration');
assert.match(fighter,/const ROLL_DISTANCE = 178;/,
  'retain existing roll travel distance');
assert.match(fighter,/const ROLL_IFRAME_START = \.095;/,
  'retain existing invulnerability window start');
assert.match(fighter,/const ROLL_IFRAME_END = \.31;/,
  'retain existing invulnerability window end');
console.log('✓ Grounded roll: no aerial arc, neutral start/end, smooth joint tuck and unchanged dodge rules.');
