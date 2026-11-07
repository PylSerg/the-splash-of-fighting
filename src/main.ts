import Phaser from 'phaser';
import './styles.css';
import './ui/selection.css';
import { Controls } from './input/Controls';
import { ArenaScene } from './scenes/ArenaScene';
import { TouchLayoutEditor } from './ui/TouchLayoutEditor';
import { CharacterSelector, type MatchMode } from './ui/CharacterSelector';
import { StageSelector } from './ui/StageSelector';
import { getMoveGuide } from './ui/MoveGuide';
import {
  type EviSheetKind, readEviSheet,storeEviSheet,clearEviSheets,loadImageFromBlob,
} from './ui/SpriteImport';
import { CHARACTERS, getCharacter, portraitSvg } from './characters/Roster';
import gamePackage from '../package.json';
import { getStage, type StageId } from './stages/Stages';
import type { FighterId } from './combat/Fighter';
import type { TrainingBehavior } from './combat/TrainingRules';

type Pair = { first: FighterId; second: FighterId; mode: MatchMode; training:boolean };
type Screen = 'home' | 'characters' | 'stages' | 'battle' | 'menu' | 'layout';
type MenuTab = 'game' | 'moves' | 'controls' | 'display' | 'help';
type DisruptiveAction = 'restart' | 'characters' | 'stage' | 'exit';
const get = <T extends HTMLElement>(selector: string): T => {
  const el=document.querySelector<T>(selector);
  if(!el) throw new Error('Missing interface element: ' + selector);
  return el;
};

// Derive the title-screen and pause-menu release labels from package.json.
 // This prevents stale version names when the roster or game is updated.
const releaseName=`ALPHA ${gamePackage.version}`;
get<HTMLElement>('.home-version').textContent =
  releaseName + ' · ' + CHARACTERS.map(character=>character.name).join(' × ');
get<HTMLElement>('.pause-eyebrow span').textContent = '• ' + releaseName;

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

const spriteStatus=get<HTMLElement>('#evi-sprite-status');
const importedSheets=new Set<EviSheetKind>();
type EviDisplayMode='puppet'|'sheet'|'legacy';
let activeEviMode:EviDisplayMode='puppet';
function describeSpriteState():void {
  const extras=importedSheets.size
    ? ' Старі аркуші: '+(importedSheets.has('combat')?'бойові ✓':'бойові ✗')+
      ', '+(importedSheets.has('cinematic')?'кінематографічні ✓':'кінематографічні ✗')+'.'
    : ' Старі аркуші ще не імпортовані.';
  spriteStatus.textContent=activeEviMode==='puppet'
    ?'🌸 Активна піксельна модель Еві. Плавні 2D-анімації працюють без завантажень.'+extras
    :activeEviMode==='sheet'
      ?'🧩 Режим старих аркушів. '+
        (importedSheets.has('combat')?'Бойові спрайти активні.':
          'Бойових спрайтів немає: тимчасово показую піксельну модель.')+extras
      :'↺ Активна початкова процедурна модель Еві.'+extras;
}
function selectEviMode(mode:EviDisplayMode):void {
  activeEviMode=mode;
  arena.setEviVisualMode(mode);
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-evi-mode]')){
    const selected=button.dataset.eviMode===mode;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  }
  describeSpriteState();
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-evi-mode]')){
  button.addEventListener('click',()=>{
    selectEviMode(button.dataset.eviMode as EviDisplayMode);
  });
}
async function waitForArenaBoot():Promise<void>{
  if(arena.textures)return;
  await new Promise<void>(resolve=>game.events.once(Phaser.Core.Events.READY,()=>resolve()));
}
async function applyEviSheet(kind:EviSheetKind,blob:Blob,remember:boolean):Promise<void>{
  const image=await loadImageFromBlob(blob);
  await waitForArenaBoot();
  arena.installEviSheet(kind,image);
  importedSheets.add(kind);
  if(remember)selectEviMode('sheet'); // Explicit import previews artwork immediately.
  else describeSpriteState(); // Stored sheets never override the new default rig.
  if(remember){
    try{await storeEviSheet(kind,blob);}
    catch{spriteStatus.textContent+=' Не вдалося зберегти на пристрої, але у цій сесії спрайти працюють.';}
  }
}
for(const kind of ['combat','cinematic'] as const){
  const id=kind==='combat'?'#input-evi-combat':'#input-evi-cinematic';
  get<HTMLInputElement>(id).addEventListener('change',event=>{
    const input=event.currentTarget as HTMLInputElement;
    const file=input.files?.[0];
    if(!file)return;
    void applyEviSheet(kind,file,true)
      .catch(error=>{spriteStatus.textContent=error instanceof Error?error.message:'Помилка імпорту.';})
      .finally(()=>{input.value='';});
  });
}
get<HTMLButtonElement>('#btn-evi-reset-art').addEventListener('click',()=>{
  arena.removeEviSheets();importedSheets.clear();selectEviMode('puppet');
  void clearEviSheets().catch(()=>{
    spriteStatus.textContent+=' Збережені файли не вдалося очистити.';
  });
});
void (async()=>{
  for(const kind of ['combat','cinematic'] as const){
    try{
      const saved=await readEviSheet(kind);
      if(saved)await applyEviSheet(kind,saved,false);
    }catch{/* Storage is optional; the player can always import again. */}
  }
})();

