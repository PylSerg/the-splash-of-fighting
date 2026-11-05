import Phaser from 'phaser';
import './styles.css';
import './ui/selection.css';
import { Controls } from './input/Controls';
import { ArenaScene } from './scenes/ArenaScene';
import { TouchLayoutEditor } from './ui/TouchLayoutEditor';
import { CharacterSelector, type MatchMode } from './ui/CharacterSelector';
import { StageSelector } from './ui/StageSelector';
import { getCharacter, portraitSvg } from './characters/Roster';
import { getStage, type StageId } from './stages/Stages';
import type { FighterId } from './combat/Fighter';

type Pair = { first: FighterId; second: FighterId; mode: MatchMode };
type Screen = 'home' | 'characters' | 'stages' | 'battle' | 'menu' | 'layout';
type MenuTab = 'game' | 'controls' | 'display' | 'help';
type DisruptiveAction = 'restart' | 'characters' | 'stage' | 'exit';
const get = <T extends HTMLElement>(selector: string): T => {
  const el=document.querySelector<T>(selector);
  if(!el) throw new Error('Missing interface element: ' + selector);
  return el;
};

const status=get<HTMLElement>('#game-status');
const controls=new Controls();
const game=new Phaser.Game({
  type:Phaser.AUTO,
  parent:'game-canvas',
  width:960,height:540,backgroundColor:'#10152b',
  pixelArt:true,antialias:false,roundPixels:true,
  scale:{
    mode:Phaser.Scale.NONE,autoCenter:Phaser.Scale.NO_CENTER,
    parent:'game-canvas',width:960,height:540,
  },
});
const arena=new ArenaScene(controls, message => { status.textContent=message; });
game.scene.add('Arena',arena,true);

const frame=get<HTMLElement>('#game-frame');
const menuButton=get<HTMLButtonElement>('#btn-menu');
const menuOverlay=get<HTMLElement>('#pause-overlay');
const home=get<HTMLElement>('#home-screen');
const resumeButton=get<HTMLButtonElement>('#btn-resume');
const closeMenuButton=get<HTMLButtonElement>('#btn-close-menu');
const confirmDialog=get<HTMLElement>('#action-confirm');
const confirmTitle=get<HTMLElement>('#confirm-title');
const confirmDescription=get<HTMLElement>('#confirm-description');
const confirmCancel=get<HTMLButtonElement>('#btn-confirm-cancel');
const confirmAccept=get<HTMLButtonElement>('#btn-confirm-accept');
const restartButton=get<HTMLButtonElement>('#btn-restart');
const debugButton=get<HTMLButtonElement>('#btn-debug');
const fullscreenButton=get<HTMLButtonElement>('#btn-fullscreen');
const homeFullscreen=get<HTMLButtonElement>('#btn-home-fullscreen');
const menuContext=get<HTMLElement>('#menu-context-label');
const avatar1=get<HTMLElement>('#hud-avatar-p1');
const avatar2=get<HTMLElement>('#hud-avatar-p2');
const layoutEditButton=get<HTMLButtonElement>('#btn-layout-edit');
const touchLayout=new TouchLayoutEditor();

let screen: Screen='home';
let menuOrigin: 'home' | 'battle'='battle';
let characterOrigin: 'home' | 'menu'='home';
let stageOrigin: 'new' | 'menu'='new';
let activePair: Pair | null=null;
let pendingPair: Pair | null=null;
let activeStage: StageId='city';
let logicalWidth=960;
let gamepadStartHeld=false;
let selectionDirectionHeld=0;
let selectionDirectionTime=0;
let selectionAHeld=false;
let selectionBHeld=false;
let pendingConfirmation: DisruptiveAction | null=null;
let confirmationReturnFocus: HTMLElement | null=null;

