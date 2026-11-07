/** Pure animation targets for Evi's 3D shoulders, elbows, wrists and fan.
 * Anatomical RIGHT always owns the fan, regardless of fighter.face or
 * the angle from which the character is viewed. No gameplay changes.
 */
import type {EviMotionInput,EviPose} from '../combat/EviRigMotion.ts';
import {isEviFanSlash} from '../combat/EviFanSlash.ts';
import {solveTwoBoneLeg,type Vec3} from './EviAnatomy.ts';

export const EVI_UPPER_ARM_LENGTH=.37;
export const EVI_FOREARM_LENGTH=.38;
export const EVI_RIGHT_WRIST='rightWrist' as const;
export type HandTargets={right:Vec3;left:Vec3};
const smooth=(t:number)=>{const q=Math.max(0,Math.min(1,Number.isFinite(t)?t:0));return q*q*(3-2*q)};
const blend=(a:Vec3,b:Vec3,t:number):Vec3=>({
  x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,
});
const shoulderPosition=(right:boolean):Vec3=>({
  // +Z faces the opponent: anatomical RIGHT is local -X (viewer LEFT).
  x:right?-.252:.252,y:.55,z:right?.075:-.075,
});

/** The shoulder-to-wrist span is 0.75. During the strike we hold the
 * wrist at 0.727, so the elbow is nearly straight, never overextended.
 */
export const EVI_EXTENDED_FAN_REACH=.727;
const FAN_BACK_ANGLE=-2.12;
const FAN_CUT_ANGLE=-4.90;

/** Three.js-only timing: first pull the arm behind the shoulder, HOLD the
 * windup where it is actually visible, then cut rapidly at the exact
 * gameplay impact frame. Do not change 2D/Pupppet combat timing.
 */
export function eviThreeFanPhases(elapsed:number,startup:number,duration:number):{
  windup:number;release:number;recovery:number;
}{
  const e=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
  const s=Math.max(.01,Number.isFinite(startup)?startup:.42);
  const end=Math.max(s+.01,Number.isFinite(duration)?duration:s+.2);
  return {
    windup:smooth(e/(s*.48)),
    release:smooth((e-s*.80)/(s*.20)),
    recovery:e<=s+.04?0:smooth((e-s-.04)/Math.max(.01,end-s-.04)),
  };
}

/** All points are CHEST-local. +Z is the forward attack direction; -X is
 * Evi's actual right side when you look at her face from the front.
 * This convention is identical for both facing directions because the
 * root applies the arena mirror, not a change of anatomical joints.
 */
