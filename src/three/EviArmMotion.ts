/** Pure animation targets for Evi's 3D shoulders, elbows, wrists and fan.
 * Anatomical RIGHT always owns the fan, regardless of fighter.face or
 * the angle from which the character is viewed. No gameplay changes.
 */
import type {EviMotionInput,EviPose} from '../combat/EviRigMotion.ts';
import {isEviFanSlash,sideSlashBlend} from '../combat/EviFanSlash.ts';
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
  x:right?.252:-.252,y:.55,z:right?.075:-.075,
});

/** All points are chest-local, with positive Z toward the rival. */
export function eviHandTargets(input:EviMotionInput,_pose:EviPose):HandTargets{
  const right:Vec3={x:.35,y:.31,z:.40};
  const left:Vec3={x:-.25,y:.36,z:.27};
  const name=input.name;
  if(isEviFanSlash(name)){
    const phase=sideSlashBlend(input.elapsed??0,input.startup??.42,input.duration??.9);
    const back:Vec3={x:.48,y:.30,z:-.12};
    const strike:Vec3={x:.30,y:.30,z:.69};
    const prepared=blend(right,back,phase.windup);
    return {
      right:blend(blend(prepared,strike,phase.release),right,phase.recovery),
      left:blend(left,{x:-.23,y:.44,z:.33},phase.release*.6),
    };
  }
  switch(name){
    case 'guard':case 'splashGuard':
      return {
        right:{x:.26,y:.47,z:.51},left:{x:-.19,y:.50,z:.41},
      };
    case 'crouch':case 'guardLow':case 'sweep':
      return {
        right:{x:.33,y:.15,z:.45},
        left:{x:-.27,y:.22,z:.34},
      };
    case 'walk':{
      const step=Math.sin((Number.isFinite(input.time)?input.time:0)*14.5)*
        (input.backwards?-.60:.70);
      return {
        right:{x:.34,y:.33,z:.40-.075*step},
        left:{x:-.25,y:.35,z:.28+.10*step},
      };
    }
    case 'jump':
      return {right:{x:.39,y:.48,z:.38},left:{x:-.31,y:.48,z:.36}};
    case 'roll':{
      // Tuck both forearms in front of the face, but keep the fan grasped
      // in the right wrist even while upside-down.
      const p=Math.max(0,Math.min(1,input.progress??0));
      const fold=Math.sin(Math.PI*p)**2;
      return {
        right:blend(right,{x:.20,y:.39,z:.24},fold),
        left:blend(left,{x:-.20,y:.39,z:.24},fold),
      };
    }
    case 'hit':case 'splashVictim':
      return {right:{x:.45,y:.23,z:.23},left:{x:-.40,y:.28,z:.20}};
    case 'grabReach':case 'grabHold':case 'throw':
      return {right:{x:.34,y:.27,z:.69},left:{x:-.24,y:.25,z:.57}};
    case 'grabHeld':
      return {right:{x:.36,y:.19,z:.20},left:{x:-.36,y:.19,z:.20}};
    case 'splashStart':
      return {right:{x:.34,y:.69,z:.32},left:{x:-.25,y:.31,z:.34}};
    case 'splashAttack':
      return {right:{x:.33,y:.37,z:.71},left:{x:-.26,y:.46,z:.36}};
    case 'intro':case 'victory':{
      const q=smooth((input.elapsed??0)/2);
      return {right:blend(right,{x:.42,y:.84,z:.20},q),
        left:blend(left,{x:-.38,y:.53,z:.25},q)};
    }
    case 'prone':case 'fall':case 'rise':
      return {right:{x:.26,y:.32,z:.38},left:{x:-.24,y:.34,z:.32}};
    default:return {right,left};
  }
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
    {x:right?.40:-.40,y:-.90,z:-.35});
}

/** Smooth the hand targets without affecting hitstop. */
export function blendEviHands(from:HandTargets,to:HandTargets,dt:number):HandTargets{
  const a=dt<=0?0:1-Math.exp(-Math.min(.1,dt)*24);
  return {right:blend(from.right,to.right,a),left:blend(from.left,to.left,a)};
}
