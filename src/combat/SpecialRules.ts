/** Four readable meter bands and a smooth strength curve.
 * Charging beyond a band boundary increases damage instead of granting the
 * full 100% hit at 61%. A move costs the ENTIRE current normal special meter.
 * SPLASH uses a separate gauge and deals exactly twice a full special.
 */
import type { FighterId } from './Fighter';

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

/** Tier 0 has insufficient charge; the 4 displayed bands are 0–15,
 * 16–35, 36–60 and 61–100. The initial band becomes usable at 15%.
 */
export function specialChargeTier(charge:number):SpecialTier{
  if(!Number.isFinite(charge)||charge<SPECIAL_MIN_CHARGE)return 0;
  if(charge<=15)return 1;
  if(charge<=35)return 2;
  if(charge<=60)return 3;
  return 4;
}

export function canLaunchSpecial(charge:number):boolean{
  return specialChargeTier(charge)>0;
}

/** Interpolate between 15%, 35%, 60%, 100% to reward waiting for
 * full charge. Round to integral HP to keep the normal combat UI readable.
 */
export function specialDamageAt(fighter:FighterId,charge:number):number{
  if(!canLaunchSpecial(charge))return 0;
  const q=Math.min(SPECIAL_METER_MAX,Math.max(15,charge));
  const curve=SPECIAL_DAMAGE_CURVES[fighter];
  const knots=[15,35,60,100];
  for(let i=0;i<3;i++){
    if(q<=knots[i+1]){
      const t=(q-knots[i])/(knots[i+1]-knots[i]);
      return Math.round(curve[i]+(curve[i+1]-curve[i])*t);
    }
  }
  return curve[3];
}

export function fullSpecialDamage(fighter:FighterId):number{
  return SPECIAL_DAMAGE_CURVES[fighter][3];
}

/** A single launch consumes all charge, never merely the old fixed 40. */
export function spendSpecialCharge(charge:number):number{
  return canLaunchSpecial(charge)?0:charge;
}
