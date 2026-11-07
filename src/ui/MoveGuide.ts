import type { FighterId } from '../combat/Fighter';
import { FIGHTER_STYLES } from '../combat/CombatRhythm.ts';
import { COMBO_ROUTES } from '../combat/ComboRules.ts';
import { SPLASH_MOVES } from '../combat/SplashRules.ts';
import { getCharacter } from '../characters/Roster.ts';

export type GuideMove = { buttons:string; description:string };
export type GuideSection = { title:string; moves:GuideMove[] };
export type MoveGuide = {
  fighter:FighterId; name:string; subtitle:string; notes:string;
  sections:GuideSection[];
};

const LABELS={light:'X',heavy:'Y',kick:'B'} as const;

/** One shared move list is generated from the actual combo routes, character
 * profiles, and SPLASH definition. It also drives the pause menu for PvP.
 */
export function getMoveGuide(fighter:FighterId):MoveGuide {
  const character=getCharacter(fighter);
  const style=FIGHTER_STYLES[fighter];
  const runa=fighter==='runa';
  const short=(number:number)=>String(number).replace('.',',');
  const heavyDamage=runa?14:11;
  const specialDamage=runa?23:20;
  const throwDamage=runa?21:16;
  const cleanComboBonus=24;
  return {
    fighter,
    name:character.name,
    subtitle:character.title+' · '+(character.weapon??'Бойові прийоми'),
    notes:'Вікно продовження комбо: '+short(style.comboWindow)+' с. '+
      'Другий і третій удари вводяться лише після влучання попереднього. '+
      'Третій чистий удар пробиває блок і додає +'+cleanComboBonus+' SPLASH.',
    sections:[
      {title:'Основні атаки',moves:[
        {buttons:'Y',description:'Висока сильна атака · '+heavyDamage+' HP. Промахується над присілим суперником.'},
        {buttons:'X',description:'Середня швидка атака · 5 HP.'},
        {buttons:'B',description:'Нижня атака ногою · 9 HP. Проходить під стоячим блоком.'},
        {buttons:'↓ + X',description:'Середній швидкий удар навприсядки · '+(runa?5:4)+' HP.'},
        {buttons:'↓ + B',description:'Нижня підсічка · '+(runa?6:5)+' HP. Збиває з ніг, якщо не заблокована.'},
      ]},
      {title:'Спеціальні дії та захист',moves:[
        {buttons:'Вперед + A + B',description:'Спецприйом · '+specialDamage+' HP, потребує 40 звичайної енергії. Пробиває блок за 50% шкоди.'},
        {buttons:'Вперед + B + Y',description:'Виклик на таємну дуель · вибір X/Y/B протягом 2 с. Захисник може обрати A.'},
        {buttons:'↑ + X + Y',description:'SPLASH: «'+SPLASH_MOVES[fighter].name+'» · '+SPLASH_MOVES[fighter].damage+' HP. Потрібно 100 заряду.'},
        {buttons:'↑ + X + Y / ↑ + L1 + R1',description:'Утримуй ↑ й затисни X та Y двома пальцями або одним проведи X↔Y. На геймпаді ↑+L1+R1. Здібність діє по всій арені.'},
        {buttons:'X + A / L1',description:'Захват стоячого противника. Потім потягни джойстик назад для кидка · '+throwDamage+' HP.'},
        {buttons:'Напрямок + ↓ + X + A',description:'Перекат із короткою невразливістю. На геймпаді: напрямок + L2.'},
        {buttons:'A / ↓ + A',description:'Стоячий блок / блок навприсядки. Під час блоку напрямок не змінюється.'},
      ]},
      {title:'Шість триударних комбінацій',moves:
        COMBO_ROUTES.map((route,index)=>({
          buttons:route.map(part=>LABELS[part]).join(' → '),
          description:'Комбо №'+(index+1)+' · кожне нове натискання після попереднього влучання.',
        })),
      },
    ],
  };
}
