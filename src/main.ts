import Phaser from 'phaser';
import './styles.css';
import { Controls } from './input/Controls';
import { ArenaScene } from './scenes/ArenaScene';

const status = document.querySelector<HTMLElement>('#game-status');
const controls = new Controls();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-canvas',
  width: 960,
  height: 540,
  backgroundColor: '#10152b',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-canvas',
    width: 960,
    height: 540,
  },
});

const arena = new ArenaScene(controls, message => {
  if (status) status.textContent = message;
});
game.scene.add('Arena', arena, true);

const cpuButton = document.querySelector<HTMLButtonElement>('#btn-cpu');
const versusButton = document.querySelector<HTMLButtonElement>('#btn-versus');
const debugButton = document.querySelector<HTMLButtonElement>('#btn-debug');
const restartButton = document.querySelector<HTMLButtonElement>('#btn-restart');
const fullscreenButton = document.querySelector<HTMLButtonElement>('#btn-fullscreen');
const frame = document.querySelector<HTMLElement>('#game-frame');

function updateMode(): void {
  cpuButton?.classList.toggle('selected', arena.getMode()==='cpu');
  versusButton?.classList.toggle('selected', arena.getMode()==='versus');
}
function setMode(mode: 'cpu'|'versus'): void {
  arena.setMode(mode);
  updateMode();
}
function toggleDebug(): void {
  arena.setDebug(!arena.getDebug());
  if(debugButton)debugButton.textContent='▣ Хітбокси: '+(arena.getDebug()?'увімк.':'викл.');
}

cpuButton?.addEventListener('click',()=>setMode('cpu'));
versusButton?.addEventListener('click',()=>setMode('versus'));
debugButton?.addEventListener('click',toggleDebug);
restartButton?.addEventListener('click',()=>arena.resetRound());
fullscreenButton?.addEventListener('click',async()=>{
  if(!frame)return;
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else await frame.requestFullscreen();
    game.scale.refresh();
  }catch{
    if(status)status.textContent='Повноекранний режим недоступний у цьому браузері.';
  }
});
document.addEventListener('fullscreenchange',()=>game.scale.refresh());

window.addEventListener('keydown',(event)=>{
  if(event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
  switch(event.code){
    case 'KeyR': arena.resetRound(); break;
    case 'KeyH': toggleDebug(); break;
    case 'Digit1': setMode('cpu'); break;
    case 'Digit2': setMode('versus'); break;
  }
});

window.addEventListener('gamepadconnected',(event)=>{
  if(status && event instanceof GamepadEvent){
    status.textContent='Геймпад підключено: '+event.gamepad.id;
  }
});

updateMode();
