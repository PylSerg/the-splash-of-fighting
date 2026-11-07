/** Visual-only anatomical two-bone leg solver for the 3D Evi rig.
 * Hip -> knee -> ankle are real articulated Three.js joints. Both feet stay
 * on the ground during stance, guards, crouching and ordinary fan attacks.
 * No collision, hitbox, input, movement or damage data is changed here.
 */
import type {EviPose,EviMotionInput} from '../combat/EviRigMotion.ts';
import type {ThreeEviStance} from './ThreeEviStance.ts';

export type Vec3={x:number;y:number;z:number};
export type EviLegPair={lead:Vec3;rear:Vec3};
export type TwoBoneLeg={
  knee:Vec3;
  /** Direction of each real bone in parent-space, top to bottom. */
  upper:Vec3;
  lower:Vec3;
  ankle:Vec3;
  clamped:boolean;
};
export const EVI_THIGH_LENGTH=.53;
export const EVI_SHIN_LENGTH=.57;
export const EVI_FOOT_REST_HEIGHT=.080;
export const EVI_HIP_ROOT_HEIGHT=.97;
export const EVI_WALK_CYCLE=14.5;

const finite=(n:number)=>Number.isFinite(n)?n:0;
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const times=(v:Vec3,s:number):Vec3=>({x:v.x*s,y:v.y*s,z:v.z*s});
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const length=(v:Vec3)=>Math.hypot(v.x,v.y,v.z);
const unit=(v:Vec3):Vec3=>{
  const n=length(v);
  return n>1e-10?times(v,1/n):{x:0,y:-1,z:0};
};

/** Analytic IK uses the intersecting spheres of two fixed-length bones.
 * A forward-facing bend vector selects a consistent knee on the fighter's
 * side, even when the torso turns into a horizontal strike.
 */
export function solveTwoBoneLeg(
  hip:Vec3,target:Vec3,
  upperLength=EVI_THIGH_LENGTH,lowerLength=EVI_SHIN_LENGTH,
  kneeForward:Vec3={x:0,y:0,z:1},
):TwoBoneLeg{
  if(!(upperLength>0) || !(lowerLength>0) ||
    !Number.isFinite(upperLength)||!Number.isFinite(lowerLength))
    throw new Error('Invalid Evi leg segment lengths');
  const delta=sub(target,hip);
  const actualDistance=length(delta);
  const direction=actualDistance>1e-10?unit(delta):{x:0,y:-1,z:0};
  const minDistance=Math.abs(upperLength-lowerLength)+.0001;
  const maxDistance=upperLength+lowerLength-.0001;
  const distance=Math.max(minDistance,Math.min(maxDistance,actualDistance));
  const ankle=add(hip,times(direction,distance));
  const along=(upperLength*upperLength-lowerLength*lowerLength+
    distance*distance)/(2*distance);
  const across=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
  let bend=sub(kneeForward,times(direction,dot(kneeForward,direction)));
  if(length(bend)<1e-6){
    const fallback:Vec3=Math.abs(direction.x)<.8?{x:1,y:0,z:0}:{x:0,y:0,z:1};
    bend=sub(fallback,times(direction,dot(fallback,direction)));
  }
  const knee=add(add(hip,times(direction,along)),times(unit(bend),across));
  return {
    knee,upper:unit(sub(knee,hip)),lower:unit(sub(ankle,knee)),ankle,
    clamped:Math.abs(actualDistance-distance)>1e-6,
  };
}

/** Target ankle positions measured in PELVIS-local coordinates.
 * p.hipY drives visual crouching, while the target ankle Y compensates
 * exactly for the pelvis displacement so that boots remain grounded.
 * Local +Z points to the rival after applying the root fighting yaw.
 */
export function eviGroundedFootTargets(
  pose:EviPose,input:EviMotionInput,stance:ThreeEviStance,
):EviLegPair{
  const crouched=input.name==='crouch'||input.name==='guardLow'||
    input.name==='crouchMid'||input.name==='sweep';
  const spread=crouched?.065:0;
  const height=EVI_FOOT_REST_HEIGHT+finite(pose.hipY)/100;
  let lead:Vec3={x:.183,y:height,z:stance.leadHipDepth+.225+spread};
  let rear:Vec3={x:-.182,y:height,z:stance.rearHipDepth-.195-spread};
  if(input.name==='walk'){
    const direction=input.backwards?-1:1;
    const wave=direction*Math.sin(finite(input.time)*EVI_WALK_CYCLE);
    lead={...lead,z:lead.z+.125*wave,y:height+.080*Math.max(0,wave)};
    rear={...rear,z:rear.z-.125*wave,y:height+.080*Math.max(0,-wave)};
  }
  // These remain graphical targets, not hit points: kicks and sweeps use
  // the same reach calculation but intentionally release the leading boot.
  if(input.name==='kick'){
    const strength=Math.min(1,Math.max(0,finite(input.elapsed)/
      Math.max(.01,finite(input.startup)||.42)));
    lead={...lead,z:lead.z+.33*strength,y:height+.34*strength};
  }else if(input.name==='sweep'){
    lead={...lead,z:lead.z+.32,y:height};
  }
  return {lead,rear};
}

/** Dynamic grounded poses only. Airborne, rolls and knockdowns keep their
 * separate animation geometry rather than an artificial planted boot.
 */
export function shouldPlantEviFeet(name:EviMotionInput['name']):boolean{
  return !['jump','roll','fall','prone','rise','intro','victory',
    'splashVictim'].includes(name);
}
