/** Endless practice is independent of ranked CPU/PvP round rules.
 * The dummy's four selectable behaviors are restricted to practice.
 */
export type TrainingBehavior = 'passive' | 'guard' | 'attack' | 'both';

export const TRAINING_BEHAVIORS: ReadonlyArray<{
  id:TrainingBehavior;label:string;description:string
}> = [
  {id:'passive',label:'Пасивна',description:'Не рухається, не блокує й не атакує'},
  {id:'guard',label:'Блокує',description:'Тримає захист та змінює висоту блоку'},
  {id:'attack',label:'Атакує',description:'Зближується й атакує без звичайного блоку'},
  {id:'both',label:'Блокує та атакує',description:'Повноцінний CPU із захистом та атаками'},
];

export function shouldRestoreTrainingHealth(training:boolean,hp:number):boolean {
  return training && hp<=0;
}

export function trainingAttacks(behavior:TrainingBehavior):boolean {
  return behavior==='attack'||behavior==='both';
}
export function trainingGuards(behavior:TrainingBehavior):boolean {
  return behavior==='guard'||behavior==='both';
}
/** Hold the matching defense as the player demonstrates high/low attacks. */
export function trainingCrouchGuard(level:'high'|'mid'|'low'|null):boolean {
  return level==='low';
}
export function trainingDuelPick(
  behavior:TrainingBehavior,defender:boolean,variant:number,
):'light'|'heavy'|'kick'|'block'|null {
  if(behavior==='passive')return null;
  if(behavior==='guard')return defender?'block':null;
  const options=defender && behavior==='both'
    ? ['light','heavy','kick','block'] as const
    : ['light','heavy','kick'] as const;
  return options[Math.abs(variant)%options.length];
}