let screen: Screen='home';
let menuOrigin: 'home' | 'battle'='battle';
let characterOrigin: 'home' | 'menu'='home';
let stageOrigin: 'new' | 'menu' | 'after-fighters'='new';
let activePair: Pair | null=null;
let pendingPair: Pair | null=null;
let activeStage: StageId='city';
let guidePlayer:0|1=0;
let requestedTraining=false;
let logicalWidth=960;
let gamepadStartHeld=false;
let selectionDirectionHeld=0;
let selectionDirectionTime=0;
let selectionAHeld=false;
let selectionBHeld=false;
// Each player's independent carousel input must have separate repeat timers,
// otherwise moving both gamepads simultaneously suppresses one controller.
const playerDirectionHeld:[number,number]=[0,0];
const playerDirectionTime:[number,number]=[0,0];
const playerAHeld:[boolean,boolean]=[false,false];
let selectionStartHeld=false;
let pendingConfirmation: DisruptiveAction | null=null;
let confirmationReturnFocus: HTMLElement | null=null;

const confirmationCopy: Record<DisruptiveAction,{
  title:string; description:string; accept:string;
}> = {
  restart: {
    title:'Почати матч заново?',
    description:'Усі перемоги, заряд SPLASH, звичайна енергія, здоров’я та час будуть скинуті. Персонажі й арена залишаться.',
    accept:'↻ Так, рестарт',
  },
  characters: {
    title:'Перейти до вибору бійців?',
    description:'Зміна персонажів почне новий матч на цій арені. Повернення без змін збереже поточний матч.',
    accept:'🧑‍🤝‍🧑 Обрати бійців',
  },
  stage: {
    title:'Змінити арену?',
    description:'Зміна арени почне новий матч із цими бійцями. Повернення без змін збереже поточний матч.',
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
  return a.first===b.first && a.second===b.second && a.mode===b.mode &&
    a.training===b.training;
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
  if (menuOrigin==='home' && (tab==='game'||tab==='moves')) tab='controls';
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-menu-tab]')){
    const chosen=button.dataset.menuTab===tab;
    button.classList.toggle('selected',chosen);
    button.setAttribute('aria-selected',String(chosen));
  }
  for(const pane of document.querySelectorAll<HTMLElement>('[data-menu-pane]')){
    pane.hidden=pane.dataset.menuPane!==tab;
  }
}
/** Create the move list from real combo routes and fighter profiles.
 * Both players may inspect their selected fighter without leaving the fight.
 */
function paintMoveGuide():void {
  if(!activePair)return;
  const data=getMoveGuide(guidePlayer===0?activePair.first:activePair.second);
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-guide-fighter]')){
    const slot=Number(button.dataset.guideFighter);
    const selected=slot===guidePlayer;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
    button.textContent=(slot===0?'P1: ':'P2: ')+getCharacter(
      slot===0?activePair.first:activePair.second).name;
  }
  const root=get<HTMLElement>('#combo-guide');
  root.replaceChildren();
  const heading=document.createElement('div');
  heading.className='combo-guide-identity';
  const name=document.createElement('strong');
  name.textContent=data.name+' · '+data.subtitle;
  const notes=document.createElement('p');
  notes.textContent=data.notes;
  heading.append(name,notes);
  root.append(heading);
  for(const section of data.sections){
    const block=document.createElement('section');
    block.className='combo-guide-section';
    const title=document.createElement('h3');
    title.textContent=section.title;
    block.append(title);
    for(const move of section.moves){
      const row=document.createElement('div');
      row.className='combo-guide-move';
      const keys=document.createElement('strong');
      keys.className='combo-guide-keys';
      keys.textContent=move.buttons;
      const detail=document.createElement('span');
      detail.textContent=move.description;
      row.append(keys,detail);
      block.append(row);
    }
    root.append(block);
  }
}

