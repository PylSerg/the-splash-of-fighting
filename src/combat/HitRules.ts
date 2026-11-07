/** Arcade attack lanes: high passes over crouching fighters, low reaches feet. */
export type HitLevel = 'high' | 'mid' | 'low';
export type GuardStance = 'standing' | 'crouching' | 'none';

/** Damage multiplier for a strike coming from outside the direction a fighter faces. */
export const BACK_STRIKE_MULTIPLIER = 1.5;

/** Defense is directional: a fighter looking right is exposed on the left,
 * and vice versa. Keep the check independent of the attacker's facing.
 */
export function isBackStrike(
  attackerX: number, defenderX: number, defenderFace: 1 | -1,
): boolean {
  return (attackerX-defenderX)*defenderFace<0;
}

/** A special that connects with a valid frontal guard shatters it for half
 * damage. A rear hit bypasses guard entirely and earns its back-hit bonus.
 */
export function strikeDamage(
  baseDamage: number, rear: boolean, breaksGuard: boolean,
): number {
  if(breaksGuard)return Math.ceil(baseDamage/2);
  if(rear)return Math.ceil(baseDamage*BACK_STRIKE_MULTIPLIER);
  return baseDamage;
}

export const HIT_LEVEL_NAMES: Readonly<Record<HitLevel,string>> = {
  high: 'верхня',
  mid: 'середня',
  low: 'нижня',
};

/** A standing guard covers high/mid; a crouching guard covers mid/low. */
export function stopsHit(guard: GuardStance, attack: HitLevel): boolean {
  if (guard === 'standing') return attack !== 'low';
  if (guard === 'crouching') return attack !== 'high';
  return false;
}

/** Relative to the character's feet (negative means above ground).
 * Grounded crouching hurtboxes reach from -73 to -1. A high attack ends
 * at -81, so it passes OVER a crouched fighter even without blocking.
 */
export function strikeBand(level: HitLevel): { top: number; height: number } {
  switch (level) {
    case 'high': return { top: -151, height: 70 }; // bottom -81
    case 'mid':  return { top: -113, height: 87 }; // bottom -26
    case 'low':  return { top: -60, height: 58 };  // bottom -2
  }
}
