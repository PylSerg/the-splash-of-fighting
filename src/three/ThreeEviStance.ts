/** Camera-independent 3/4 combat stance for the real Three.js fighter.
 *
 * Phaser remains the source of truth for face, x, hitboxes and movement.
 * Three.js receives only art transforms. +Z is the model's forward (face)
 * and the arena enemy direction is ±X. Root X mirroring is applied by the
 * renderer, while root Y yaw is signed with facing to make +Z point toward
 * the rival, not straight into the camera.
 */
import type {EviMotionInput} from '../combat/EviRigMotion.ts';

export const EVI_FIGHT_YAW=1.04; // ~60° away from camera, readable 3/4
export const EVI_FRONT_FOOT_Z=.20;
export const EVI_REAR_FOOT_Z=-.16;
export const EVI_STANCE_LEAD='right' as const;
export const EVI_STANCE_REAR='left' as const;

export type ThreeEviStance={
  /** Signed Three.js root yaw, the face turns toward the enemy. */
  rootYaw:number;
  /** Local yaw applied at hips, then shoulders, then neck. */
  pelvisYaw:number;
  chestYaw:number;
  headYaw:number;
  /** Distinguish the leading fan-hand from the rear guard hand in depth. */
  leadArmPitch:number;
  rearArmPitch:number;
  leadElbowPitch:number;
  rearElbowPitch:number;
  /** Offset and rotate actual 3D hip/knee joints for an asymmetric guard. */
  leadHipDepth:number;
  rearHipDepth:number;
  leadLegPitch:number;
  rearLegPitch:number;
  leadKneePitch:number;
  rearKneePitch:number;
  /** Cancel side yaw so the fan's leading blade aims along arena X. */
  fanYaw:number;
  /** Heel/toe twist keeps the boots visibly staggered. */
  leadFootYaw:number;
  rearFootYaw:number;
};
const limit=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
const smooth=(v:number)=>{const t=limit(v);return t*t*(3-2*t);};

export function threeEviStance(face:1|-1,motion:EviMotionInput):ThreeEviStance{
  const name=motion.name;
  const busy=['heavy','light','duel','special','crouchMid','splashAttack'].includes(name);
  // A restrained torso twist on the contact frame makes the fan slash
  // directional without dragging the head around independently of the foe.
  const active=busy?smooth((motion.elapsed??0)/Math.max(.01,motion.startup??.42)):0;
  const charge=name==='special'?1:0;
  const crouched=name==='crouch'||name==='guardLow'||
    name==='crouchMid'||name==='sweep';
  const fallen=name==='fall'||name==='prone'||name==='rise';
  const rootBase=EVI_FIGHT_YAW+(busy?.04*active:0);
  const pelvisYaw=.09+(crouched?-.07:0);
  const chestYaw=-.20+.17*active;
  const headYaw=.22-.12*active;
  // Hand positions are relative to the chest's shoulder plane. Negative
  // pitch brings the hanging upper arms forward (toward local +Z).
  const leadArmPitch=-(.88+.14*active+.05*charge);
  const rearArmPitch=-(.42+.12*(name==='guard'||name==='guardLow'?1:0));
  const leadElbowPitch=-.48-.20*active;
  const rearElbowPitch=-.66;
  const footDepth=fallen?.5:1;
  return {
    rootYaw:face*rootBase,
    pelvisYaw,
    chestYaw,
    headYaw,
    leadArmPitch,
    rearArmPitch,
    leadElbowPitch,
    rearElbowPitch,
    leadHipDepth:EVI_FRONT_FOOT_Z*footDepth,
    rearHipDepth:EVI_REAR_FOOT_Z*footDepth,
    leadLegPitch:-(crouched?.08:.23),
    rearLegPitch:crouched?.08:.13,
    leadKneePitch:.17,
    rearKneePitch:-.08,
    fanYaw:-(rootBase+pelvisYaw+chestYaw)+.06,
    leadFootYaw:.22,
    rearFootYaw:-.30,
  };
}

/** World-space X of model-forward +Z (unit direction).
 * Independent of root mirror scale: right face points right and left
 * face points left. Used by regression tests for both play directions.
 */
export function threeStanceForwardX(face:1|-1,motion:EviMotionInput):number{
  return Math.sin(threeEviStance(face,motion).rootYaw);
}