const confirmationCopy: Record<DisruptiveAction,{
  title:string; description:string; accept:string;
}> = {
  restart: {
    title:'Почати раунд заново?',
    description:'Поточний бій, здоров’я, енергія та час раунду будуть скинуті. Персонажі й арена залишаться без змін.',
    accept:'↻ Так, рестарт',
  },
  characters: {
    title:'Перейти до вибору бійців?',
    description:'Якщо обереш інших персонажів, поточний раунд почнеться заново на цій самій арені. Повернення без змін збереже бій.',
    accept:'🧑‍🤝‍🧑 Обрати бійців',
  },
  stage: {
    title:'Змінити арену?',
    description:'Якщо обереш іншу арену, поточний раунд почнеться заново, але бійці залишаться ті самі. Повернення без змін збереже бій.',
    accept:'🌄 Обрати арену',
  },
  exit: {
    title:'Вийти з поєдинку?',
    description:'Ти повернешся на головний екран, а весь прогрес поточного раунду буде втрачено.',
    accept:'⌂ Так, вийти',
  },
};

const characterSelector=new CharacterSelector(onCharacterChosen, backFromCharacter);
const stageSelector=new StageSelector(onStageChosen, backFromStage);

function isSamePair(a: Pair, b: Pair): boolean {
  return a.first===b.first && a.second===b.second && a.mode===b.mode;
}
function updateAvatars(p1: FighterId,p2: FighterId): void {
  avatar1.innerHTML=portraitSvg(p1);
  avatar1.style.setProperty('--avatar-color',getCharacter(p1).color);
  avatar2.innerHTML=portraitSvg(p2);
  avatar2.style.setProperty('--avatar-color',getCharacter(p2).color);
}
function resizeArena(): void {
  const rect=frame.getBoundingClientRect();
  if(rect.width<1||rect.height<1) return;
  const width=Math.max(960,Math.round(540*rect.width/rect.height));
  if(width!==logicalWidth){
    game.scale.resize(width,540);
    logicalWidth=width;
    arena.resizeViewport(width);
  }
  frame.style.setProperty('--hud-scale',String(rect.height/540));
  touchLayout.sync();
}
if(typeof ResizeObserver!=='undefined') new ResizeObserver(resizeArena).observe(frame);
window.addEventListener('resize',resizeArena);
requestAnimationFrame(resizeArena);