function goHome(): void {
  controls.clear();
  // Before the very first matchup, Arena is intentionally inert. Do not
  // pause a still-booting scene before its create() can construct HUD/stage.
  if (activePair) game.scene.pause('Arena');
  pendingPair=null;
  requestedTraining=false;
  setScreen('home');
  home.querySelector<HTMLButtonElement>('#btn-home-start')?.focus({preventScroll:true});
}
function showMenu(origin:'home'|'battle', tab:MenuTab='game'): void {
  if(screen==='layout') touchLayout.stop();
  menuOrigin=origin;
  controls.clear();
  game.scene.pause('Arena');
  const training=origin==='battle' && arena.isTraining();
  menuContext.textContent=origin==='home'?'Налаштування гри':
    training?'Тренування зупинено':'Бій зупинено';
  get<HTMLElement>('#training-ai-settings').hidden=!training;
  if(training)refreshTrainingBehaviorButtons();
  get<HTMLElement>('#pause-title').innerHTML=origin==='home'
    ? 'НАЛАШТУВАННЯ <span>⚙</span>' : 'ПАУЗА <span>Ⅱ</span>';
  resumeButton.textContent=origin==='home'?'← На головну':'▶ Продовжити';
  for(const id of ['#btn-restart','#btn-choose-characters','#btn-choose-stage']){
    get<HTMLButtonElement>(id).disabled=origin==='home';
  }
  // The first "Бій" tab exists only when a match has been paused.
  // Three remaining settings tabs stretch across the full tab bar.
  get<HTMLButtonElement>('[data-menu-tab="game"]').hidden=origin==='home';
  get<HTMLButtonElement>('[data-menu-tab="moves"]').hidden=origin==='home';
  if(origin==='battle'){
    guidePlayer=0;
    paintMoveGuide();
  }
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
  if(origin==='menu')requestedTraining=activePair?.training??false;
  controls.clear();
  game.scene.pause('Arena');
  setScreen('characters');
  const previous=pendingPair
    ? {first:pendingPair.first,second:pendingPair.second}
    : origin==='menu'&&activePair
      ? {first:activePair.first,second:activePair.second} : undefined;
  // "Назад" is available both on the initial selection and mid-match.
  // The destination differs: title screen vs paused fight menu.
  get<HTMLButtonElement>('#btn-select-back').textContent=
    origin==='home'?'← На головну':'← До меню';
  characterSelector.show(requestedTraining?'cpu':pendingPair?.mode ?? activePair?.mode ?? 'cpu',
    true,previous,requestedTraining);
}
function onCharacterChosen(first:FighterId,second:FighterId,mode:MatchMode): void {
  const next:Pair={first,second,mode:requestedTraining?'cpu':mode,
    training:requestedTraining};
  if(characterOrigin==='menu') {
    if(activePair&&isSamePair(activePair,next)){
      pendingPair=null;
      showMenu('battle');
      return; // Same characters: leave the existing match untouched.
    }
    // Let the players choose an arena even when changing fighters mid-match.
    // The existing match remains paused until final stage confirmation.
    pendingPair=next;
    showStageSelect('after-fighters');
  } else {
    pendingPair=next;
    showStageSelect('new');
  }
}
function backFromCharacter(): void {
  if(characterOrigin==='menu') { pendingPair=null; showMenu('battle'); }
  else goHome();
}
function showStageSelect(origin:'new'|'menu'|'after-fighters'): void {
  stageOrigin=origin;
  controls.clear();
  game.scene.pause('Arena');
  setScreen('stages');
  stageSelector.show(origin==='new'?null:activeStage);
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
    arena.restartMatch(); // Same characters, fresh best-of-three on the new stage.
    resumeBattle();
  } else if(pendingPair){
    startBattle(pendingPair,id);
    pendingPair=null;
  }
}
function backFromStage(): void {
  if(stageOrigin==='menu') showMenu('battle');
  else showCharacters(stageOrigin==='after-fighters'?'menu':'home');
}
function startBattle(pair:Pair,id:StageId): void {
  activeStage=id;
  activePair={...pair};
  menuOrigin='battle';
  arena.setArena(id);
  arena.setMatchup(pair.first,pair.second,pair.mode,pair.training);
  updateAvatars(pair.first,pair.second);
  resumeBattle();
}
function restart(): void {
  if(!activePair || screen==='home') return;
  arena.restartMatch(); // Keeps the current characters and arena.
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

// Home screen: normal match and endless practice share roster and arena selection.
get<HTMLButtonElement>('#btn-home-start').addEventListener('click',()=>{
  requestedTraining=false;
  showCharacters('home');
});
get<HTMLButtonElement>('#btn-home-training').addEventListener('click',()=>{
  requestedTraining=true;
  showCharacters('home');
});
get<HTMLButtonElement>('#btn-home-settings').addEventListener('click',()=>showMenu('home','controls'));
homeFullscreen.addEventListener('click',()=>{void toggleFullscreen();});

function refreshTrainingBehaviorButtons():void {
  const chosen=arena.getTrainingBehavior();
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-training-ai]')){
    const selected=button.dataset.trainingAi===chosen;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  }
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-training-ai]')){
  button.addEventListener('click',()=>{
    if(!arena.isTraining())return;
    arena.setTrainingBehavior(button.dataset.trainingAi as TrainingBehavior);
    refreshTrainingBehaviorButtons();
  });
}

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
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-guide-fighter]')){
  button.addEventListener('click',()=>{
    guidePlayer=button.dataset.guideFighter==='1'?1:0;
    paintMoveGuide();
  });
}
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
  // Character selection is split into TWO independent touch/control zones.
  // Keyboard P1: A/D; keyboard P2: arrows. Both can change simultaneously.
  if(screen==='characters'){
    if(characterSelector.isBioOpen) return;
    const p1:Record<string,-1|1>={KeyA:-1,KeyD:1};
    const p2:Record<string,-1|1>={ArrowLeft:-1,ArrowRight:1};
    const direction1=p1[event.code];
    const direction2=p2[event.code];
    if(direction1){event.preventDefault();characterSelector.navigate(0,direction1);}
    if(direction2){event.preventDefault();characterSelector.navigate(1,direction2);}
    const active=document.activeElement;
    const zone1=get<HTMLElement>('#select-zone-p1');
    const zone2=get<HTMLElement>('#select-zone-p2');
    if(event.code==='KeyF'){
      event.preventDefault();characterSelector.confirmPlayer(0);
    } else if(event.code==='KeyK'){
      event.preventDefault();characterSelector.confirmPlayer(1);
    } else if(event.code==='Space' && (active===zone1 || active===zone2)){
      event.preventDefault();characterSelector.confirmPlayer(active===zone1?0:1);
    } else if(event.code==='Enter' && (active===zone1||active===zone2)){
      event.preventDefault();characterSelector.inspectPlayer(active===zone1?0:1);
    } else if(event.code==='Enter' && active===document.body){
      event.preventDefault();characterSelector.confirmCurrent();
    }
    return;
  }
  if(screen==='stages'){
    // A story panel is modal: navigation cannot change the stage behind it.
    if(stageSelector.isLoreOpen)return;
    if(event.code==='KeyI'){
      event.preventDefault();stageSelector.inspect();
    }else if(event.code==='ArrowLeft'||event.code==='ArrowRight'){
      event.preventDefault();
      stageSelector.navigate(event.code==='ArrowLeft'?-1:1);
    }else if(event.code==='Enter'||event.code==='Space'){
      const viewport=get<HTMLElement>('#arena-carousel');
      if(document.activeElement===viewport||document.activeElement===document.body){
        event.preventDefault();stageSelector.confirm();
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
  const raw=navigator.getGamepads?.()??[];
  const pads=Array.from(raw);
  const connected=pads.filter((pad):pad is Gamepad=>Boolean(pad&&pad.connected));
  const start=connected.some(p=>Boolean(p.buttons[9]?.pressed));
  if(start&&!gamepadStartHeld&&(screen==='battle'||screen==='menu'))togglePause();
  gamepadStartHeld=start;

  const direction=(pad:Gamepad|undefined,axis=0):number=>{
    if(!pad)return 0;
    if(axis===0){
      if(pad.buttons[14]?.pressed)return -1;
      if(pad.buttons[15]?.pressed)return 1;
    }
    const value=pad.axes[axis]??0;
    return value<-.55?-1:value>.55?1:0;
  };
  const now=performance.now();
  if(screen==='characters'){
    if(characterSelector.isBioOpen){
      // B closes the biography. A/Start must not activate the underlying UI.
      const back=connected.some(p=>Boolean(p.buttons[1]?.pressed));
      if(back&&!selectionBHeld) characterSelector.closeBio();
      selectionBHeld=back;
      selectionStartHeld=start;
      for(const p of [0,1] as const){
        playerAHeld[p]=Boolean(pads[p]?.buttons[0]?.pressed);
        playerDirectionHeld[p]=0;
      }
      requestAnimationFrame(pollGamepadMenu);
      return;
    }
    // Gamepad 1 controls P1 and gamepad 2 controls P2 at the same time.
    // On a single controller, the right analog stick can steer the CPU/P2
    // carousel while the D-pad / left stick steers P1.
    const pad1=pads[0]??undefined;
    const pad2=pads[1]??undefined;
    const directions=[
      direction(pad1??undefined),
      pad2?direction(pad2):direction(pad1??undefined,2),
    ];
    for(const p of [0,1] as const){
      const dir=directions[p];
      if(dir&&(dir!==playerDirectionHeld[p]||now-playerDirectionTime[p]>290)){
        characterSelector.navigate(p,dir as -1|1);
        playerDirectionTime[p]=now;
      }
      playerDirectionHeld[p]=dir;
    }
    for(const p of [0,1] as const){
      const pad=pads[p]??undefined;
      const confirm=Boolean(pad?.buttons[0]?.pressed);
      if(confirm&&!playerAHeld[p]){
        characterSelector.confirmPlayer(p);
      }
      playerAHeld[p]=confirm;
    }
    const back=connected.some(p=>Boolean(p.buttons[1]?.pressed));
    if(back&&!selectionBHeld)characterSelector.goBack();
    selectionBHeld=back;
    // Start proceeds when both PvP players have pressed Ready, or immediately
    // in CPU mode. This uses the same validation as the on-screen button.
    if(start&&!selectionStartHeld)characterSelector.confirmCurrent();
    selectionStartHeld=start;
    selectionDirectionHeld=0;
    selectionAHeld=false;
  } else if(screen==='stages'){
    if(stageSelector.isLoreOpen){
      // Same as the fighter biography: B closes the story, A/Start and
      // D-pad cannot accidentally confirm or change the underlying stage.
      const back=connected.some(p=>Boolean(p.buttons[1]?.pressed));
      if(back&&!selectionBHeld)stageSelector.closeLore();
      selectionBHeld=back;
      selectionAHeld=connected.some(p=>Boolean(p.buttons[0]?.pressed));
      selectionDirectionHeld=0;
      playerDirectionHeld[0]=0;playerDirectionHeld[1]=0;
      playerAHeld[0]=false;playerAHeld[1]=false;
      selectionStartHeld=start;
      requestAnimationFrame(pollGamepadMenu);
      return;
    }
    const dir=connected.reduce((value,pad)=>value||direction(pad),0);
    if(dir&&(dir!==selectionDirectionHeld||now-selectionDirectionTime>280)){
      stageSelector.navigate(dir as -1|1);
      selectionDirectionTime=now;
    }
    selectionDirectionHeld=dir;
    const confirm=connected.some(p=>Boolean(p.buttons[0]?.pressed));
    if(confirm&&!selectionAHeld)stageSelector.confirm();
    selectionAHeld=confirm;
    const back=connected.some(p=>Boolean(p.buttons[1]?.pressed));
    if(back&&!selectionBHeld)stageSelector.goBack();
    selectionBHeld=back;
    playerDirectionHeld[0]=0;playerDirectionHeld[1]=0;
    playerAHeld[0]=false;playerAHeld[1]=false;
    selectionStartHeld=false;
  } else {
    selectionDirectionHeld=0;
    selectionAHeld=false;selectionBHeld=false;
    playerDirectionHeld[0]=0;playerDirectionHeld[1]=0;
    playerAHeld[0]=false;playerAHeld[1]=false;
    selectionStartHeld=false;
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
