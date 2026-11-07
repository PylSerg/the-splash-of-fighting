/** Independent 2D skeletal pose math, no Phaser dependency.
 * The old keyframe sheet has been replaced by smooth, interpolated joints.
 * Combat timing and collision boxes are owned exclusively by Fighter.
 */
import {eviSideSlashPose,isEviFanSlash} from './EviFanSlash.ts';
export type EviMotionName=
  'idle'|'walk'|'crouch'|'jump'|'guard'|'guardLow'|'light'|'heavy'|
  'kick'|'crouchMid'|'sweep'|'special'|'duel'|'hit'|'roll'|
  'fall'|'prone'|'rise'|'grabReach'|'grabHold'|'grabHeld'|'throw'|
  'splashStart'|'splashAttack'|'splashVictim'|'splashGuard'|
  'intro'|'victory';

export interface EviMotionInput{
  name:EviMotionName;
  time:number;
  elapsed?:number;
  startup?:number;
  duration?:number;
  progress?:number;
  backwards?:boolean;
}

export const EVI_POSE_FIELDS=[
  'hipY','hipTilt','torsoTilt','headTilt',
  'armL','armR','elbowL','elbowR',
  'legL','legR','kneeL','kneeR',
  'footL','footR','fanAngle','fanScale',
  'skirtTilt','hairSwing','bodySquash',
] as const;

