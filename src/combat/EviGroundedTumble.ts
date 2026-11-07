/** Visual-only grounded rolling somersault.
 *
 * A fighter's root stays at the gameplay hitbox (x, groundY). Only the
 * internal articulated puppet rotates. We solve an approximate contact
 * silhouette against the floor every frame, so a 360° turn can never use
 * the old elevated fixed pivot that launched the character into the air.
 *
 * These geometry samples represent real painted parts of the puppet:
 * head, shoulders, hands, fan, pelvis, knees and boots. They do not change
 * physics, invulnerability, travel distance or collision.
 */
export interface PixelTumble {
  angle:number;
  x:number;
  y:number;
  contactY:number;
  progress:number;
}

type Point=readonly [x:number,y:number];
const TAU=2*Math.PI;
const bounded=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
function smooth(n:number):number{return n*n*(3-2*n);}

const STATIC_FOOTLINE=8;
function contactPoints(tuck:number):Point[]{
  return [
    [0,-156+23*tuck],             // hair crown
    [-29,-126+15*tuck],[29,-126+15*tuck], // shoulders
    [-53+12*tuck,-84+10*tuck],  // left arm / fan (tucked)
    [53-12*tuck,-84+10*tuck],
    [-22,-66+28*tuck],[22,-66+28*tuck], // hips
    [-38+6*tuck,-30+16*tuck],[38-6*tuck,-30+16*tuck], // knees
    [-26,STATIC_FOOTLINE-7*tuck],[26,STATIC_FOOTLINE-7*tuck], // feet
  ];
}

/** This floor calculation is independent from the Fighter and Phaser. */
export function groundedEviTumble(progress:number,backwards=false):PixelTumble{
  const q=bounded(progress);
  if(q===0)return {angle:0,x:0,y:0,contactY:STATIC_FOOTLINE,progress:0};
  if(q===1)return {angle:TAU*(backwards?-1:1),x:0,y:0,
    contactY:STATIC_FOOTLINE,progress:1};
  const heading=backwards?-1:1;
  const tuck=Math.pow(Math.sin(Math.PI*q),2);
  const angle=TAU*heading*smooth(q);
  const sn=Math.sin(angle),cs=Math.cos(angle);
  const points=contactPoints(tuck);
  // Canvas/Phaser rotates y down: rotatedY = sin(a)*x + cos(a)*y.
  const lowest=Math.max(...points.map(([x,y])=>sn*x+cs*y));
  // Keep the same baseline throughout, including inverted frames.
  const y=STATIC_FOOTLINE-lowest;
  // Keep the rotated body centre aligned with the moving combat hitbox.
  const pivotY=70-10*tuck;
  const x=-sn*pivotY;
  return {angle,x,y,contactY:lowest+y,progress:q};
}

/** While old procedural rigs are waiting for dedicated prone art, prefer
 * a compact lateral fall instead of rotating the head into the floor.
 * These values are art-only and do not affect airborne/knockdown state.
 */
export function legacyFallVisual(phase:number):{rotationRatio:number;scaleY:number}{
  const p=bounded(phase);
  return {rotationRatio:.48,scaleY:1-.43*p};
}
