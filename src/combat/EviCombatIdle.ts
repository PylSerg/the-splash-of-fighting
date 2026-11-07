/** Six authentic transparent PNGs for Evi's standing combat idle.
 * This is artwork-only: hitboxes, fighter physics and attack logic stay
 * wholly inside Fighter. It is independent of the character-select idle.
 */
export const EVI_COMBAT_IDLE_COUNT=6;
export const EVI_COMBAT_IDLE_FRAME_MS=185;
export const EVI_COMBAT_IDLE_SOURCE_WIDTH=512;
export const EVI_COMBAT_IDLE_SOURCE_HEIGHT=768;
/** The PNGs share the exact same floor row after torso/foot alignment. */
export const EVI_COMBAT_IDLE_FOOT_ORIGIN_Y=741/768;
/** The character silhouette is ~475/768 of the source height.
 * 308px display height makes the visible standing fighter ~190px tall.
 */
export const EVI_COMBAT_IDLE_DISPLAY_HEIGHT=308;
export const EVI_COMBAT_IDLE_DISPLAY_WIDTH=
  EVI_COMBAT_IDLE_DISPLAY_HEIGHT*EVI_COMBAT_IDLE_SOURCE_WIDTH/
  EVI_COMBAT_IDLE_SOURCE_HEIGHT;

export function eviCombatIdleKey(index:number):string{
  if(!Number.isInteger(index)||index<0||index>=EVI_COMBAT_IDLE_COUNT)
    throw new Error('Invalid Evi combat idle sprite index: '+index);
  return 'evi-battle-idle-'+index;
}

/** Respect Vite's base path on GitHub Pages and at localhost. */
export function eviCombatIdleAssetUrl(index:number,baseUrl:string):string{
  const base=baseUrl.endsWith('/')?baseUrl:baseUrl+'/';
  return base+'assets/evi/combat-idle/fight_idle_'+
    String(index+1).padStart(3,'0')+'.png';
}

/** Seamless ping-pong 0..5..0, no last-to-first teleport or duplicate ends. */
export function eviCombatIdleFrame(elapsedSeconds:number,count=EVI_COMBAT_IDLE_COUNT):number{
  if(count<=1)return 0;
  const time=Number.isFinite(elapsedSeconds)?Math.max(0,elapsedSeconds):0;
  const step=Math.floor(time*1000/EVI_COMBAT_IDLE_FRAME_MS);
  const last=count-1;
  const phase=step%(2*last);
  return phase<=last?phase:2*last-phase;
}
