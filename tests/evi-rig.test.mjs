import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  EVI_POSE_FIELDS,EVI_RIG_SECONDS,neutralEviPose,eviPoseFor,blendEviPose,
} from '../src/combat/EviRigMotion.ts';

const base=neutralEviPose();
assert.equal(EVI_RIG_SECONDS,2,'both cinematics last exactly two seconds');
assert.ok(EVI_POSE_FIELDS.length>=18,'rig animates all major joints separately');
for(const field of EVI_POSE_FIELDS)assert.ok(Number.isFinite(base[field]),field);

const actions=[
  'idle','walk','crouch','jump','guard','guardLow',
  'light','heavy','kick','crouchMid','sweep','special','duel',
  'hit','roll','fall','prone','rise','grabReach','grabHold','grabHeld',
  'throw','splashStart','splashAttack','splashVictim','splashGuard',
  'intro','victory',
];
for(const name of actions){
  for(const elapsed of [0,.16,.4,.85,1.5,2]){
    const pose=eviPoseFor({name,time:elapsed,elapsed,startup:.40,duration:1.0,progress:elapsed/2});
    for(const field of EVI_POSE_FIELDS){
      assert.ok(Number.isFinite(pose[field]),name+' produces a finite '+field);
    }
    assert.ok(pose.bodySquash>.4 && pose.bodySquash<=1,
      name+' never breaks the body rig height');
  }
}
assert.notDeepEqual(eviPoseFor({name:'idle',time:0}),
  eviPoseFor({name:'walk',time:.1}),'walking must move joint positions');
assert.notDeepEqual(eviPoseFor({name:'guard',time:0}),
  eviPoseFor({name:'guardLow',time:0}),'guard changes joint orientation');
assert.ok(eviPoseFor({name:'crouch',time:0}).hipY>20,
  'crouching lowers the articulated pelvis');
assert.ok(eviPoseFor({name:'kick',time:0,elapsed:.5,startup:.4,duration:.8}).legR<
  base.legR-.7,'kick extends the front leg');
assert.ok(eviPoseFor({name:'heavy',time:0,elapsed:.4,startup:.4,duration:.8}).armR<
  base.armR-.95,'heavy Y extends the fan horizontally at contact');
assert.ok(eviPoseFor({name:'special',time:0,elapsed:.4,startup:.4,duration:.8}).armR<
  base.armR-1,'special uses a forward fan side-cut rather than an overhead chop');

const entranceStart=eviPoseFor({name:'intro',time:0,elapsed:0});
const entranceMiddle=eviPoseFor({name:'intro',time:1,elapsed:1});
const entranceEnd=eviPoseFor({name:'intro',time:2,elapsed:2});
assert.notDeepEqual(entranceStart,entranceMiddle);
assert.notDeepEqual(entranceMiddle,entranceEnd);
assert.deepEqual(entranceEnd,eviPoseFor({name:'intro',time:5,elapsed:99}),
  'intro pose holds its final 2s keyframe');
const victorStart=eviPoseFor({name:'victory',time:0,elapsed:0});
const victorMiddle=eviPoseFor({name:'victory',time:1,elapsed:1});
const victorFinal=eviPoseFor({name:'victory',time:2,elapsed:2});
assert.notDeepEqual(victorStart,victorMiddle);
assert.notDeepEqual(victorMiddle,victorFinal);
assert.deepEqual(victorFinal,eviPoseFor({name:'victory',time:100,elapsed:99}));

const target=eviPoseFor({name:'jump',time:.1});
assert.deepEqual(blendEviPose(base,target,0),base,
  'hitstop does not advance pose transitions');
const halfway=blendEviPose(base,target,1/60);
for(const field of EVI_POSE_FIELDS){
  assert.ok(halfway[field]>=Math.min(base[field],target[field])-1e-9 &&
    halfway[field]<=Math.max(base[field],target[field])+1e-9);
}
assert.notDeepEqual(halfway,target,
  'one simulation tick must not snap the entire sprite into a new pose');

const puppet=readFileSync(new URL('../src/combat/EviPixelPuppet.ts',import.meta.url),'utf8');
assert.match(puppet,/pixelCanvas\(scene,'head'/);
assert.match(puppet,/pixelCanvas\(scene,'upperArm'/);
assert.match(puppet,/pixelCanvas\(scene,'shin'/);
assert.match(puppet,/pixelCanvas\(scene,'fan'/);
assert.match(puppet,/Textures\.FilterMode\.NEAREST/,
  'render individual nearest-neighbor pixel textures');
assert.match(puppet,/this\.forearmR\.add\(this\.fan\)/,
  'fan must follow the arm and wrist joints');
const fighter=readFileSync(new URL('../src/combat/Fighter.ts',import.meta.url),'utf8');
assert.match(fighter,/this\.pixelPuppet=new EviPixelPuppet\(scene\)/);
assert.match(fighter,/this\.pixelPuppet\?\.update\(this\.eviMotionInput\(\),_dt/,
  'rig receives combat state and fixed-step dt but never controls hitboxes');
assert.match(fighter,/this\.eviVisualMode==='puppet'/,
  'modular puppet is the default even with old image sheets saved');
const arena=readFileSync(new URL('../src/scenes/ArenaScene.ts',import.meta.url),'utf8');
assert.match(arena,/setEviVisualMode\(mode:/,
  'switch art while preserving combat state');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const mode of ['puppet','sheet','legacy'])
  assert.ok(html.includes('data-evi-mode="'+mode+'"'));

console.log('✓ 28 articulated motions, smooth joints, 2s cinematics and optional sprite-sheet fallback: passed.');
