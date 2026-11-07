/** Art-only side-slash timing and fan direction for the articulated Evi.
 * Gameplay startup, strike windows, damage and hitboxes are never changed.
 */
import type { EviMotionName,EviPose } from './EviRigMotion.ts';

export type FanSlashName=Extract<EviMotionName,
  'heavy'|'duel'|'special'|'light'|'crouchMid'>;
export type Point={x:number;y:number};
export const EVI_FAN_TRAIL_LIFETIME=.17;

/** True for the hand-held fan attacks, but NOT B kicks or SPLASH flight. */
export function isEviFanSlash(name:EviMotionName):name is FanSlashName{
  return name==='heavy'||name==='duel'||name==='special'||
    name==='light'||name==='crouchMid';
}
const clamp=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
const ease=(t:number)=>{const x=clamp(t);return x*x*(3-2*x);};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;

/** Hold the fan BACK for most of startup, cut horizontally through the
 * last part of startup/active, then return to a ready guard. For all hits
 * the visual reaches the target at the exact real startup boundary.
 */
export function sideSlashBlend(elapsed:number,startup:number,duration:number):{
  windup:number;release:number;recovery:number;
}{
  const e=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
  const s=Math.max(.01,Number.isFinite(startup)?startup:.4);
  const end=Math.max(s+.01,Number.isFinite(duration)?duration:s+.2);
  const windupEnd=s*.70;
  return {
    windup:e<windupEnd?ease(e/windupEnd):1,
    release:e<windupEnd?0:ease((e-windupEnd)/(s-windupEnd)),
    recovery:e<=s+.04?0:ease((e-s-.04)/(end-s-.04)),
  };
}

const interpPose=(from:EviPose,to:Partial<EviPose>,t:number):EviPose=>{
  const out={...from};
  for(const key of Object.keys(to) as (keyof EviPose)[]){
    const value=to[key];
    if(value!==undefined)out[key]=lerp(from[key],value,t);
  }
  return out;
};

/** Define actual shoulder / elbow / hip positioning, not a vertical
 * overhead swing. Facing is handled by Fighter.rig scaleX.
 */
export function eviSideSlashPose(
  base:EviPose,name:FanSlashName,elapsed:number,startup:number,duration:number,
):EviPose{
  const {windup,release,recovery}=sideSlashBlend(elapsed,startup,duration);
  const power=name==='special'?1.12:name==='heavy'||name==='duel'?1:0.78;
  const crouched=name==='crouchMid';
  const start:Partial<EviPose>={
    torsoTilt:-.065*power,
    armR:.62*power,elbowR:-.10,
    armL:.33,elbowL:-.45,
    fanAngle:-.36,fanScale:.93,
    legL:-.16,legR:.22,
    hairSwing:.075,skirtTilt:-.06,
  };
  const hit:Partial<EviPose>={
    torsoTilt:.095*power,
    armR:-1.40*power,elbowR:-.075,
    armL:-.14,elbowL:-.50,
    fanAngle:-.52,fanScale:1.07+(power-1)*.1,
    legL:-.22,legR:.28,
    hipY:-1.5,hairSwing:-.13,skirtTilt:.11,
  };
  const wind=interpPose(base,start,windup);
  const strike=interpPose(wind,hit,release);
  const result=interpPose(strike,base,recovery);
  if(!crouched)return result;
  // Preserve the low crouch even while the fan sweeps forward.
  return {...result,
    hipY:23,bodySquash:.88,
    legL:-.68,legR:.65,kneeL:1.18,kneeR:-1.13,
    footL:-.24,footR:.22,
  };
}

/** The original fan sprite's handle is at (4,27), blades open toward
 * (about 25,7), in pixel-art canvas coordinates. Facing right we must
 * cancel the arm's negative rotations, so the open fan always points
 * FORWARD toward the rival rather than backward into Evi's body.
 */
export function eviFanLocalRotation(p:EviPose):number{
  const fanShapeAngle=Math.atan2(-20,21);
  const desiredWorldAngle=-.08+
    Math.max(-.10,Math.min(.10,(p.fanAngle+.28)*.08));
  return desiredWorldAngle-fanShapeAngle-
    (p.hipTilt+p.torsoTilt+p.armR+p.elbowR);
}
export function eviFanWorldDirection(p:EviPose):Point{
  const angle=(p.hipTilt+p.torsoTilt+p.armR+p.elbowR)+
    eviFanLocalRotation(p)+Math.atan2(-20,21);
  return {x:Math.cos(angle),y:Math.sin(angle)};
}
const rotated=(x:number,y:number,angle:number):Point=>({
  x:x*Math.cos(angle)-y*Math.sin(angle),
  y:x*Math.sin(angle)+y*Math.cos(angle),
});

/** Fan tip coordinates in EviPixelPuppet.root local space. Uses the same
 * shoulder, upper-arm, forearm and fan attachment lengths as the rig.
 * The gentle body squash is reflected in every child transform.
 */
export function eviFanTip(p:EviPose):Point{
  const hipAngle=p.hipTilt,torsoAngle=hipAngle+p.torsoTilt;
  const armAngle=torsoAngle+p.armR,forearmAngle=armAngle+p.elbowR;
  const torsoScaleY=p.bodySquash;
  const shoulder=rotated(19,-53*torsoScaleY,torsoAngle);
  const upper=rotated(0,29*torsoScaleY,armAngle);
  const lower=rotated(0,29*torsoScaleY,forearmAngle);
  const dir=eviFanWorldDirection(p);
  const length=2*p.fanScale*Math.hypot(21,20);
  return {
    x:shoulder.x+upper.x+lower.x+dir.x*length,
    y:-65+p.hipY+shoulder.y+upper.y+lower.y+dir.y*length,
  };
}

/** Show glow on the LAST 30% of startup and through the strike.
 * After 0.12s of recovery it fades away, not during idle/blocks/kicks.
 */
export function eviSlashGlow(input:{
  name:EviMotionName;elapsed?:number;startup?:number;
}):number{
  if(!isEviFanSlash(input.name))return 0;
  const e=Math.max(0,input.elapsed??0),s=Math.max(.01,input.startup??.42);
  const first=s*.70,impact=s;
  if(e<=first)return 0;
  if(e<impact)return ease((e-first)/(impact-first));
  return 1-ease((e-impact)/.12);
}
