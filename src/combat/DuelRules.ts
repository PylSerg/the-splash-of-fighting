/** A frozen, secret-choice showdown after a zero-damage heavy starter. */
export type DuelStrike = 'light' | 'heavy' | 'kick';
export type DuelChoice = DuelStrike | 'block' | null;
export type DuelOutcome = 'attacker' | 'defender' | 'guard' | 'tie';
export const DUEL_DURATION = 2;
export const DUEL_WHIFF_RECOVERY = .30;
export const DUEL_DAMAGE = 24;
export const DUEL_RUNA_DAMAGE = 28;
export const DUEL_TIE_PUSH = 330;
export const DUEL_GUARD_PUSH = 630;

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

export function duelDamage(fighterIsRuna: boolean): number {
  return fighterIsRuna ? DUEL_RUNA_DAMAGE : DUEL_DAMAGE;
}
