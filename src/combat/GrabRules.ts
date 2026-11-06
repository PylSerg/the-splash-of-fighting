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
