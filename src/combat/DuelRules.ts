import { scaleDamage } from './CombatScale.ts';

/** A frozen, secret-choice showdown after a zero-damage heavy starter. */
export type DuelStrike = 'light' | 'heavy' | 'kick';
export type DuelChoice = DuelStrike | 'block' | null;
export type DuelOutcome = 'attacker' | 'defender' | 'guard' | 'tie';
export const DUEL_DURATION = 2;
export const DUEL_WHIFF_RECOVERY = .30;
/** Both hidden selections play as synchronized strikes before damage lands. */
export const DUEL_RESULT_ANIMATION = .55;
/** A correct defensive A punishes repeat challenges for half a second. */
export const DUEL_GUARD_STUN = .50;
export const DUEL_DAMAGE = scaleDamage(24);
export const DUEL_RUNA_DAMAGE = scaleDamage(28);
export const DUEL_TIE_PUSH = 330;
export const DUEL_GUARD_PUSH = 630;

/** The challenge may catch ONLY an idle upright opponent or one walking
 * left/right. Walking is intentionally not a restriction: it is a valid state.
 * Active guard is a separate defensive stance, not an idle/walking target.
 */
export interface DuelTargetState {
  airborne: boolean;
  crouching: boolean;
  isRolling: boolean;
  knockedDown: boolean;
  knockedOut: boolean;
  blocking: boolean;
  attackActive: boolean;
  grabActive: boolean;
  stunned: number;
  grabRecovery: number;
  comboRecovering: boolean;
  duelRecovering: boolean;
  recoiling: boolean;
  walking: boolean;
}
export function canDuelCatchTarget(target: DuelTargetState): boolean {
  return !target.airborne && !target.crouching && !target.isRolling &&
    !target.knockedDown && !target.knockedOut && !target.blocking &&
    !target.attackActive && !target.grabActive && target.stunned<=0 &&
    target.grabRecovery<=0 && !target.comboRecovering &&
    !target.duelRecovering && !target.recoiling;
}

export function forwardHeld(face: 1 | -1, left: boolean, right: boolean): boolean {
  return face===1 ? right && !left : left && !right;
}

/** A only belongs to the DEFENDER; the attacker must choose X/Y/B.
 * If no selection occurs before time runs out, an actual choice wins.
 * Identical attacks (or two timeouts) scatter the fighters.
 */
export function resolveDuel(attacker: DuelChoice, defender: DuelChoice): DuelOutcome {
  if(defender==='block') return 'guard';
  if(!attacker && !defender) return 'tie';
  if(!attacker) return 'defender';
  if(!defender) return 'attacker';
  if(attacker===defender) return 'tie';
  // Y beats X; X beats B; B beats Y.
  const wins: Record<DuelStrike,DuelStrike> = {
    heavy:'light', light:'kick', kick:'heavy',
  };
  return wins[attacker as DuelStrike]===defender ? 'attacker' : 'defender';
}

export function chooseDuelInput(
  choices: {light:boolean;heavy:boolean;kick:boolean;block:boolean},
  defender: boolean,
): DuelChoice {
  if(defender && choices.block) return 'block';
  if(choices.heavy) return 'heavy';
  if(choices.light) return 'light';
  if(choices.kick) return 'kick';
  return null;
}

/** Keep the most recent freshly pressed duel move until the two-second
 *  selection window closes. Releasing a key or pressing an invalid key
 *  never erases the last valid choice. The attacker cannot choose A.
 */
export function reviseDuelChoice(
  previous: DuelChoice,
  pressed: {light:boolean;heavy:boolean;kick:boolean;block:boolean},
  defender: boolean,
): DuelChoice {
  return chooseDuelInput(pressed,defender) ?? previous;
}

export function duelDamage(fighterIsRuna: boolean): number {
  return fighterIsRuna ? DUEL_RUNA_DAMAGE : DUEL_DAMAGE;
}
