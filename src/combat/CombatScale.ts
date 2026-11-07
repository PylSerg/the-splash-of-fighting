/** Central combat balance reference.
 * Old values were tuned for 200 HP. Store them as percentages of the
 * reference HP and resolve them against the current 500 HP pool.
 * Changing MAX_HEALTH later requires no manual attack damage rewrites.
 */
export const BALANCE_REFERENCE_HP=200;
export const MAX_HEALTH=500;

/** Round at the final HP amount; all attacks keep the same relative power. */
export function scaleDamage(referenceDamage:number):number {
  if(!Number.isFinite(referenceDamage)||referenceDamage<=0)return 0;
  return Math.round(referenceDamage / BALANCE_REFERENCE_HP * MAX_HEALTH);
}

export function damagePercent(hp:number):number {
  return hp/MAX_HEALTH*100;
}

/** Reward percentages based on actual HP lost, independent of health scale. */
export function earnedMeterFromDamage(hpRemoved:number,referenceRate=.6):number {
  if(!Number.isFinite(hpRemoved)||hpRemoved<=0)return 0;
  return hpRemoved/MAX_HEALTH*BALANCE_REFERENCE_HP*referenceRate;
}
