import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eviPoseFor,neutralEviPose} from '../src/combat/EviRigMotion.ts';
import {threeGroundedRoll,THREE_ROLL_PIVOT} from '../src/three/ThreeFighterRules.ts';
import {
  eviHandTargets,blendEviHands,solveEviArm,
  EVI_UPPER_ARM_LENGTH,EVI_FOREARM_LENGTH,EVI_RIGHT_WRIST,
} from '../src/three/EviArmMotion.ts';

const diff=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const near=(a,b,msg,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,msg+': '+a+' vs '+b);
assert.equal(EVI_RIGHT_WRIST,'rightWrist');
assert.equal(EVI_UPPER_ARM_LENGTH,.37);
assert.equal(EVI_FOREARM_LENGTH,.38);
const idle={name:'idle',time:0};
const base=eviHandTargets(idle,neutralEviPose());
assert.ok(base.right.x>0 && base.left.x<0);
assert.ok(base.right.z>base.left.z,'fan arm is leading in the fighting stance');
assert.deepEqual(blendEviHands(base,{
  right:{x:9,y:9,z:9},left:{x:-9,y:9,z:9},
},0),base,'hands remain frozen during hitstop');

let samples=0;
const motionNames=[
  'idle','walk','crouch','guard','guardLow','light','heavy','duel','special',
  'crouchMid','kick','sweep','jump','roll','fall','prone','rise',
  'grabReach','grabHold','grabHeld','throw','hit',
  'splashStart','splashAttack','splashGuard','splashVictim',
  'intro','victory',
];
for(const name of motionNames){
  for(let i=0;i<=60;i++){
    const t=i/60;
    const input={
      name,time:t*2,elapsed:t*2,progress:t,
      startup:.42,duration:.9,backwards:i%2===0,
    };
    const pose=eviPoseFor(input);
    const hands=eviHandTargets(input,pose);
    for(const [right,target] of [[true,hands.right],[false,hands.left]]){
      const solved=solveEviArm(right,target);
      assert.equal(solved.clamped,false,
        name+' arm target must be reachable without stretching');
      const origin=right?{x:.252,y:.55,z:.075}:{x:-.252,y:.55,z:-.075};
      near(diff(solved.knee,origin),EVI_UPPER_ARM_LENGTH,
        name+' upper arm keeps constant bone length');
      near(diff(solved.ankle,solved.knee),EVI_FOREARM_LENGTH,
        name+' forearm keeps constant bone length');
      near(diff(solved.ankle,target),0,
        name+' wrist IK reaches its target');
      assert.ok(Number.isFinite(solved.upper.x+solved.upper.y+solved.upper.z));
      samples++;
    }
  }
}
assert.ok(samples>3000);
const strike=eviHandTargets({name:'heavy',time:.42,elapsed:.42,startup:.42,duration:.9},
  neutralEviPose());
const windup=eviHandTargets({name:'heavy',time:.25,elapsed:.25,startup:.42,duration:.9},
  neutralEviPose());
assert.ok(strike.right.z>windup.right.z+.60,
  'right wrist cuts horizontally forward after the windup');
assert.ok(Math.abs(strike.right.y-windup.right.y)<.05,
  'fan sweep stays close to one horizontal plane');
const tucked=eviHandTargets({name:'roll',time:.23,progress:.5},neutralEviPose());
assert.ok(tucked.right.x>0 && tucked.left.x<0,
  'during the roll each hand keeps its anatomical shoulder');
assert.ok(tucked.right.z<base.right.z,
  'the right fan hand tucks close to Evi during a somersault');
const out=eviHandTargets({name:'roll',time:.46,progress:1},neutralEviPose());
near(diff(out.right,base.right),0,'right hand returns after roll');
near(diff(out.left,base.left),0,'left hand returns after roll');

// Sample a changing 3D silhouette in both forward/backward directions.
// The lowest transformed landmark must always touch the ground plane.
for(let i=0;i<=180;i++){
  const t=i/180;
  const tuck=Math.sin(Math.PI*t)**2;
  const points=[
    [0,2.06-.35*tuck],[-.23,1.75-.2*tuck],[.23,1.75-.2*tuck],
    [-.22,1.12],[.22,1.12],
    [-.30,.72+.22*tuck],[.30,.72+.22*tuck],
    [-.20,.03+.12*tuck],[.20,.03+.12*tuck],
  ];
  for(const backwards of [false,true]){
    const r=threeGroundedRoll(t,backwards,points);
    const sn=Math.sin(r.angle),co=Math.cos(r.angle);
    const min=Math.min(...points.map(([x,y])=>
      THREE_ROLL_PIVOT+(y-THREE_ROLL_PIVOT)*co+x*sn+r.lift));
    near(min,.01,'dynamic roll sample maintains floor contact',1e-8);
    assert.ok(Number.isFinite(r.lift));
    assert.ok(Math.abs(r.angle)<=Math.PI*2+1e-7);
  }
}
const file=readFileSync(new URL('../src/three/ThreeEviLayer.ts',import.meta.url),'utf8');
assert.match(file,/this\.rightWrist\.add\(this\.fan\)/,
  'fan MUST be owned by anatomical right wrist, not merely near it');
assert.doesNotMatch(file,/this\.leftWrist\.add\(this\.fan\)/);
assert.doesNotMatch(file,/this\.rightElbow\.add\(this\.fan\)/);
assert.match(file,/this\.plantArm\(this\.rightShoulder,this\.rightElbow,this\.rightWrist/,
  'right arm has independent shoulder/elbow/wrist IK');
assert.match(file,/this\.plantArm\(this\.leftShoulder,this\.leftElbow,this\.leftWrist/,
  'left arm guards independently');
assert.match(file,/this\.currentRollContacts\(\)/,
  'roll measures actual rig contact instead of static imaginary silhouette');
assert.match(file,/this\.fan,new THREE\.Vector3\(\.42,0,\.06\)/,
  'roll includes fan in the ground-contact profile');
assert.match(file,/this\.pivot\.rotation\.z=-r\.angle/,
  '3D somersault performs a full rotation about its tuck pivot');
console.log('✓ 3D arms + roll: '+samples+
  ' IK targets, horizontal slash, right-hand fan, stable floor through 362 roll samples.');