function setScreen(next: Screen): void {
  screen=next;
  home.hidden=next!=='home';
  menuOverlay.hidden=next!=='menu';
  if(next!=='layout') touchLayout.stop();
  characterSelector.hide();
  stageSelector.hide();
  frame.classList.toggle('front-screen',
    next==='home'||next==='characters'||next==='stages'||
    (next==='menu'&&menuOrigin==='home'));
  menuButton.hidden=next!=='battle';
  menuButton.setAttribute('aria-expanded',String(next==='menu'));
}
function selectMenuTab(tab: MenuTab): void {
  // The front-screen settings panel has no fight actions.
  if (menuOrigin==='home' && tab==='game') tab='controls';
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-menu-tab]')){
    const chosen=button.dataset.menuTab===tab;
    button.classList.toggle('selected',chosen);
    button.setAttribute('aria-selected',String(chosen));
  }
  for(const pane of document.querySelectorAll<HTMLElement>('[data-menu-pane]')){
    pane.hidden=pane.dataset.menuPane!==tab;
  }
}
function goHome(): void {
  controls.clear();
  // Before the very first matchup, Arena is intentionally inert. Do not
  // pause a still-booting scene before its create() can construct HUD/stage.
  if (activePair) game.scene.pause('Arena');
  pendingPair=null;
  setScreen('home');
  home.querySelector<HTMLButtonElement>('#btn-home-start')?.focus({preventScroll:true});
}
function showMenu(origin:'home'|'battle', tab:MenuTab='game'): void {
  if(screen==='layout') touchLayout.stop();
  menuOrigin=origin;
  controls.clear();
  game.scene.pause('Arena');
  menuContext.textContent=origin==='home'?'Налаштування гри':'Бій зупинено';
  get<HTMLElement>('#pause-title').innerHTML=origin==='home'
    ? 'НАЛАШТУВАННЯ <span>⚙</span>' : 'ПАУЗА <span>Ⅱ</span>';
  resumeButton.textContent=origin==='home'?'← На головну':'▶ Продовжити';
  for(const id of ['#btn-restart','#btn-choose-characters','#btn-choose-stage']){
    get<HTMLButtonElement>(id).disabled=origin==='home';
  }
  // The first "Бій" tab exists only when a match has been paused.
  // Three remaining settings tabs stretch across the full tab bar.
  get<HTMLButtonElement>('[data-menu-tab="game"]').hidden=origin==='home';
  get<HTMLElement>('.pause-tabs').classList.toggle('settings-only',origin==='home');
  setScreen('menu');
  selectMenuTab(tab);
}
function resumeBattle(): void {
  if(!activePair) { goHome(); return; }
  controls.clear();
  setScreen('battle');
  game.scene.resume('Arena');
  menuButton.focus({preventScroll:true});
}
function leaveMenu(): void {
  if(menuOrigin==='home') goHome();
  else resumeBattle();
}
function showCharacters(origin:'home'|'menu'): void {
  characterOrigin=origin;
  controls.clear();
  game.scene.pause('Arena');
  setScreen('characters');
  const previous=origin==='menu'&&activePair
    ? {first:activePair.first,second:activePair.second} : undefined;
  // "Назад" is available both on the initial selection and mid-match.
  // The destination differs: title screen vs paused fight menu.
  get<HTMLButtonElement>('#btn-select-back').textContent=
    origin==='home'?'← На головну':'← До меню';
  characterSelector.show(activePair?.mode??'cpu',true,previous);
}
function onCharacterChosen(first:FighterId,second:FighterId,mode:MatchMode): void {
  const next={first,second,mode};
  if(characterOrigin==='menu') {
    if(activePair&&isSamePair(activePair,next)){
      showMenu('battle');
      return; // Same characters: leave the existing match untouched.
    }
    // Changing fighters restarts the fight but preserves its arena.
    startBattle(next,activeStage);
  } else {
    pendingPair=next;
    showStageSelect('new');
  }
}
function backFromCharacter(): void {
  if(characterOrigin==='menu') showMenu('battle');
  else goHome();
}
function showStageSelect(origin:'new'|'menu'): void {
  stageOrigin=origin;
  controls.clear();
  game.scene.pause('Arena');
  setScreen('stages');
  stageSelector.show(origin==='menu'?activeStage:null);
}
function onStageChosen(id:StageId): void {
  getStage(id);
  if(stageOrigin==='menu') {
    if(id===activeStage){
      showMenu('battle'); // The same arena leaves the round intact.
      return;
    }
    activeStage=id;
    arena.setArena(id);
    arena.resetRound(); // Same characters, fresh round on the new stage.
    resumeBattle();
  } else if(pendingPair){
    startBattle(pendingPair,id);
    pendingPair=null;
  }
}
function backFromStage(): void {
  if(stageOrigin==='menu') showMenu('battle');
  else showCharacters('home');
}
function startBattle(pair:Pair,id:StageId): void {
  activeStage=id;
  activePair={...pair};
  menuOrigin='battle';
  arena.setArena(id);
  arena.setMatchup(pair.first,pair.second,pair.mode);
  updateAvatars(pair.first,pair.second);
  resumeBattle();
}
function restart(): void {
  if(!activePair || screen==='home') return;
  arena.resetRound(); // Keeps the current characters and arena.
  resumeBattle();
}
function editLayout(): void {
  if(screen!=='menu') return;
  controls.clear();
  game.scene.pause('Arena');
  setScreen('layout');
  touchLayout.start();
}
function finishLayout(): void {
  if(screen!=='layout') return;
  touchLayout.stop();
  showMenu(menuOrigin,'controls');
  layoutEditButton.focus({preventScroll:true});
}
/** Never use the browser's blocking window.confirm: this is an in-game dialog.
 *  Arena is paused throughout, including when the player cancels.
 */
