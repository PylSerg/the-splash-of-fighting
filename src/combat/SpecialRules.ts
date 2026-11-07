/** Four true SPECIAL thresholds: only COMPLETELY filled sections contribute
 * to damage; all accumulated charge is consumed when casting. SPLASH uses
 * a separate gauge and deals exactly twice the maximum-strength special.
 */
import type { FighterId } from './Fighter';
import { scaleDamage } from './CombatScale.ts';

export const SPECIAL_MIN_CHARGE=15;
export const SPECIAL_METER_MAX=100;
export const SPECIAL_CHARGE_MARKS=[0,15,35,60,100] as const;

type SpecialDamageCurve=readonly [number,number,number,number];
const SPECIAL_DAMAGE_CURVES:Readonly<Record<FighterId,SpecialDamageCurve>>={
  evi: [13,17,21,26],
  runa:[16,20,24,30],
  lyra:[13,17,22,27],
  kai: [13,16,19,24],
};

export type SpecialTier=0|1|2|3|4;

/** A section only contributes when its RIGHT boundary is reached.
 * 15–34.999... -> 1, 35–59.999... -> 2, 60–99.999... -> 3,
 * exactly 100 -> 4. E.g. 99% still hits with completed 60% strength.
 */
export function specialChargeTier(charge:number):SpecialTier {
  // Meter gains are fractional (damage-based). Accept floating-point dust
  // at a mathematically completed boundary, never genuine partial charging.
  if(!Number.isFinite(charge))return 0;
  const filled=charge+1e-8;
  if(filled<SPECIAL_MIN_CHARGE)return 0;
  if(filled<35)return 1;
  if(filled<60)return 2;
  if(filled<100)return 3;
  return 4;
}

export function canLaunchSpecial(charge:number):boolean{
  return specialChargeTier(charge)>0;
}

/** Each completed stage has its own proportional damage (referenced to
 * the old 200 HP balance): no interpolation or partial section credit.
 */
export function specialDamageAt(fighter:FighterId,charge:number):number{
  const tier=specialChargeTier(charge);
  return tier===0?0:scaleDamage(SPECIAL_DAMAGE_CURVES[fighter][tier-1]);
}

export function fullSpecialDamage(fighter:FighterId):number{
  return scaleDamage(SPECIAL_DAMAGE_CURVES[fighter][3]);
}

/** A single launch consumes all charge, never merely the old fixed 40. */
export function spendSpecialCharge(charge:number):number{
  return canLaunchSpecial(charge)?0:charge;
}
