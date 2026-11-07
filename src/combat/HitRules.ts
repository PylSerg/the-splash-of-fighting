import type { FighterId } from './Fighter';

/** Arcade attack lanes: high passes over crouching fighters, low reaches feet. */
export type HitLevel = 'high' | 'mid' | 'low';

/** Single source of truth for the three standing attacks. */
export const STANDING_ATTACK_LANES = {
  heavy:'high', light:'mid', kick:'low',
} as const satisfies Record<'heavy'|'light'|'kick',HitLevel>;
export type GuardStance = 'standing' | 'crouching' | 'none';

/** An active low/standing guard holds its initial facing, including the
 * frame A was first pressed. A character may turn again after releasing A.
 */
export function canAutoTurn(
  face:1|-1,
  input:{block:boolean;left:boolean;right:boolean;up:boolean},
  airborne:boolean,stunned:number,knockedDown:boolean,
):boolean {
  const forward=face===1?input.right:input.left;
  const guardHeld=input.block && !airborne && !input.up &&
    !forward && stunned<=0;
  return !knockedDown && !guardHeld;
}

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

/** Per-character hurtboxes are independent of the art's entire bounding
 * rectangle: hair, loose fabric, weapons and extended hands are NOT the body.
 * Values are in world pixels relative to each fighter's grounded foot pivot.
 * The normal stance follows the torso/head and the low stance stays below Y.
 *
 * Evi's new 512×768 six-frame combat artwork needs top -210, not -222:
 * the old shared box extended visibly ABOVE her head. Runa's larger hair
 * silhouette is decoration, not damageable flesh. Lyra and Kai each have
 * their own provisional values until their authored sprites are added.
 *
 * The debug green rectangles and real strike/duel checks read the SAME data.
 */

export interface HurtboxProfile {
  readonly halfWidth:number;
  readonly top:number;
  readonly bottom:number;
}
export type FighterHurtboxProfile = {
  readonly standing:HurtboxProfile;
  readonly low:HurtboxProfile;
};

/** One calibrated upright + crouch/roll profile per playable fighter. */
export const FIGHTER_HURTBOX:Readonly<Record<FighterId,FighterHurtboxProfile>> = {
  evi: {
    standing:{halfWidth:33,top:-210,bottom:-2},
    low:     {halfWidth:28,top:-81,bottom:-1},
  },
  runa: {
    standing:{halfWidth:29,top:-184,bottom:-2},
    low:     {halfWidth:27,top:-79,bottom:-1},
  },
  lyra: {
    standing:{halfWidth:28,top:-190,bottom:-2},
    low:     {halfWidth:26,top:-78,bottom:-1},
  },
  kai: {
    standing:{halfWidth:26,top:-179,bottom:-2},
    low:     {halfWidth:24,top:-76,bottom:-1},
  },
};

export function fighterHurtboxBand(
  fighter:FighterId,low:boolean,
):{halfWidth:number;top:number;height:number}{
  const hit=low?FIGHTER_HURTBOX[fighter].low:
    FIGHTER_HURTBOX[fighter].standing;
  return {halfWidth:hit.halfWidth,top:hit.top,height:hit.bottom-hit.top};
}

/** Attack lanes keep their current reach and timings while hurtboxes
 * become fighter-specific. High Y ends at -92, above the highest crouching
 * profile (-81), so it misses every crouched/rolling opponent.
 * Mid and low bands continue to intersect all standing/low profiles.
 */
export function strikeBand(level: HitLevel): { top: number; height: number } {
  switch (level) {
    case 'high': return { top: -232, height: 140 }; // bottom -92, covers head
    case 'mid':  return { top: -127, height: 100 }; // bottom -27
    case 'low':  return { top: -67, height: 65 };   // bottom -2
  }
}
