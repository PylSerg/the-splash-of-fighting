/** Resolve two impact-frame strikes from the SAME pre-damage snapshot.
 * A mutual connection is a guard-style collision, not a simultaneous trade.
 */
export interface ClashRect { x:number; y:number; w:number; h:number; }
export interface ClashAttempt {
  /** Null = no impact on this simulation frame. */
  name: string;
  strikeBox: ClashRect | null;
  rivalBody: ClashRect;
  rivalKnockedOut: boolean;
  rivalKnockedDown: boolean;
  rivalRollInvulnerable: boolean;
  rivalAirborne: boolean;
}
export function strikeTouchesRival(attempt: ClashAttempt | null): boolean {
  if(!attempt || attempt.name==='duel' || !attempt.strikeBox ||
      attempt.rivalKnockedOut || attempt.rivalKnockedDown ||
      attempt.rivalRollInvulnerable ||
      (attempt.name==='sweep' && attempt.rivalAirborne)) return false;
  const a=attempt.strikeBox,b=attempt.rivalBody;
  return a.x<b.x+b.w && a.x+a.w>b.x &&
    a.y<b.y+b.h && a.y+a.h>b.y;
}
/** Both actual attacks must reach the other's hurtbox on the SAME fixed step.
 * Their ordinary guarding status, attack strength or combo stage does not
 * grant priority; both attacks are instead treated as blocked.
 */
export function isSimultaneousClash(a: ClashAttempt | null,b: ClashAttempt | null): boolean {
  return strikeTouchesRival(a) && strikeTouchesRival(b);
}
