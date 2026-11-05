import Phaser from 'phaser';
import './styles.css';
import { Controls } from './input/Controls';
import { ArenaScene } from './scenes/ArenaScene';
import { TouchLayoutEditor } from './ui/TouchLayoutEditor';
import { CharacterSelector, type MatchMode } from './ui/CharacterSelector';
import { getCharacter, portraitSvg } from './characters/Roster';
import type { FighterId } from './combat/Fighter';

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
const changeFightersButton = document.querySelector<HTMLButtonElement>('#btn-choose-characters');
const fullscreenButton = document.querySelector<HTMLButtonElement>('#btn-fullscreen');
const menuButton = document.querySelector<HTMLButtonElement>('#btn-menu');
const resumeButton = document.querySelector<HTMLButtonElement>('#btn-resume');
const overlay = document.querySelector<HTMLElement>('#pause-overlay');
const frame = document.querySelector<HTMLElement>('#game-frame');
const layoutEditButton = document.querySelector<HTMLButtonElement>('#btn-layout-edit');
const layoutDoneButton = document.querySelector<HTMLButtonElement>('#btn-layout-done');
const avatar1 = document.querySelector<HTMLElement>('#hud-avatar-p1');
const avatar2 = document.querySelector<HTMLElement>('#hud-avatar-p2');
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
  frame.style.setProperty('--hud-scale', String(rect.height / 540));
  touchLayout.sync();
}
if (frame && typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(resizeArena).observe(frame);
}
window.addEventListener('resize', resizeArena);
requestAnimationFrame(resizeArena);

let menuOpen = false;
let selecting = true; // No match begins without player 1 choosing a fighter.
let initialSelection = true;
let gamepadStartWasDown = false;

function updateMode(): void {
  cpuButton?.classList.toggle('selected', arena.getMode() === 'cpu');
  versusButton?.classList.toggle('selected', arena.getMode() === 'versus');
}
function updateAvatars(p1: FighterId, p2: FighterId): void {
  if (avatar1) {
    avatar1.innerHTML = portraitSvg(p1);
    avatar1.style.setProperty('--avatar-color', getCharacter(p1).color);
  }
  if (avatar2) {
    avatar2.innerHTML = portraitSvg(p2);
    avatar2.style.setProperty('--avatar-color', getCharacter(p2).color);
  }
}

function finishLayoutEditing(): void {
  if (!touchLayout.isEditing) return;
  touchLayout.stop();
  if (menuOpen && overlay) {
    overlay.hidden = false;
    layoutEditButton?.focus({ preventScroll: true });
  }
}

function startMatch(p1: FighterId, p2: FighterId, mode: MatchMode): void {
  // The selector itself guarantees p1 != p2 in PvP and CPU alike.
  if (p1 === p2) return;
  arena.setMatchup(p1, p2, mode);
  updateAvatars(p1, p2);
  updateMode();
  controls.clear();
  selector.hide();
  selecting = false;
  initialSelection = false;
  menuOpen = false;
  if (overlay) overlay.hidden = true;
  if (menuButton) {
    menuButton.hidden = false;
    menuButton.setAttribute('aria-expanded', 'false');
  }
  game.scene.resume('Arena');
}

function returnToMenu(): void {
  if (initialSelection || !overlay) return;
  selector.hide();
  selecting = false;
  menuOpen = true;
  overlay.hidden = false;
  if (menuButton) {
    menuButton.hidden = false;
    menuButton.setAttribute('aria-expanded', 'true');
  }
  game.scene.pause('Arena');
  resumeButton?.focus({ preventScroll: true });
}

const selector = new CharacterSelector(startMatch, returnToMenu);

function showCharacterSelect(mode: MatchMode, allowBack: boolean): void {
  finishLayoutEditing();
  controls.clear();
  game.scene.pause('Arena');
  selecting = true;
  menuOpen = false;
  if (overlay) overlay.hidden = true;
  if (menuButton) {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.hidden = true;
  }
  selector.show(mode, allowBack);
}
function openMenu(): void {
  if (menuOpen || selecting || !overlay) return;
  menuOpen = true;
  controls.clear();
  overlay.hidden = false;
  menuButton?.setAttribute('aria-expanded', 'true');
  game.scene.pause('Arena');
  resumeButton?.focus({ preventScroll: true });
}
function openLayoutEditing(): void {
  if (!menuOpen || !overlay || touchLayout.isEditing) return;
  controls.clear();
  overlay.hidden = true;
  touchLayout.start();
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
  if (selecting) {
    if (!initialSelection && selector.canGoBack) selector.goBack();
    return;
  }
  if (touchLayout.isEditing) { finishLayoutEditing(); return; }
  if (menuOpen) closeMenu();
  else openMenu();
}
function toggleDebug(): void {
  arena.setDebug(!arena.getDebug());
  if (debugButton) debugButton.textContent = '▣ Хітбокси: ' + (arena.getDebug() ? 'увімк.' : 'викл.');
}
function restartRound(): void {
  if (selecting) return;
  arena.resetRound(); // Keep the same two characters on a round restart.
  closeMenu();
}

menuButton?.addEventListener('click', openMenu);
resumeButton?.addEventListener('click', closeMenu);
layoutEditButton?.addEventListener('click', openLayoutEditing);
layoutDoneButton?.addEventListener('click', finishLayoutEditing);
cpuButton?.addEventListener('click', () => showCharacterSelect('cpu', true));
versusButton?.addEventListener('click', () => showCharacterSelect('versus', true));
changeFightersButton?.addEventListener('click',
  () => showCharacterSelect(arena.getMode(), true));
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

window.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.code === 'Escape' || event.code === 'KeyP') {
    event.preventDefault();
    toggleMenu();
    return;
  }
  // Selecting a character disables gameplay shortcuts.
  if (menuOpen || selecting) return;
  switch (event.code) {
    case 'KeyR': restartRound(); break;
    case 'Digit1': showCharacterSelect('cpu', true); break;
    case 'Digit2': showCharacterSelect('versus', true); break;
  }
});

function pollGamepadMenu(): void {
  const pads = navigator.getGamepads?.() ?? [];
  const startIsDown = Array.from(pads).some(pad => Boolean(pad?.buttons[9]?.pressed));
  if (startIsDown && !gamepadStartWasDown && !selecting) toggleMenu();
  gamepadStartWasDown = startIsDown;
  requestAnimationFrame(pollGamepadMenu);
}
requestAnimationFrame(pollGamepadMenu);

window.addEventListener('gamepadconnected', event => {
  if (status && event instanceof GamepadEvent) {
    status.textContent = 'Геймпад підключено: ' + event.gamepad.id;
  }
});
window.addEventListener('blur', () => {
  if (!menuOpen && !selecting) openMenu();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !menuOpen && !selecting) openMenu();
});

// Initial state: selector is visible, but no round, timer or AI is running.
menuButton?.setAttribute('hidden', '');
selector.show('cpu', false);
updateMode();
resizeArena();
