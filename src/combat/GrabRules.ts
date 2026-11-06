/** Standing/walking fighters can be grabbed. A crouch, jump, or roll
 * avoids the grab, even if the input starts on the very same simulation frame.
 * Horizontal movement is deliberately ignored: walking is always valid.
 */
export interface GrabTargetState {
  crouching: boolean;
  airborne: boolean;
  knockedDown: boolean;
  knockedOut: boolean;
  isRolling: boolean;
}
export interface GrabTargetIntent {
  down: boolean;
  up: boolean;
  jump: boolean;
}

export function canBeGrabbed(target: GrabTargetState, intent: GrabTargetIntent): boolean {
  return !target.crouching && !target.airborne &&
    !target.knockedDown && !target.knockedOut && !target.isRolling &&
    !intent.down && !intent.up && !intent.jump;
}

/** Blocking a grab repels only the ATTACKER, away from the defender.
 * An initial 170 px/s impulse decays in Fighter.step() to a short
 * approximately 50 px push, rather than a damaging knockdown or throw.
 */
export function blockedGrabRecoil(attackerX: number, defenderX: number, facing: 1 | -1): number {
  const away=attackerX===defenderX ? -facing : attackerX<defenderX ? -1 : 1;
  return away*170;
}
