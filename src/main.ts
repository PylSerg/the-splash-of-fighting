import Phaser from 'phaser';
import './styles.css';
import { Controls } from './input/Controls';
import { ArenaScene } from './scenes/ArenaScene';
import { TouchLayoutEditor } from './ui/TouchLayoutEditor';

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
    // Manual resizing keeps 540 logical pixels vertically while revealing
    // additional stage horizontally on wide screens (no stretching/cropping).
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
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
const menuButton = document.querySelector<HTMLButtonElement>('#btn-menu');
const resumeButton = document.querySelector<HTMLButtonElement>('#btn-resume');
const overlay = document.querySelector<HTMLElement>('#pause-overlay');
const frame = document.querySelector<HTMLElement>('#game-frame');
const layoutEditButton = document.querySelector<HTMLButtonElement>('#btn-layout-edit');
const layoutDoneButton = document.querySelector<HTMLButtonElement>('#btn-layout-done');
const touchLayout = new TouchLayoutEditor();

let currentLogicalWidth = 960;
function resizeArena(): void {
  if (!frame) return;
  const rect = frame.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  const width = Math.max(960, Math.round(540 * rect.width / rect.height));
  if (width !== currentLogicalWidth) {
    game.scale.resize(width, 540);
    currentLogicalWidth = width;
    arena.resizeViewport(width);
  }
  touchLayout.sync();
}
if (frame && typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(resizeArena).observe(frame);
}
window.addEventListener('resize', resizeArena);
requestAnimationFrame(resizeArena);

let menuOpen = false;
let gamepadStartWasDown = false;

function finishLayoutEditing(): void {
  if (!touchLayout.isEditing) return;
  touchLayout.stop();
  if (menuOpen && overlay) {
    overlay.hidden = false;
    layoutEditButton?.focus({ preventScroll: true });
  }
}
function openLayoutEditing(): void {
  if (!menuOpen || !overlay || touchLayout.isEditing) return;
  controls.clear();
  overlay.hidden = true;
  touchLayout.start();
}

function openMenu(): void {
  if (menuOpen || !overlay) return;
  menuOpen = true;
  controls.clear(); // Never carry a stuck attack or joystick direction into a pause.
  overlay.hidden = false;
  menuButton?.setAttribute('aria-expanded', 'true');
  // Phaser scene pause freezes fixed-step physics, the timer, AI, FX and tweens.
  game.scene.pause('Arena');
  resumeButton?.focus({ preventScroll: true });
}
function closeMenu(): void {
  if (!menuOpen || !overlay) return;
  finishLayoutEditing();
  controls.clear();
  menuOpen = false;
  overlay.hidden = true;
  menuButton?.setAttribute('aria-expanded', 'false');
  game.scene.resume('Arena');
  menuButton?.focus({ preventScroll: true });
}
function toggleMenu(): void {
  if (touchLayout.isEditing) { finishLayoutEditing(); return; }
  if (menuOpen) closeMenu();
  else openMenu();
}
function updateMode(): void {
  cpuButton?.classList.toggle('selected', arena.getMode() === 'cpu');
  versusButton?.classList.toggle('selected', arena.getMode() === 'versus');
}
function setMode(mode: 'cpu' | 'versus'): void {
  arena.setMode(mode);
  updateMode();
  closeMenu();
}
function toggleDebug(): void {
  arena.setDebug(!arena.getDebug());
  if (debugButton) debugButton.textContent = '▣ Хітбокси: ' + (arena.getDebug() ? 'увімк.' : 'викл.');
}
function restartRound(): void {
  arena.resetRound();
  closeMenu();
}

menuButton?.addEventListener('click', openMenu);
layoutEditButton?.addEventListener('click', openLayoutEditing);
layoutDoneButton?.addEventListener('click', finishLayoutEditing);
resumeButton?.addEventListener('click', closeMenu);
cpuButton?.addEventListener('click', () => setMode('cpu'));
versusButton?.addEventListener('click', () => setMode('versus'));
debugButton?.addEventListener('click', toggleDebug);
restartButton?.addEventListener('click', restartRound);
fullscreenButton?.addEventListener('click', async () => {
  if (!frame) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await frame.requestFullscreen();
    resizeArena();
  } catch {
    if (status) status.textContent = 'Повноекранний режим недоступний у цьому браузері.';
  }
});
document.addEventListener('fullscreenchange', () => {
  requestAnimationFrame(resizeArena);
  if (fullscreenButton) {
    fullscreenButton.textContent = document.fullscreenElement ? '⛶ Згорнути екран' : '⛶ На весь екран';
  }
});

// Accessible keyboard control, including the ability to dismiss the modal.
window.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.code === 'Escape' || event.code === 'KeyP') {
    event.preventDefault();
    toggleMenu();
    return;
  }
  // While the menu is open, do not allow gameplay shortcuts to alter the arena.
  if (menuOpen) return;
  switch (event.code) {
    case 'KeyR': restartRound(); break;
    case 'Digit1': setMode('cpu'); break;
    case 'Digit2': setMode('versus'); break;
  }
});

// Gamepad Start (standard button 9) works even while the Phaser scene is paused.
function pollGamepadMenu(): void {
  const pads = navigator.getGamepads?.() ?? [];
  const startIsDown = Array.from(pads).some(pad => Boolean(pad?.buttons[9]?.pressed));
  if (startIsDown && !gamepadStartWasDown) toggleMenu();
  gamepadStartWasDown = startIsDown;
  requestAnimationFrame(pollGamepadMenu);
}
requestAnimationFrame(pollGamepadMenu);

window.addEventListener('gamepadconnected', event => {
  if (status && event instanceof GamepadEvent) {
    status.textContent = 'Геймпад підключено: ' + event.gamepad.id;
  }
});
window.addEventListener('blur', () => { if (!menuOpen) openMenu(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !menuOpen) openMenu();
});
updateMode();
