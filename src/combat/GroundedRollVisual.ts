/** Visual-only parameters for a low, grounded 0.46-second roll.
 * Gameplay (distance, invulnerability, recovery) remains in Fighter.
 *
 * The previous effect rotated the full body 2π around a pivot 80 pixels
 * above the feet, which made the character fly in an arc (seen in playtest).
 * This avoids moving the whole fighter around any elevated pivot. A pixel
 * puppet folds its own joints; legacy rigs use modest grounded compression.
 */
export interface GroundedRollVisual {
  /** Animation-time progress, clamped to [0,1]. */
  progress:number;
  /** Temporary tuck; exactly zero at the start and finish. */
  tuck:number;
  /** Max vertical lift is only 3px, NOT a 160px body-pivot arc. */
  lift:number;
  /** Squash only the procedural/sprite-sheet fallback, feet stay planted. */
  fallbackScaleY:number;
  /** Minimal rocking angle for the non-articulated fallback. */
  fallbackLean:number;
  shadowScale:number;
}

export function groundedRollVisual(progress:number,backwards=false):GroundedRollVisual {
  const q=Number.isFinite(progress)?Math.min(1,Math.max(0,progress)):0;
  // Smoothly fold at the beginning and unfold before the end.
  const tuck=Math.pow(Math.sin(Math.PI*q),2);
  const direction=backwards?-1:1;
  return {
    progress:q,
    tuck,
    lift:-3*tuck,
    fallbackScaleY:1-.35*tuck,
    fallbackLean:direction*.06*Math.sin(2*Math.PI*q),
    shadowScale:1-.23*tuck,
  };
}
