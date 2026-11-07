/** Browser-independent alignment for Three.js over the Phaser arena.
 * Phaser world centre x=480 at any viewport width; world pixels map to
 * hundredths of a 3D unit. Battle logic remains authoritative.
 */
export const PHASER_VIEW_HEIGHT=540;
export const PHASER_WORLD_CENTRE_X=480;
export const THREE_PIXELS_PER_UNIT=100;
export const THREE_GROUND_Y=443;
export type ThreeRollTransform={angle:number;lift:number};
const bound=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
const smooth=(n:number)=>{const t=bound(n);return t*t*(3-2*t);};

export function screenToThree(x:number,y:number):{x:number;y:number}{
  return {
    x:(x-PHASER_WORLD_CENTRE_X)/THREE_PIXELS_PER_UNIT,
    y:(PHASER_VIEW_HEIGHT/2-y)/THREE_PIXELS_PER_UNIT,
  };
}

/** Roll the *visual* 3D character around the pelvis. The entire animation
 * is shifted vertically so an anatomical point, never a sky pivot, meets
 * the arena floor. The gameplay collider does not rotate or rise.
 */
const outline:[number,number][]=[
  [0,.01],[-.18,.04],[.18,.04],[-.28,.56],[.28,.56],
  [-.37,1.45],[.37,1.45],[0,2.08],[-.17,1.02],[.17,1.02],
  [-.55,1.13],[.55,1.13],
];
export const THREE_ROLL_PIVOT=.91;
export function threeGroundedRoll(progress:number,backwards=false):ThreeRollTransform{
  const p=bound(progress);
  const angle=(backwards?-1:1)*Math.PI*2*smooth(p);
  const c=Math.cos(angle),s=Math.sin(angle);
  const bottom=Math.min(...outline.map(([x,y])=>
    THREE_ROLL_PIVOT+(y-THREE_ROLL_PIVOT)*c+x*s));
  return {angle,lift:.01-bottom};
}

export function threeViewDimensions(logicalWidth:number):{left:number;right:number;top:number;bottom:number}{
  const width=Number.isFinite(logicalWidth)&&logicalWidth>0?logicalWidth:960;
  return {
    left:-width/(2*THREE_PIXELS_PER_UNIT),
    right:width/(2*THREE_PIXELS_PER_UNIT),
    top:PHASER_VIEW_HEIGHT/(2*THREE_PIXELS_PER_UNIT),
    bottom:-PHASER_VIEW_HEIGHT/(2*THREE_PIXELS_PER_UNIT),
  };
}
