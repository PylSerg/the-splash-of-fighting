/** Three-strike arcade chains. Only normal standing X/B/Y attacks count.
 * A route must be entered sequentially, pressing each button AFTER the
 * previous impact, within the link window. Holding buttons does not auto-combo.
 */
export type ComboMove = 'light' | 'kick' | 'heavy';
export const COMBO_ROUTES: readonly (readonly [ComboMove,ComboMove,ComboMove])[] = [
  ['light','kick','heavy'], // X B Y
  ['light','heavy','kick'], // X Y B
  ['kick','light','heavy'], // B X Y
  ['kick','heavy','light'], // B Y X
  ['heavy','light','kick'], // Y X B
  ['heavy','kick','light'], // Y B X
];
export const COMBO_LINK_WINDOW = 0.80;
export const COMBO_FINISH_RECOVERY = 0.42;

/** All prefixes must be an explicit route to prevent random chaining. */
export function comboAllows(prefix: readonly ComboMove[], next: ComboMove): boolean {
  return prefix.length>0 && prefix.length<3 &&
    COMBO_ROUTES.some(route =>
      prefix.every((move,index)=>route[index]===move) &&
      route[prefix.length]===next);
}

/** A blockable first or second strike forfeits the unblockable finisher.
 * Both attacks must CONNECT and deal >0 HP (no overkill, dodge or whiff).
 */
export function comboFinisherUnblockable(
  stage: number, twoEarlierCleanHits: boolean,
): boolean {
  return stage===3 && twoEarlierCleanHits;
}

/** An otherwise valid finisher is still avoidable by spacing, crouching
 * beneath a high attack or roll invulnerability. Guard is ignored only
 * once the collision has genuinely happened.
 */
export function comboIsCleanHit(blocked: boolean, actualDamage: number): boolean {
  return !blocked && actualDamage>0;
}
