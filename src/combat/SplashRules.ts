/** Cinematic splash: deliberately independent of normal (damage-based) special energy. */
export const SPLASH_METER_MAX = 100;
export const SPLASH_WINDUP = 0.5;
export const SPLASH_COMBO_COMPLETE_GAIN = 24;
export const SPLASH_DUEL_WIN_GAIN = 26;

export type SplashId = 'evi' | 'runa' | 'lyra' | 'kai';
export interface SplashMove {
  name: string;
  /** Includes the initial 0.5-second reactable animation. */
  duration: number;
  damage: number;
  pulses: number;
  color: number;
}
/** These are distinct, full-length finishers, not reskinned normal specials. */
export const SPLASH_MOVES: Record<SplashId, SplashMove> = {
  evi:  {name:'Танець кришталевого віяла', duration:2.55, damage:43, pulses:7, color:0xf49bc8},
  runa: {name:'Хвиля Мідного Бастіону', duration:2.90, damage:50, pulses:5, color:0xefac76},
  lyra: {name:'Полум’яний вихор', duration:2.65, damage:45, pulses:6, color:0xffb165},
  kai:  {name:'Гроза тисячі іскор', duration:2.35, damage:40, pulses:9, color:0x6ce5f7},
};
/** Visual guided projectile position. The last position is EXACTLY the
 * target on any arena width; no range checks or projectile dodge frames.
 * A successful down+A guard still nullifies splash damage.
 */
export function guidedSplashPosition(
  origin:{x:number;y:number}, target:{x:number;y:number}, progress:number,
): {x:number;y:number} {
  const t=Math.min(1,Math.max(0,progress)*1.3);
  const smooth=t*t*(3-2*t);
  return {x:origin.x+(target.x-origin.x)*smooth,
    y:origin.y+(target.y-origin.y)*smooth-Math.sin(Math.PI*t)*44};
}

export function earnSplashEnergy(current:number, bonus:number): number {
  if (!Number.isFinite(bonus) || bonus<=0) return current;
  return Math.min(SPLASH_METER_MAX,Math.max(0,current)+bonus);
}
/** Only a FULL, clean three-hit combo earns splash energy. */
export function comboSplashBonus(cleanHits:number): number {
  return cleanHits===3 ? SPLASH_COMBO_COMPLETE_GAIN : 0;
}
export function splashChord(buttons:{
  up:boolean; light:boolean; heavy:boolean; l1:boolean; r1:boolean;
}): boolean {
  return buttons.up && ((buttons.light&&buttons.heavy)||(buttons.l1&&buttons.r1));
}
export function canSplashGuard(state:{
  down:boolean; block:boolean; airborne:boolean; knockedDown:boolean;
  knockedOut:boolean; stunned:number; guarding:boolean;
}): boolean {
  return state.down && state.block && state.guarding &&
    !state.airborne && !state.knockedDown && !state.knockedOut && state.stunned<=0;
}