export type EviPoseField=typeof EVI_POSE_FIELDS[number];
export type EviPose=Record<EviPoseField,number>;
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const smooth=(n:number)=>{const q=clamp(n);return q*q*(3-2*q);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const EVI_RIG_SECONDS=2;

export function neutralEviPose():EviPose{
  return {
    hipY:0,hipTilt:0,torsoTilt:0,headTilt:0,
    armL:.27,armR:-.28,elbowL:-.65,elbowR:-.87,
    legL:-.09,legR:.12,kneeL:.18,kneeR:-.16,
    footL:-.04,footR:.03,fanAngle:-.28,fanScale:.90,
    skirtTilt:0,hairSwing:0,bodySquash:1,
  };
}

function merged(p:EviPose,change:Partial<EviPose>):EviPose{
  return {...p,...change};
}

export function eviPoseFor(input:EviMotionInput):EviPose{
  const t=Number.isFinite(input.time)?input.time:0;
  const e=Math.max(0,input.elapsed??0),d=Math.max(.01,input.duration??1);
  const p=clamp(input.progress??e/d),base=neutralEviPose();
  const wave=Math.sin(t*2.7),step=Math.sin(t*14.5);
  switch(input.name){
    case 'idle':
      return merged(base,{
        hipY:Math.sin(t*2.7)*1.4,
        torsoTilt:wave*.025,
        elbowR:-.85+wave*.085,
        fanAngle:-.28+wave*.095,
        skirtTilt:wave*.035,hairSwing:Math.sin(t*2.1)*.028,
      });
    case 'walk':{
      const stride=(input.backwards?-.75:1)*step;
      return merged(base,{
        hipY:-Math.abs(Math.sin(t*14.5))*3.4,
        torsoTilt:input.backwards?-.075:.11,
        armL:.14-stride*.36,armR:-.36+stride*.29,
        elbowR:-.74,elbowL:-.57,
        legL:stride*.58,legR:-stride*.58,
        kneeL:Math.max(0,-stride)*.85,kneeR:Math.max(0,stride)*.85,
        footL:-stride*.21,footR:stride*.21,
        skirtTilt:stride*.09,hairSwing:-stride*.055,
      });
    }
    case 'crouch':case 'guardLow':
      return merged(base,{
        hipY:25,torsoTilt:.11,headTilt:-.12,
        legL:-.76,legR:.73,kneeL:1.22,kneeR:-1.20,
        footL:-.25,footR:.24,
        armL:input.name==='guardLow'?-1.1:.48,
        armR:input.name==='guardLow'?-1.3:-.50,
        elbowL:input.name==='guardLow'?-1.2:-.55,
        elbowR:input.name==='guardLow'?-1.05:-.90,
        fanAngle:input.name==='guardLow'?-1.1:-.16,
        skirtTilt:.10,bodySquash:.88,
      });
    case 'guard':
      return merged(base,{
        torsoTilt:-.095,armL:-1.16,armR:-1.38,
        elbowL:-1.16,elbowR:-1.21,fanAngle:-1.32,
        legL:-.22,legR:.22,
      });
    case 'jump':
      return merged(base,{
        torsoTilt:-.09,armL:-1.1,armR:-.90,elbowL:-.95,
        legL:-.48,legR:.48,kneeL:.90,kneeR:-.82,
        footL:-.22,footR:.30,fanAngle:-.85,
        skirtTilt:.20,hairSwing:.15,
      });
    case 'roll':{
      // Genuine low 2D tuck, not a barrel roll of the entire Fighter rig.
      // All joint offsets start AND finish at the idle pose, so completing
      // the 0.46s dodge cannot snap the limbs back from a fixed crouch.
      const tuck=Math.pow(Math.sin(Math.PI*p),2);
      const sway=Math.sin(2*Math.PI*p);
      const heading=input.backwards?-1:1;
      return merged(base,{
        hipY:28*tuck,
        torsoTilt:heading*(.82*tuck+.08*sway),
        headTilt:-heading*.30*tuck,
        armL:base.armL-1.65*tuck,
        armR:base.armR-1.45*tuck,
        elbowL:base.elbowL-.78*tuck,
        elbowR:base.elbowR-.55*tuck,
        legL:base.legL-.98*tuck,
        legR:base.legR+.92*tuck,
        kneeL:base.kneeL+1.38*tuck,
        kneeR:base.kneeR-1.30*tuck,
        footL:base.footL-.18*tuck,
        footR:base.footR+.18*tuck,
        skirtTilt:.24*heading*tuck,
        hairSwing:-heading*.20*tuck,
        fanAngle:base.fanAngle-.86*tuck,
        fanScale:base.fanScale-.12*tuck,
        bodySquash:1-.29*tuck,
      });
    }
    case 'hit':case 'splashVictim':
      return merged(base,{
        torsoTilt:-.29+wave*.045,headTilt:.21,
        armL:-.76,armR:.67,elbowL:.42,elbowR:.42,
        legL:-.24,legR:.25,fanAngle:.75,
        skirtTilt:-.12,hairSwing:-.19,
      });
    case 'fall':case 'prone':case 'rise':{
      const falling=input.name==='fall'?smooth(p):input.name==='prone'?1:1-smooth(p);
      return merged(base,{
        hipY:38*falling,torsoTilt:-.35*falling,
        headTilt:.4*falling,armL:-1.5*falling,
        armR:-1.0*falling,legL:-.76*falling,
        legR:.56*falling,kneeL:1.20*falling,kneeR:-.8*falling,
        skirtTilt:.34*falling,hairSwing:.25*falling,
      });
    }
    case 'grabReach':case 'grabHold':case 'grabHeld':case 'throw':{
      const thrown=input.name==='throw';
      const held=input.name==='grabHeld';
      const hold=input.name==='grabHold';
      return merged(base,{
        torsoTilt:thrown?.32:held?-.2:.15,
        armR:thrown?-2.15:held?.8:hold?-1.55:-1.3,
        elbowR:thrown?-1.6:held?.5:-.27,
        armL:thrown?-1.4:held?.45:-.8,
        elbowL:thrown?-1.8:-.62,
        legL:-.35,legR:.30,fanAngle:-.5,
        hipY:held?7:thrown?-7:0,
      });
    }
    case 'splashStart':case 'splashAttack':{
      const aggressive=input.name==='splashAttack';
      return merged(base,{
        torsoTilt:aggressive?.32:-.20,
        headTilt:aggressive?-.1:.17,
        armR:aggressive?-2.25:-1.05,
        elbowR:aggressive?-.16:-.45,
        armL:aggressive?-1.2:.12,elbowL:-.55,
        fanAngle:aggressive?-1.4:-.72,
        fanScale:aggressive?1.20:1.05,
        legL:-.33,legR:.39,
        skirtTilt:aggressive?.18:-.13,
        hairSwing:aggressive?-.2:.16,
      });
    }
    case 'splashGuard':
      return eviPoseFor({name:'guardLow',time:t});
    case 'intro':{
      const q=clamp(e/EVI_RIG_SECONDS);
      const flourish=Math.sin(Math.PI*smooth((q-.22)/.65));
      return merged(base,{
        hipY:-4*Math.sin(Math.PI*q),
        torsoTilt:mix(-.14,.05,smooth(q)),
        headTilt:-.1*Math.sin(Math.PI*q),
        armR:mix(-.9,-1.88,flourish),
        elbowR:mix(-.3,-.84,flourish),
        armL:.22-.7*flourish,
        fanAngle:-.6-1.65*flourish,
        fanScale:.8+flourish*.32,
        legL:-.18+q*.14,legR:.14,
        hairSwing:-.12*flourish,
      });
    }
    case 'victory':{
      const q=clamp(e/EVI_RIG_SECONDS);
      const flourish=smooth((q-.1)/.58);
      const celebrate=Math.sin(Math.PI*clamp((q-.1)/.72));
      return merged(base,{
        hipY:-4*celebrate,
        torsoTilt:-.08-.14*flourish,
        headTilt:-.16*flourish,
        armR:-.40-2.5*flourish,
        elbowR:-.78+.4*flourish,
        armL:.2-1.4*flourish,
        elbowL:-.45,
        fanAngle:-.4-2.0*flourish,
        fanScale:1.05+flourish*.22,
        legR:.28,legL:-.23,
        skirtTilt:.13*celebrate,hairSwing:-.12*celebrate,
      });
    }
    default:break;
  }
  // Normal attacks follow the existing real startup → active → recovery
  // windows; a neutral-looking pose cannot sneak a new hitbox into combat.
  const startup=Math.max(.01,input.startup??.42);
  const active=.085;
  const recover=Math.max(.1,d-startup-active);
  const strength=e<startup
    ?smooth(e/startup)
    :e<startup+active?1
      :1-smooth((e-startup-active)/recover);
  const lunge=Math.max(0,strength);
  if(isEviFanSlash(input.name)){
    // X/Y, the duelling starter and the charged special all use deliberate
    // rearward preparation followed by a fast, near-horizontal side cut.
    // No downward overhead chop remains in the animated Evi puppet.
    return eviSideSlashPose(base,input.name,e,startup,d);
  }
  if(input.name==='kick'){
    return merged(base,{
      torsoTilt:-.26*lunge,armL:-.48,
      legR:-1.35*lunge,kneeR:.75*lunge,
      footR:-.38*lunge,
      legL:.18,hipY:2*lunge,
      skirtTilt:.22*lunge,
    });
  }
  if(input.name==='sweep'){
    const low=eviPoseFor({name:'crouch',time:t});
    return merged(low,{
      legR:-1.45*lunge,kneeR:.2*lunge,
      legL:-.58,torsoTilt:.24,
      skirtTilt:.24,armL:-.8,
    });
  }
  return base;
}

/** Critically damped-looking transition that has no gameplay side effects. */
export function blendEviPose(previous:EviPose,next:EviPose,dt:number):EviPose{
  const weight=dt<=0?0:1-Math.exp(-Math.min(dt,.10)*21);
  const result={} as EviPose;
  for(const key of EVI_POSE_FIELDS)result[key]=mix(previous[key],next[key],weight);
  return result;
}
