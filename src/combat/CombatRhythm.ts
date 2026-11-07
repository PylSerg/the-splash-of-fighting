/** Combat timing is deliberately independent of temporary fighter drawings.
 * Every value is in seconds or physical stage units, so future sprite sheets
 * can use the same startup/active/recovery windows without changing rules.
 */
import type { AttackName, FighterId } from './Fighter';

export type AttackPhase = 'startup' | 'active' | 'recovery' | 'finished';

export interface FighterStyle {
  readonly movement: number;
  readonly attackingMovement: number;
  readonly guardingMovement: number;
  readonly startup: Partial<Record<AttackName,number>>;
  readonly reach: Partial<Record<AttackName,number>>;
  readonly recovery: number;
  readonly comboWindow: number;
  readonly rollDistance: number;
  readonly rollCooldown: number;
}

export const FIGHTER_STYLES: Readonly<Record<FighterId,FighterStyle>> = {
  evi: {
    movement:1.14, attackingMovement:1.08, guardingMovement:1.04,
    startup:{light:.84,kick:.90,heavy:.91,crouchMid:.88},
    reach:{light:1.02,kick:1.04,heavy:1.08,duel:1.08},
    recovery:.09, comboWindow:.92,
    rollDistance:1.04, rollCooldown:.94,
  },
  runa: {
    movement:.80, attackingMovement:.80, guardingMovement:.80,
    startup:{},reach:{},
    recovery:.18, comboWindow:.78,
    rollDistance:.84, rollCooldown:1.08,
  },
  lyra: {
    movement:.98, attackingMovement:.93, guardingMovement:1,
    startup:{light:1.04,kick:1.06,heavy:1.06},
    reach:{light:1.14,kick:1.24,heavy:1.18,crouchMid:1.12,sweep:1.10,special:1.15},
    recovery:.14, comboWindow:.83,
    rollDistance:.96, rollCooldown:1,
  },
  kai: {
    movement:1.27, attackingMovement:1.16, guardingMovement:1.12,
    startup:{light:.86,kick:.90,crouchMid:.91},
    reach:{light:.98,kick:1.02},
    recovery:.10, comboWindow:.83,
    rollDistance:1.23, rollCooldown:.84,
  },
};

export const WAKEUP_PROTECTION = .18;

/** Existing spec.duration is the telegraphed startup time until extension.
 * The collision stays active briefly after this, once per target/attack,
 * followed by a separate punishable recovery window.
 */
export const ATTACK_ACTIVE: Readonly<Record<AttackName,number>> = {
  light:.05, heavy:.08, kick:.07, special:.10,
  sweep:.07, crouchMid:.05, duel:1/60,
};

export function phaseOfAttack(
  name:AttackName,elapsed:number,startup:number,recovery:number,
):AttackPhase {
  if(elapsed<startup)return 'startup';
  if(elapsed<startup+ATTACK_ACTIVE[name])return 'active';
  if(elapsed<startup+ATTACK_ACTIVE[name]+recovery)return 'recovery';
  return 'finished';
}

export function attackRecovery(fighter:FighterId,name:AttackName):number {
  // Keep the challenge animation's full follow-through non-cancellable.
  return name==='duel' ? .12 : FIGHTER_STYLES[fighter].recovery;
}

export function styledAttack<T extends {duration:number;reach:number}>(
  fighter:FighterId,name:AttackName,spec:T,
):T {
  const style=FIGHTER_STYLES[fighter];
  return {...spec,
    duration:Math.round(spec.duration*(style.startup[name]??1)*1000)/1000,
    reach:Math.round(spec.reach*(style.reach[name]??1)*10)/10,
  };
}

export function hitstopSeconds(name:AttackName,blocked=false,clash=false):number {
  if(clash)return .055;
  if(blocked)return .035;
  switch(name){
    case 'light':case 'crouchMid':return .04;
    case 'kick':case 'sweep':return .06;
    case 'heavy':return .08;
    case 'special':return .11;
    case 'duel':return 0;
  }
}

export function blockstunSeconds(name:AttackName):number {
  switch(name){
    case 'light':case 'crouchMid':return .10;
    case 'kick':case 'sweep':return .13;
    case 'heavy':return .18;
    case 'special':return .24;
    case 'duel':return 0;
  }
}
