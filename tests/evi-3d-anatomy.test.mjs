import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eviPoseFor} from '../src/combat/EviRigMotion.ts';
import {threeEviStance} from '../src/three/ThreeEviStance.ts';
import {
  EVI_THIGH_LENGTH,EVI_SHIN_LENGTH,EVI_FOOT_REST_HEIGHT,
  EVI_HIP_ROOT_HEIGHT,EVI_WALK_CYCLE,
  eviGroundedFootTargets,shouldPlantEviFeet,solveTwoBoneLeg,
} from '../src/three/EviAnatomy.ts';

const norm=v=>Math.hypot(v.x,v.y,v.z);
const difference=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const near=(actual,expected,message,tol=1e-7)=>{
  assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<tol,
    message+': got '+actual+', expected '+expected);
};
assert.equal(EVI_THIGH_LENGTH,.53);
assert.equal(EVI_SHIN_LENGTH,.57);
assert.equal(EVI_HIP_ROOT_HEIGHT,.97);
assert.equal(EVI_FOOT_REST_HEIGHT,.080);
assert.equal(EVI_WALK_CYCLE,14.5);
for(const name of ['idle','walk','crouch','guard','guardLow','light','heavy',
  'duel','special','crouchMid','sweep','kick','hit','grabReach','grabHold',
  'grabHeld','throw','splashStart','splashAttack','splashGuard']){
  assert.equal(shouldPlantEviFeet(name),true,
    name+' must use the grounded IK, not stiff arbitrary hip rotations');
}
for(const name of ['jump','roll','fall','prone','rise','intro','victory',
  'splashVictim']){
  assert.equal(shouldPlantEviFeet(name),false,
    name+' must release floor lock for genuine airborne or tumbling motion');
}

let solvedFrames=0;
for(const name of ['idle','walk','crouch','guard','guardLow','heavy',
  'duel','special','crouchMid','sweep','kick','hit']){
  for(const facing of [-1,1]){
    for(let index=0;index<=120;index++){
      const t=index/60;
      const input={
        name,time:t,elapsed:t,startup:.42,duration:.86,
        backwards:index%2===0,
      };
      const pose=eviPoseFor(input);
      const stance=threeEviStance(facing,input);
      const feet=eviGroundedFootTargets(pose,input,stance);
      for(const [isLead,target] of [[true,feet.lead],[false,feet.rear]]){
        const hip={
          x:isLead?.142:-.142,
          y:EVI_HIP_ROOT_HEIGHT,
          z:isLead?stance.leadHipDepth:stance.rearHipDepth,
        };
        const solved=solveTwoBoneLeg(hip,target);
        for(const component of ['x','y','z']){
          assert.ok(Number.isFinite(solved.ankle[component]));
          assert.ok(Number.isFinite(solved.knee[component]));
        }
        assert.equal(solved.clamped,false,
          name+' position must remain physically reachable without leg stretch');
        near(norm(difference(solved.knee,hip)),EVI_THIGH_LENGTH,
          name+' thigh has constant length');
        near(norm(difference(solved.ankle,solved.knee)),EVI_SHIN_LENGTH,
          name+' shin has constant length');
        near(norm(difference(solved.ankle,target)),0,
          name+' foot reaches actual specified target');
        near(norm(solved.upper),1,'thigh direction normalized');
        near(norm(solved.lower),1,'shin direction normalized');
        const groundLevel=target.y-pose.hipY/100;
        const step=name==='walk'?groundLevel-EVI_FOOT_REST_HEIGHT:0;
        assert.ok(step>=-1e-7 && step<=.080001,
          name+' boot cannot sink under the floor or fly up');
        if(name!=='walk'&&name!=='kick')
          near(groundLevel,EVI_FOOT_REST_HEIGHT,
            name+' boots planted while visual pelvis lowers');
        solvedFrames++;
      }
      assert.ok(feet.lead.z>stance.leadHipDepth &&
        feet.rear.z<stance.rearHipDepth,
        'lead and rear stance must open in opposite directions');
    }
  }
}
assert.ok(solvedFrames>5000,'check full motion curves, not just a static pose');

for(const face of [1,-1]){
  const idle={name:'idle',time:0};
  const crouch={name:'crouch',time:0};
  const standingPose=eviPoseFor(idle);
  const crouchPose=eviPoseFor(crouch);
  const stand=eviGroundedFootTargets(standingPose,idle,threeEviStance(face,idle));
  const low=eviGroundedFootTargets(crouchPose,crouch,threeEviStance(face,crouch));
  near(stand.lead.y-standingPose.hipY/100,EVI_FOOT_REST_HEIGHT,
    'standing foot reaches world floor');
  near(low.lead.y-crouchPose.hipY/100,EVI_FOOT_REST_HEIGHT,
    'crouching foot remains on exactly the same world floor');
  const hipHigh={x:.142,y:EVI_HIP_ROOT_HEIGHT,z:threeEviStance(face,idle).leadHipDepth};
  const hipLow={x:.142,y:EVI_HIP_ROOT_HEIGHT,z:threeEviStance(face,crouch).leadHipDepth};
  const standKnee=solveTwoBoneLeg(hipHigh,stand.lead).knee;
  const crouchKnee=solveTwoBoneLeg(hipLow,low.lead).knee;
  assert.ok(crouchKnee.y<standKnee.y-.10,
    'crouch visibly lowers the knee rather than detaching thighs from torso');
  assert.ok(low.lead.z>stand.lead.z,
    'crouch widens stance to give knees sufficient bend room');
}
assert.throws(()=>solveTwoBoneLeg({x:0,y:1,z:0},{x:0,y:0,z:0},0,.57));
assert.throws(()=>solveTwoBoneLeg({x:0,y:1,z:0},{x:0,y:0,z:0},.53,Infinity));
const unreachable=solveTwoBoneLeg(
  {x:0,y:2,z:0},{x:0,y:0,z:0});
assert.equal(unreachable.clamped,true,
  'unreachable foot must be limited rather than stretching the mesh');
near(norm(difference(unreachable.knee,{x:0,y:2,z:0})),.53,
  'even unreachable pose preserves thigh length');

const renderer=readFileSync(new URL('../src/three/ThreeEviLayer.ts',import.meta.url),'utf8');
assert.match(renderer,/this\.plantLeg\(this\.leftHip,this\.leftKnee,this\.leftFoot/);
assert.match(renderer,/this\.plantLeg\(this\.rightHip,this\.rightKnee,this\.rightFoot/);
assert.match(renderer,/shouldPlantEviFeet\(input\.name\)/);
assert.match(renderer,/hip\.quaternion\.setFromUnitVectors\(down,upper\)/);
assert.match(renderer,/knee\.quaternion\.setFromUnitVectors\(down,kneeLocalDirection\)/);
assert.match(renderer,/foot\.quaternion\.copy\(jointRotation\.invert\(\)\.multiply\(bootRotation\)\)/,
  'boot should cancel both leg rotations and keep correct upright yaw');
assert.match(renderer,/foot\.position\.set\(0,-\.57,0\)/,
  'ankle pivot must match real shin endpoint');
assert.match(renderer,/this\.pelvis,cream,0,1\.13/,
  'body has overlapping waist between hips and ribcage');
console.log('✓ Evi 3D anatomy: '+solvedFrames+
  ' sampled joint pairs, planted feet, realistic bent knees, consistent leg lengths and safe airborne fallback.');
