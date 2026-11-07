import type { AttackName } from './Fighter';

/** The two generated sheets are prototypes, not full frame-by-frame motion
 * atlases. Every named state maps to one representative pose, preserving
 * the authoritative frame timing/hitboxes owned by Fighter and Arena.
 */
export const EVI_COMBAT_COLUMNS=7;
export const EVI_COMBAT_ROWS=3;
export const EVI_CINEMATIC_COLUMNS=5;
export const EVI_CINEMATIC_ROWS=2;
export const EVI_CINEMATIC_SECONDS=2;

export type EviSpriteState={
  cinematic?:{kind:'intro'|'victory';elapsed:number}|null;
  splash?:'startup'|'attack'|'victim'|'guard'|null;
  attack?:{name:AttackName;elapsed:number;startup:number}|null;
  grab?:'reach'|'hold'|'held'|'throw'|null;
  knockdown?:'flying'|'prone'|'rising'|'ko'|null;
  rolling?:boolean;
  airborne?:boolean;
  blocking?:boolean;
  crouching?:boolean;
  stunned?:boolean;
  walking?:boolean;
  movingForward?:boolean;
  time?:number;
};
export type EviVisualFrame={sheet:'combat'|'cinematic';frame:number};

export function frameForEvi(state:EviSpriteState):EviVisualFrame{
  if(state.cinematic){
    const p=Math.min(1,Math.max(0,state.cinematic.elapsed/EVI_CINEMATIC_SECONDS));
    const offset=state.cinematic.kind==='victory'?5:0;
    return {sheet:'cinematic',frame:offset+Math.min(4,Math.floor(p*5))};
  }
  if(state.splash){
    switch(state.splash){
      case 'startup':return {sheet:'combat',frame:19};
      case 'attack':return {sheet:'combat',frame:20};
      case 'victim':return {sheet:'combat',frame:15};
      case 'guard':return {sheet:'combat',frame:6};
    }
  }
  if(state.knockdown){
    switch(state.knockdown){
      case 'flying':return {sheet:'combat',frame:15};
      case 'prone':case 'ko':return {sheet:'combat',frame:16};
      case 'rising':return {sheet:'combat',frame:4};
    }
  }
  if(state.grab){
    switch(state.grab){
      case 'reach':return {sheet:'combat',frame:14};
      case 'hold':return {sheet:'combat',frame:14};
      case 'held':return {sheet:'combat',frame:15};
      case 'throw':return {sheet:'combat',frame:10};
    }
  }
  if(state.rolling)return {sheet:'combat',frame:13}; // TEMP: no real roll frames
  if(state.attack){
    switch(state.attack.name){
      case 'light':return {sheet:'combat',frame:10};
      case 'heavy':case 'duel':return {sheet:'combat',frame:9};
      case 'kick':return {sheet:'combat',frame:11};
      case 'crouchMid':return {sheet:'combat',frame:12};
      case 'sweep':return {sheet:'combat',frame:13};
      case 'special':return {sheet:'combat',frame:
        state.attack.elapsed<state.attack.startup*.70?17:18};
    }
  }
  if(state.stunned)return {sheet:'combat',frame:15};
  if(state.blocking)return {sheet:'combat',frame:state.crouching?6:5};
  if(state.crouching)return {sheet:'combat',frame:4};
  if(state.airborne)return {sheet:'combat',frame:8}; // TEMP: jump start/land missing
  if(state.walking)return {sheet:'combat',frame:state.movingForward?2:3};
  return {sheet:'combat',frame:((state.time??0)%4)<.30?1:0};
}

export function atlasRects(width:number,height:number,columns:number,rows:number):
 {name:string;x:number;y:number;width:number;height:number}[]{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||
    !Number.isSafeInteger(columns)||!Number.isSafeInteger(rows)||
    columns<1||rows<1)throw new Error('Invalid sprite sheet dimensions');
  const list:{name:string;x:number;y:number;width:number;height:number}[]=[];
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const x=Math.round(width*col/columns), y=Math.round(height*row/rows);
    list.push({
      name:'f'+(row*columns+col),x,y,
      width:Math.round(width*(col+1)/columns)-x,
      height:Math.round(height*(row+1)/rows)-y,
    });
  }
  return list;
}

/** Missing frames reported BEFORE drawing more art. Existing static frames
 * do not substitute for genuine intermediate animation in a finished build.
 */
export const EVI_MISSING_ANIMATIONS=[
  'Ходьба вперед і назад: 4–6 проміжних кадрів на напрямок',
  'Стрибок: зліт, вершина, приземлення та приземний рух',
  'Перекат: принаймні 6–8 кадрів обертання',
  'Вставання після падіння: 4–6 кадрів',
  'Отримання удару: окремі високий, середній, низький, блокований і відкидання',
  'Удари X/Y/B, присілий X/B: реальні startup, active, recovery між ключовими позами',
  'Захват і кидок: захоплення, утримання, контрзахват, розворот і відпускання',
  'Дуель: окремі кадри трьох атак, перемоги, програшу та CLASH',
  'Спецприйом і SPLASH: повна мальована послідовність, політ віяла й повернення',
  'Двосекундні вступ/перемога: наразі по 5 ключових поз, потрібні плавні переходи',
] as const;