function requestConfirmation(action: DisruptiveAction): void {
  if(!activePair) return;
  // Keyboard shortcuts can request a destructive action mid-fight.
  // Open the pause menu first, so time, AI and animations all stop.
  if(screen==='battle') showMenu('battle','game');
  if(screen!=='menu' || menuOrigin!=='battle' || pendingConfirmation) return;
  const copy=confirmationCopy[action];
  pendingConfirmation=action;
  confirmationReturnFocus=document.activeElement instanceof HTMLElement
    ? document.activeElement : null;
  confirmTitle.textContent=copy.title;
  confirmDescription.textContent=copy.description;
  confirmAccept.textContent=copy.accept;
  confirmDialog.hidden=false;
  // Prevent activating underlying menu tabs or buttons with touch/keyboard.
  menuOverlay.inert=true;
  confirmCancel.focus({preventScroll:true});
}
function dismissConfirmation(restoreFocus=true): void {
  if(!pendingConfirmation) return;
  pendingConfirmation=null;
  confirmDialog.hidden=true;
  menuOverlay.inert=false;
  const element=confirmationReturnFocus;
  confirmationReturnFocus=null;
  if(restoreFocus && element?.isConnected) element.focus({preventScroll:true});
}
function executeDisruptiveAction(action: DisruptiveAction): void {
  switch(action){
    case 'restart': restart(); break;
    case 'characters': showCharacters('menu'); break;
    case 'stage': showStageSelect('menu'); break;
    case 'exit': goHome(); break;
  }
}
function confirmDisruptiveAction(): void {
  const action=pendingConfirmation;
  if(!action) return;
  dismissConfirmation(false);
  executeDisruptiveAction(action);
}

function toggleDebug(): void {
  arena.setDebug(!arena.getDebug());
  debugButton.textContent='▣ Хітбокси: '+(arena.getDebug()?'увімк.':'викл.');
}
async function toggleFullscreen(): Promise<void> {
  try {
    if(document.fullscreenElement) await document.exitFullscreen();
    else await frame.requestFullscreen();
    resizeArena();
  } catch {
    status.textContent='Повноекранний режим недоступний у цьому браузері.';
  }
}
function togglePause(): void {
  // Escape / P / Start cancels the warning without discarding the match.
  if(pendingConfirmation){ dismissConfirmation(); return; }
  if(screen==='battle') showMenu('battle');
  else if(screen==='menu') leaveMenu();
  else if(screen==='layout') finishLayout();
  else if(screen==='characters') characterSelector.goBack();
  else if(screen==='stages') stageSelector.goBack();
}

// Home screen: no combat starts until the player chooses a fighter AND stage.
get<HTMLButtonElement>('#btn-home-start').addEventListener('click',()=>showCharacters('home'));
get<HTMLButtonElement>('#btn-home-settings').addEventListener('click',()=>showMenu('home','controls'));
homeFullscreen.addEventListener('click',()=>{void toggleFullscreen();});

// First pause tab has the five actions specified by the game design.
menuButton.addEventListener('click',()=>showMenu('battle'));
resumeButton.addEventListener('click',leaveMenu);
closeMenuButton.addEventListener('click',leaveMenu);
restartButton.addEventListener('click',()=>requestConfirmation('restart'));
get<HTMLButtonElement>('#btn-choose-characters').addEventListener('click',
  ()=>requestConfirmation('characters'));
get<HTMLButtonElement>('#btn-choose-stage').addEventListener('click',
  ()=>requestConfirmation('stage'));
get<HTMLButtonElement>('#btn-exit').addEventListener('click',
  ()=>requestConfirmation('exit'));
confirmCancel.addEventListener('click',()=>dismissConfirmation());
confirmAccept.addEventListener('click',confirmDisruptiveAction);
confirmDialog.addEventListener('keydown',event=>{
  // Keep keyboard focus inside the warning until confirmed or canceled.
  if(event.key!=='Tab') return;
  const buttons=[confirmCancel,confirmAccept];
  const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
  if(event.shiftKey && index<=0){
    event.preventDefault();
    confirmAccept.focus({preventScroll:true});
  } else if(!event.shiftKey && index===buttons.length-1){
    event.preventDefault();
    confirmCancel.focus({preventScroll:true});
  }
});

layoutEditButton.addEventListener('click',editLayout);
get<HTMLButtonElement>('#btn-layout-done').addEventListener('click',finishLayout);
debugButton.addEventListener('click',toggleDebug);
fullscreenButton.addEventListener('click',()=>{void toggleFullscreen();});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-menu-tab]')){
  button.addEventListener('click',()=>selectMenuTab(button.dataset.menuTab as MenuTab));
}
document.addEventListener('fullscreenchange',()=>{
  requestAnimationFrame(resizeArena);
  const label=document.fullscreenElement?'⛶ Згорнути екран':'⛶ На весь екран';
  fullscreenButton.textContent=label;
  homeFullscreen.textContent=label;
});

