import type { FighterId } from '../combat/Fighter';
import { FIGHTER_STYLES } from '../combat/CombatRhythm.ts';
import { COMBO_ROUTES } from '../combat/ComboRules.ts';
import { SPLASH_MOVES } from '../combat/SplashRules.ts';
import { specialDamageAt } from '../combat/SpecialRules.ts';
import { MAX_HEALTH, scaleDamage, damagePercent } from '../combat/CombatScale.ts';
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
  const damageLabel=(hp:number)=>hp+' HP ('+short(Number(damagePercent(hp).toFixed(1)))+'% макс. HP)';
  const heavyDamage=scaleDamage(runa?14:11);
  const throwDamage=scaleDamage(runa?21:16);
  const cleanComboBonus=24;
  return {
    fighter,
    name:character.name,
    subtitle:character.title+' · '+(character.weapon??'Бойові прийоми'),
    notes:'Максимальне здоров’я: '+MAX_HEALTH+' HP. Шкода масштабується відсотково. Вікно продовження комбо: '+short(style.comboWindow)+' с. '+
      'Другий і третій удари вводяться лише після влучання попереднього. '+
      'Третій чистий удар пробиває блок і додає +'+cleanComboBonus+' SPLASH.',
    sections:[
      {title:'Основні атаки',moves:[
        {buttons:'Y',description:'Висока сильна атака · '+damageLabel(heavyDamage)+'. Промахується над присілим суперником.'},
        {buttons:'X',description:'Середня швидка атака · '+damageLabel(scaleDamage(5))+'.'},
        {buttons:'B',description:'Нижня атака ногою · '+damageLabel(scaleDamage(9))+'. Проходить під стоячим блоком.'},
        {buttons:'↓ + X',description:'Середній швидкий удар навприсядки · '+damageLabel(scaleDamage(runa?5:4))+'.'},
        {buttons:'↓ + B',description:'Нижня підсічка · '+damageLabel(scaleDamage(runa?6:5))+'. Збиває з ніг, якщо не заблокована.'},
      ]},
      {title:'Спеціальні дії та захист',moves:[
        {buttons:'Вперед + A + B',description:'Заряджений спецприйом від 15% до 100%: '+
          damageLabel(specialDamageAt(fighter,15))+' → '+damageLabel(specialDamageAt(fighter,100))+
          '. Витрачає увесь заряд, але враховує лише повністю завершені секції 15/35/60/100%. Фронтальний блок пропускає 50% шкоди; влучання заряджає тільки SPLASH.'},
        {buttons:'Вперед + B + Y',description:'Виклик на таємну дуель · вибір X/Y/B протягом 2 с. Захисник може обрати A.'},
        {buttons:'↑ + X + Y',description:'SPLASH: «'+SPLASH_MOVES[fighter].name+'» · '+damageLabel(SPLASH_MOVES[fighter].damage)+'. Потрібно 100 заряду.'},
        {buttons:'↑ + X + Y / ↑ + L1 + R1',description:'Утримуй ↑ й затисни X та Y двома пальцями або одним проведи X↔Y. На геймпаді ↑+L1+R1. Здібність діє по всій арені.'},
        {buttons:'X + A / L1',description:'Захват стоячого противника. Потім потягни джойстик назад для кидка · '+throwDamage+' HP.'},
        {buttons:'Напрямок + ↓ + X + A',description:'Перекат із короткою невразливістю. На геймпаді: напрямок + L2.'},
        {buttons:'A / ↓ + A',description:'Стоячий блок / блок навприсядки. Під час блоку напрямок не змінюється.'},
      ]},
      {title:'Чотири секції заряду спецприйому',moves:[
        {buttons:'0–15%',description:'До 15% спецприйом недоступний. При повних 15%: '+
          specialDamageAt(fighter,15)+' HP (трохи сильніше за Y).'},
        {buttons:'16–35%',description:'До 34,9% діє попередній рівень ('+
          specialDamageAt(fighter,15)+' HP). Лише при повних 35%: '+
          specialDamageAt(fighter,35)+' HP.'},
        {buttons:'36–60%',description:'До 59,9% залишається сила 35% ('+
          specialDamageAt(fighter,35)+' HP). При повних 60%: '+
          specialDamageAt(fighter,60)+' HP.'},
        {buttons:'61–100%',description:'До 99,9% сила 60% ('+
          specialDamageAt(fighter,60)+' HP). Тільки 100% дають '+
          specialDamageAt(fighter,100)+' HP. SPLASH: '+
          SPLASH_MOVES[fighter].damage+' HP (×2).'},
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
