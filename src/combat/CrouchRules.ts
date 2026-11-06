/** Which attacks may begin while crouching.
 * The standing high Y, super B+Y, grab A+X and roll chords have priority
 * over accidental button edges and must never become crouching strikes.
 */
export type CrouchMove = 'sweep' | 'crouchMid';
export interface CrouchInput {
  down: boolean;
  grounded: boolean;
  blocking: boolean;
  grabbing: boolean;
  rolling: boolean;
  special: boolean;
  light: boolean;
  kick: boolean;
  heavy: boolean;
}
export function crouchMoveForPress(input: CrouchInput): CrouchMove | null {
  if (!input.down || !input.grounded || input.blocking ||
      input.grabbing || input.rolling || input.special || input.heavy) return null;
  if (input.light && !input.kick) return 'sweep';
  if (input.kick && !input.light) return 'crouchMid';
  return null;
}

/** A sweep trips only on an actual unguarded hit to a grounded fighter.
 * A blocked sweep deals no damage and NEVER triggers knockdown.
 */
export function sweepTrips(
  move: string, blocked: boolean, targetAirborne: boolean, targetKnockedOut: boolean,
): boolean {
  return move==='sweep' && !blocked && !targetAirborne && !targetKnockedOut;
}