// Escape/P and Start pause ONLY the active fight; in menus they return back.
window.addEventListener('keydown',event=>{
  if(event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
  if(event.code==='Escape'||event.code==='KeyP'){
    event.preventDefault();
    togglePause();
    return;
  }
  // Fullscreen selection carousel: arrows spin the carousel; Enter/Space
  // confirms whichever character or stage is centered. Focused navigation
  // buttons keep their normal native keyboard semantics.
  if(screen==='characters'||screen==='stages'){
    const isCharacter=screen==='characters';
    if(event.code==='ArrowLeft'||event.code==='ArrowRight'){
      event.preventDefault();
      const direction=event.code==='ArrowLeft'?-1:1;
      if(isCharacter)characterSelector.navigate(direction);
      else stageSelector.navigate(direction);
    } else if(event.code==='Enter'||event.code==='Space'){
      const active=document.activeElement;
      const viewport=isCharacter
        ? get<HTMLElement>('#select-carousel') : get<HTMLElement>('#arena-carousel');
      if(active===viewport||active===document.body){
        event.preventDefault();
        if(isCharacter)characterSelector.confirmCurrent();
        else stageSelector.confirm();
      }
    }
    return;
  }
  if(screen!=='battle')return;
  switch(event.code){
    case 'KeyR':requestConfirmation('restart');break;
    case 'Digit1':requestConfirmation('characters');break;
    case 'Digit2':requestConfirmation('stage');break;
  }
});
function pollGamepadMenu(): void {
  const pads=Array.from(navigator.getGamepads?.()??[]).filter(
    (pad):pad is Gamepad=>Boolean(pad && pad.connected));
  const down=pads.some(p=>Boolean(p.buttons[9]?.pressed));
  if(down&&!gamepadStartHeld&&(screen==='battle'||screen==='menu')) togglePause();
  gamepadStartHeld=down;

  if(screen==='characters'||screen==='stages'){
    // Standard gamepads: D-pad 14/15 and left stick axis 0.
    // Key repeat is deliberately slower than combat input.
    const direction=pads.reduce((result,pad)=>{
      if(result!==0)return result;
      if(pad.buttons[14]?.pressed||((pad.axes[0]??0)<-.55))return -1;
      if(pad.buttons[15]?.pressed||((pad.axes[0]??0)>.55))return 1;
      return 0;
    },0);
    const now=performance.now();
    if(direction && (direction!==selectionDirectionHeld ||
        now-selectionDirectionTime>260)){
      if(screen==='characters')characterSelector.navigate(direction as -1|1);
      else stageSelector.navigate(direction as -1|1);
      selectionDirectionTime=now;
    }
    selectionDirectionHeld=direction;

    const confirmDown=pads.some(p=>Boolean(p.buttons[0]?.pressed));
    const backDown=pads.some(p=>Boolean(p.buttons[1]?.pressed));
    if(confirmDown&&!selectionAHeld){
      if(screen==='characters')characterSelector.confirmCurrent();
      else if(screen==='stages')stageSelector.confirm();
    }
    if(backDown&&!selectionBHeld){
      if(screen==='characters')characterSelector.goBack();
      else if(screen==='stages')stageSelector.goBack();
    }
    selectionAHeld=confirmDown;
    selectionBHeld=backDown;
  } else {
    selectionDirectionHeld=0;
    selectionAHeld=false;
    selectionBHeld=false;
  }
  requestAnimationFrame(pollGamepadMenu);
}
requestAnimationFrame(pollGamepadMenu);
window.addEventListener('gamepadconnected',event=>{
  if(event instanceof GamepadEvent) status.textContent='Геймпад: '+event.gamepad.id;
});
window.addEventListener('blur',()=>{
  if(screen==='battle')showMenu('battle');
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&screen==='battle')showMenu('battle');
});

// Initial splash screen has no AI, no round timer and no character selection.
goHome();
resizeArena();
