/** Pure ABXY/gamepad chord resolver for duel and special inputs.
 * Forward direction is validated separately against each fighter's facing.
 */
export interface CommandButtons {
  block: boolean;
  kick: boolean;
  heavy: boolean;
  r1Solo: boolean;
  r1AndR2: boolean;
  duelSwipe: boolean;
  specialSwipe: boolean;
}
export function deriveCommandChords(b: CommandButtons): {duel:boolean;special:boolean} {
  const special=(b.block && b.kick) || b.r1AndR2 || b.specialSwipe;
  // New A+B / R1+R2 special always wins over a conflicting duel chord.
  const duel=!special && ((b.kick && b.heavy) || b.r1Solo || b.duelSwipe);
  return {duel,special};
}