export function eviHandTargets(input:EviMotionInput,_pose:EviPose):HandTargets{
  const right:Vec3={x:-.35,y:.31,z:.40};
  const left:Vec3={x:.25,y:.36,z:.27};
  const name=input.name;
  if(isEviFanSlash(name)){
    const phase=eviThreeFanPhases(
      input.elapsed??0,input.startup??.42,input.duration??.9);
    const high=name==='heavy'||name==='duel';
    const low=name==='crouchMid';
    const backHeight=high?.68:low?.33:name==='special'?.58:.49;
    const cutHeight=high?.67:low?.25:name==='special'?.53:.43;
    // A wide SHOULDER-LED arc: back (-Z) -> outside the right shoulder
    // (-X) -> forward (+Z). Unlike a straight wrist lerp, the arm stays
    // nearly fully extended throughout the actual release.
    const angle=FAN_BACK_ANGLE+
      (FAN_CUT_ANGLE-FAN_BACK_ANGLE)*phase.release;
    const y=backHeight+(cutHeight-backHeight)*phase.release;
    const shoulder=shoulderPosition(true);
    const horiz=Math.sqrt(Math.max(.0001,
      EVI_EXTENDED_FAN_REACH**2-(y-shoulder.y)**2));
    const extended:Vec3={
      x:shoulder.x+horiz*Math.cos(angle),
      y,z:shoulder.z+horiz*Math.sin(angle),
    };
    const prepared=blend(right,extended,phase.windup);
    return {
      right:blend(prepared,right,phase.recovery),
      left:blend(left,{x:.23,y:.44,z:.33},phase.release*.6),
    };
  }
  switch(name){
    case 'guard':case 'splashGuard':
      return {right:{x:-.26,y:.47,z:.51},left:{x:.19,y:.50,z:.41}};
    case 'crouch':case 'guardLow':case 'sweep':
      return {right:{x:-.33,y:.15,z:.45},left:{x:.27,y:.22,z:.34}};
    case 'walk':{
      const step=Math.sin((Number.isFinite(input.time)?input.time:0)*14.5)*
        (input.backwards?-.60:.70);
      return {
        right:{x:-.34,y:.33,z:.40-.075*step},
        left:{x:.25,y:.35,z:.28+.10*step},
      };
    }
    case 'jump':
      return {right:{x:-.39,y:.48,z:.38},left:{x:.31,y:.48,z:.36}};
    case 'roll':{
      const p=Math.max(0,Math.min(1,input.progress??0));
      const fold=Math.sin(Math.PI*p)**2;
      return {
        right:blend(right,{x:-.20,y:.39,z:.24},fold),
        left:blend(left,{x:.20,y:.39,z:.24},fold),
      };
    }
    case 'hit':case 'splashVictim':
      return {right:{x:-.45,y:.23,z:.23},left:{x:.40,y:.28,z:.20}};
    case 'grabReach':case 'grabHold':case 'throw':
      return {right:{x:-.34,y:.27,z:.69},left:{x:.24,y:.25,z:.57}};
    case 'grabHeld':
      return {right:{x:-.36,y:.19,z:.20},left:{x:.36,y:.19,z:.20}};
    case 'splashStart':
      return {right:{x:-.34,y:.69,z:.32},left:{x:.25,y:.31,z:.34}};
    case 'splashAttack':
      return {right:{x:-.33,y:.37,z:.71},left:{x:.26,y:.46,z:.36}};
    case 'intro':case 'victory':{
      const q=smooth((input.elapsed??0)/2);
      return {
        right:blend(right,{x:-.42,y:.84,z:.20},q),
        left:blend(left,{x:.38,y:.53,z:.25},q),
      };
    }
    case 'prone':case 'fall':case 'rise':
      return {right:{x:-.26,y:.32,z:.38},left:{x:.24,y:.34,z:.32}};
    default:return {right,left};
  }
}

/** Blade tilts up during the held windup, then rotates DOWN as the nearly
 * straight right arm makes its broad cut. The torso also coils and uncoils.
 */
export function eviFanSwingAngles(input:EviMotionInput):{
  yaw:number;roll:number;torsoYaw:number;
}{
  if(!isEviFanSlash(input.name))return {yaw:0,roll:0,torsoYaw:0};
  const phase=eviThreeFanPhases(
    input.elapsed??0,input.startup??.42,input.duration??.9);
  const coiled=phase.windup*(1-phase.release)*(1-phase.recovery);
  const cutting=phase.release*(1-phase.recovery);
  return {
    yaw:-.50*coiled+.30*cutting,
    roll:1.43*coiled-.12*cutting,
    torsoYaw:-.35*coiled+.19*cutting,
  };
}

/** Mirror-safe shoulder/elbow targets: the anatomical right-hand is always
 * the fan hand. The pose is solved in local chest space, not screen space.
 */
export function solveEviArm(right:boolean,wrist:Vec3){
  return solveTwoBoneLeg(shoulderPosition(right),wrist,
    EVI_UPPER_ARM_LENGTH,EVI_FOREARM_LENGTH,
    // Bend toward the waist and slightly outward. The old +Y/+Z pole
    // inverted the elbow toward the face, even in an idle guard.
    // This is an anatomical pole in chest-local space, not screen space.
    {x:right?-.40:.40,y:-.90,z:-.35});
}

/** Smooth the hand targets without affecting hitstop. */
export function blendEviHands(from:HandTargets,to:HandTargets,dt:number):HandTargets{
  const a=dt<=0?0:1-Math.exp(-Math.min(.1,dt)*24);
  return {right:blend(from.right,to.right,a),left:blend(from.left,to.left,a)};
}
