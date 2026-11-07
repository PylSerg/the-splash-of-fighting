/** Shared rules for slow special-meter gain and lagging health feedback. */
export const MAX_HEALTH = 200;
import { SPECIAL_MIN_CHARGE, SPECIAL_METER_MAX } from './SpecialRules.ts';
export { SPECIAL_MIN_CHARGE, SPECIAL_METER_MAX };
/** Roughly 25 actual HP damage earns the minimum 15% special charge;
 * 167 damage fills 100% of the normal special bar. */
export const METER_PER_DAMAGE = 0.6;

/** Only actual HP removed from the rival counts. Blocks, misses,
 * avoided strikes and attempted overkill contribute zero.
 */
export function earnSpecialMeter(current: number, damageDealt: number): number {
  if (!Number.isFinite(damageDealt) || damageDealt <= 0) return current;
  return Math.min(SPECIAL_METER_MAX, current + damageDealt * METER_PER_DAMAGE);
}

export interface HealthTrail {
  /** Red underlying bar, kept >= the current health while a hit fades. */
  displayed: number;
  /** Most recent actual health, updated on every hit. */
  target: number;
  /** Red stays at this value until its delay ends. */
  from: number;
  elapsed: number;
}
export const HEALTH_TRAIL_TOTAL = 0.5;
export const HEALTH_TRAIL_HOLD = 0.35;
export const makeHealthTrail = (hp: number): HealthTrail =>
  ({displayed:hp,target:hp,from:hp,elapsed:HEALTH_TRAIL_TOTAL});

/** 350ms of full red damage, followed by a 150ms smooth catch-up.
 * A second hit restarts the trail from its current visible location.
 */
export function advanceHealthTrail(old: HealthTrail, hp: number, dt: number): HealthTrail {
  const health = Math.max(0, Math.min(MAX_HEALTH, hp));
  if (health > old.target) return makeHealthTrail(health); // heal/reset
  const changed = health < old.target;
  const from = changed ? Math.max(old.displayed,health) : old.from;
  const elapsed = changed ? 0 : Math.min(HEALTH_TRAIL_TOTAL,old.elapsed+Math.max(0,dt));
  const progress = Math.min(1,Math.max(0,
    (elapsed-HEALTH_TRAIL_HOLD)/(HEALTH_TRAIL_TOTAL-HEALTH_TRAIL_HOLD)));
  return {
    displayed:health+(from-health)*(1-progress),
    target:health,from,elapsed,
  };
}

/** Two bars have identical anchoring, allowing a clean red exposed segment. */
export function healthFillRect(x: number, width: number, percent: number, right: boolean) {
  const w=width*Math.max(0,Math.min(100,percent))/100;
  return {x:right?x+width-w:x,width:w};
}
