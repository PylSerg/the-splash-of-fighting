import Phaser from 'phaser';
import './styles.css';
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
  game.scene.pause('Arena');
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
  characterSelector.show(activePair?.mode??'cpu',origin==='menu',previous);
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
  if(screen==='battle') showMenu('battle');
  else if(screen==='menu') leaveMenu();
  else if(screen==='layout') finishLayout();
  else if(screen==='characters') backFromCharacter();
  else if(screen==='stages') backFromStage();
}

// Home screen: no combat starts until the player chooses a fighter AND stage.
get<HTMLButtonElement>('#btn-home-start').addEventListener('click',()=>showCharacters('home'));
get<HTMLButtonElement>('#btn-home-settings').addEventListener('click',()=>showMenu('home','controls'));
homeFullscreen.addEventListener('click',()=>{void toggleFullscreen();});

// First pause tab has the five actions specified by the game design.
menuButton.addEventListener('click',()=>showMenu('battle'));
resumeButton.addEventListener('click',leaveMenu);
restartButton.addEventListener('click',restart);
get<HTMLButtonElement>('#btn-choose-characters').addEventListener('click',()=>{
  if(activePair) showCharacters('menu');
});
get<HTMLButtonElement>('#btn-choose-stage').addEventListener('click',()=>{
  if(activePair) showStageSelect('menu');
});
get<HTMLButtonElement>('#btn-exit').addEventListener('click',goHome);

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
  if(screen!=='battle')return;
  switch(event.code){
    case 'KeyR':restart();break;
    case 'Digit1':showCharacters('menu');break;
    case 'Digit2':showStageSelect('menu');break;
  }
});
function pollGamepadMenu(): void {
  const pads=navigator.getGamepads?.()??[];
  const down=Array.from(pads).some(p=>Boolean(p?.buttons[9]?.pressed));
  if(down&&!gamepadStartHeld&&(screen==='battle'||screen==='menu')) togglePause();
  gamepadStartHeld=down;
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
