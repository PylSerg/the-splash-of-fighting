import { deriveCommandChords, visualChords } from './CommandRules';
import { splashChord } from '../combat/SplashRules';

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'light' | 'heavy' | 'kick' | 'block' | 'grab' | 'special' | 'duel' | 'roll' | 'splash';
export type InputState = Record<Action, boolean>;
type Direction = 'left' | 'right' | 'up' | 'down';

const ACTIONS: Action[] = ['left', 'right', 'up', 'down', 'jump', 'light', 'heavy', 'kick', 'block', 'grab', 'special', 'duel', 'roll', 'splash'];
const DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down'];

export const emptyInput = (): InputState => ({
  left: false, right: false, up: false, down: false, jump: false,
  light: false, heavy: false, kick: false, block: false, grab: false, special: false, duel: false, roll: false, splash: false,
});

// Roll has no dedicated keyboard key: down+direction+block+light is its chord.
const KEYMAPS: Record<Exclude<Action,'roll'|'duel'|'special'|'splash'>, string>[] = [
  {
    left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', jump: 'Space',
    light: 'KeyJ', heavy: 'KeyK', kick: 'KeyL', block: 'KeyH', grab: 'KeyG',
  },
  {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'Numpad0',
    light: 'Numpad1', heavy: 'Numpad2', kick: 'Numpad4', block: 'Numpad5', grab: 'Numpad3',
  },
];

function gamepadInput(pad: Gamepad | null): InputState {
  const state = emptyInput();
  if (!pad) return state;

  const axisX = pad.axes[0] ?? 0;
  const axisY = pad.axes[1] ?? 0;
  const held = (button: number) => Boolean(pad.buttons[button]?.pressed);
  state.left = axisX < -0.33 || held(14);
  state.right = axisX > 0.33 || held(15);
  state.up = axisY < -0.55 || held(12);
  state.down = axisY > 0.55 || held(13);
  // Standard Xbox-style gamepad: A=block, B=kick, X=light, Y=heavy.
  // B+Y initiates a duel; R1/RB initiates a duel after a short chord delay.
  // R1+R2 (RB+RT) is the special chord. Both require forward direction.
  state.block = held(0);
  state.kick = held(1);
  state.light = held(2);
  state.heavy = held(3);
  // Shoulder chords are resolved together with keyboard/touch in read().
  // L1/LB (button 4) is an independent grab shortcut.
  // X+A still triggers the same grab as before.
  state.grab = held(4) || (state.light && state.block);
  // L2 / LT is the direct roll shortcut. Direction is required in read().
  // Use the pressed bit OR analog value for browser/gamepad compatibility.
  state.roll = held(6) || (pad.buttons[6]?.value ?? 0) > .5;
  // Jump stays on stick-up / D-pad up; L1 no longer jumps.
  return state;
}

/**
 * Keyboard + Gamepad API + independent multi-pointer touch controller.
 * The joystick uses an 8-way digital output so the combat simulation
 * doesn't depend on the renderer, viewport size or touch pressure.
 */
export class Controls {
  private keys = new Set<string>();
  private touches = new Map<number, Action>();
  private buttons = new Map<Action, HTMLButtonElement>();
  // One-finger duel swipe: drag a held B (kick) onto Y (heavy), or the reverse.
  // The gesture remains active for the pointer lifetime, like a two-button chord.
  private comboSwipePointers = new Set<number>();
  // Preserve fast swipes long enough for the next 60Hz simulation sample.
  private comboSwipePulseUntil = 0;
  // X↔Y is the original SPLASH chord: support two held fingers OR one
  // continuous swipe while the other thumb holds Up on the joystick.
  private splashSwipePointers = new Set<number>();
  private splashSwipePulseUntil = 0;
  // A<->B is a one-finger special chord; B<->Y is the duel chord.
  private specialSwipePointers = new Set<number>();
  private specialSwipePulseUntil = 0;
  // Delay single R1 so R1+R2 can register as a special without a duel.
  private r1Started: [number,number] = [0,0];
  private r1Held: [boolean,boolean] = [false,false];
  // X<->A swipe uses an independent pointer and a brief input pulse.
  private grabSwipePointers = new Set<number>();
  private grabSwipePulseUntil = 0;

  private joystickPointer: number | null = null;
  // Directional state is owned by the joystick pointer, never by attack pointers.
  // Its last known position persists while other fingers press attack buttons.
  private joystickPosition: {x: number; y: number} | null = null;
  private joystickDirections: Record<Direction, boolean> = {
    left: false, right: false, up: false, down: false,
  };
  private joystickArea: HTMLElement | null = null;
  private joystickBase: HTMLElement | null = null;
  private joystickThumb: HTMLElement | null = null;

  constructor() {
    window.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (KEYMAPS.some(map => Object.values(map).includes(event.code)) ||
          ['Space', 'KeyR', 'KeyH'].includes(event.code)) {
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('pagehide', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });

    this.bindJoystick();
    this.bindAttackButtons();
  }

  private bindJoystick(): void {
    const area = document.querySelector<HTMLElement>('#virtual-joystick');
    const base = area?.querySelector<HTMLElement>('.joystick-base');
    const thumb = area?.querySelector<HTMLElement>('.joystick-thumb');
    if (!area || !base || !thumb) return;
    this.joystickArea = area;
    this.joystickBase = base;
    this.joystickThumb = thumb;

    area.addEventListener('pointerdown', event => {
      if (this.joystickPointer !== null) return;
      if (event.cancelable) event.preventDefault();
      this.joystickPointer = event.pointerId;
      // This finger owns the stick until it releases; other fingers cannot steal it.
      area.setPointerCapture(event.pointerId);
      area.classList.add('engaged');
      this.moveJoystick(event);
    });
    const track = (event: PointerEvent) => {
      if (event.pointerId !== this.joystickPointer) return;
      if (event.cancelable) event.preventDefault();
      this.moveJoystick(event);
    };
    area.addEventListener('pointermove', track);
    // Use higher frequency position reports where the browser supports them.
    area.addEventListener('pointerrawupdate', track as EventListener);
    const release = (event: PointerEvent) => {
      if (event.pointerId === this.joystickPointer) this.releaseJoystick();
    };
    area.addEventListener('pointerup', release);
    area.addEventListener('pointercancel', release);
    area.addEventListener('lostpointercapture', release);
    area.addEventListener('contextmenu', event => event.preventDefault());
  }

  private moveJoystick(event: PointerEvent): void {
    this.joystickPosition = {x: event.clientX, y: event.clientY};
    this.updateJoystickDirections();
  }

  private updateJoystickDirections(): void {
    if (!this.joystickPosition || !this.joystickBase || !this.joystickThumb) return;
    // Read the stick from its own last position at every simulation sample,
    // independently of what the attacking finger is doing.
    const rect = this.joystickBase.getBoundingClientRect();
    const dx = this.joystickPosition.x - (rect.left + rect.width / 2);
    const dy = this.joystickPosition.y - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const maxRadius = rect.width * 0.30;
    const deadZone = rect.width / 6;
    const ratio = distance > 0 ? Math.min(1, maxRadius / distance) : 0;
    this.joystickThumb.style.setProperty('--joy-x', `${Math.round(dx * ratio)}px`);
    this.joystickThumb.style.setProperty('--joy-y', `${Math.round(dy * ratio)}px`);

    for (const direction of DIRECTIONS) this.joystickDirections[direction] = false;
    if (distance <= deadZone) {
      this.joystickBase.classList.remove('moving');
      return;
    }
    this.joystickBase.classList.add('moving');
    const nx = dx / distance;
    const ny = dy / distance;
    // A generous diagonal sector allows pushing up while holding left or right.
    const diagonalThreshold = 0.30;
    this.joystickDirections.left = nx < -diagonalThreshold;
    this.joystickDirections.right = nx > diagonalThreshold;
    this.joystickDirections.up = ny < -diagonalThreshold;
    this.joystickDirections.down = ny > diagonalThreshold;
  }

  private releaseJoystick(): void {
    const pointer = this.joystickPointer;
    this.joystickPointer = null;
    this.joystickPosition = null;
    for (const direction of DIRECTIONS) this.joystickDirections[direction] = false;
    this.joystickThumb?.style.setProperty('--joy-x', '0px');
    this.joystickThumb?.style.setProperty('--joy-y', '0px');
    this.joystickArea?.classList.remove('engaged');
    this.joystickBase?.classList.remove('moving');
    if (pointer !== null && this.joystickArea?.hasPointerCapture(pointer)) {
      this.joystickArea.releasePointerCapture(pointer);
    }
  }

  private bindAttackButtons(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach(button => {
      const action = button.dataset.control as Action;
      this.buttons.set(action, button);
      button.addEventListener('pointerdown', event => {
        if (event.cancelable) event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.touches.set(event.pointerId, action);
        this.updateVisuals();
      });
      // Keep pointer capture on the originating attack button, then inspect
      // whether that finger has crossed into the other combo button's hit area.
      // This does not interfere with a second finger or with the joystick.
      button.addEventListener('pointermove', event => {
        if (this.touches.get(event.pointerId) !== action) return;
        // One-finger chord swipes: X↔Y SPLASH, B↔Y duel,
        // A↔B special, X↔A grab. Every swipe retains its own pointer.
        const partners: {other:Action;pointers:Set<number>;
          pulse:'duel'|'special'|'grab'|'splash'}[] = [];
        if(action==='kick') {
          partners.push({other:'heavy',pointers:this.comboSwipePointers,pulse:'duel'});
          partners.push({other:'block',pointers:this.specialSwipePointers,pulse:'special'});
        } else if(action==='heavy') {
          partners.push({other:'light',pointers:this.splashSwipePointers,pulse:'splash'});
          partners.push({other:'kick',pointers:this.comboSwipePointers,pulse:'duel'});
        } else if(action==='block') {
          partners.push({other:'light',pointers:this.grabSwipePointers,pulse:'grab'});
          partners.push({other:'kick',pointers:this.specialSwipePointers,pulse:'special'});
        } else if(action==='light') {
          partners.push({other:'heavy',pointers:this.splashSwipePointers,pulse:'splash'});
          partners.push({other:'block',pointers:this.grabSwipePointers,pulse:'grab'});
        }
        for(const {other,pointers,pulse} of partners) {
          if(pointers.has(event.pointerId)) continue;
          const partner=this.buttons.get(other);
          if(!partner) continue;
          const rect=partner.getBoundingClientRect(),tolerance=9;
          if (event.clientX >= rect.left-tolerance && event.clientX <= rect.right+tolerance &&
              event.clientY >= rect.top-tolerance && event.clientY <= rect.bottom+tolerance) {
            pointers.add(event.pointerId);
            if(pulse==='duel') this.comboSwipePulseUntil=performance.now()+220;
            else if(pulse==='special') this.specialSwipePulseUntil=performance.now()+220;
            else if(pulse==='splash') this.splashSwipePulseUntil=performance.now()+220;
            else this.grabSwipePulseUntil=performance.now()+220;
            this.updateVisuals();
            break;
          }
        }
      });
      const release = (event: PointerEvent) => {
        this.touches.delete(event.pointerId);
        this.comboSwipePointers.delete(event.pointerId);
        this.splashSwipePointers.delete(event.pointerId);
        this.specialSwipePointers.delete(event.pointerId);
        this.grabSwipePointers.delete(event.pointerId);
        this.updateVisuals();
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', event => event.preventDefault());
    });
  }

  private updateVisuals(): void {
    const pressed=new Set(this.touches.values());
    const splashSwiped=this.splashSwipePointers.size>0 ||
      performance.now()<this.splashSwipePulseUntil;
    const diamond=document.querySelector('.touch-attacks');
    const chord=visualChords({
      light:pressed.has('light'),heavy:pressed.has('heavy'),
      kick:pressed.has('kick'),block:pressed.has('block'),
      specialSwipe:this.specialSwipePointers.size>0 ||
        performance.now()<this.specialSwipePulseUntil,
      duelSwipe:this.comboSwipePointers.size>0 ||
        performance.now()<this.comboSwipePulseUntil,
      grabSwipe:this.grabSwipePointers.size>0,
    });
    for(const [action,button] of this.buttons){
      button.classList.toggle('pressed',(
        pressed.has(action) || (splashSwiped && (action==='light'||action==='heavy'))
      ) && !(action==='heavy' && chord.special));
    }
    // A+B MUST highlight A and B, never Y. The old shared combo-active
    // class incorrectly made Y appear pressed on the special chord.
    diamond?.classList.toggle('duel-active',chord.duel);
    diamond?.classList.toggle('splash-xy-active',splashSwiped ||
      (pressed.has('light')&&pressed.has('heavy')));
    diamond?.classList.toggle('special-active',chord.special);
    diamond?.classList.toggle('grab-active',chord.grab);
  }

  clear(): void {
    this.keys.clear();
    this.touches.clear();
    this.comboSwipePointers.clear();
    this.comboSwipePulseUntil=0;
    this.splashSwipePointers.clear();
    this.splashSwipePulseUntil=0;
    this.specialSwipePointers.clear();
    this.specialSwipePulseUntil=0;
    this.r1Started=[0,0];this.r1Held=[false,false];
    this.grabSwipePointers.clear();
    this.grabSwipePulseUntil=0;
    this.releaseJoystick();
    this.updateVisuals();
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  read(player: 0 | 1): InputState {
    const state = emptyInput();
    const map = KEYMAPS[player];
    const touched = player === 0 ? new Set(this.touches.values()) : null;
    for (const action of ACTIONS) {
      if (action === 'roll' || action === 'duel' || action === 'special' || action === 'splash') continue;
      state[action] = this.keys.has(map[action]) || Boolean(touched?.has(action));
    }
    if (player === 0) {
      if (this.joystickPointer !== null) this.updateJoystickDirections();
      for (const direction of DIRECTIONS) {
        state[direction] ||= this.joystickDirections[direction];
      }
    }
    // Combine physical inputs before deriving B+Y, so one key can be on
    // a gamepad and another on the touchscreen or keyboard.
    const pads = navigator.getGamepads?.() ?? [];
    const pad = gamepadInput(pads[player] ?? null);
    for (const action of ACTIONS) {
      state[action] ||= pad[action];
    }
    // Two physical X/Y touches are independent pointer IDs. A continuous
    // X↔Y swipe also logically holds both, so SPLASH only needs two
    // fingers on a phone: one Up and one across X/Y.
    if(player===0 && (this.splashSwipePointers.size>0 ||
        performance.now()<this.splashSwipePulseUntil)){
      state.light=true;
      state.heavy=true;
    }
    const l1Down=Boolean(pads[player]?.buttons[4]?.pressed);
    const r1Down=Boolean(pads[player]?.buttons[5]?.pressed);
    const r2Down=Boolean(pads[player]?.buttons[7]?.pressed) ||
      (pads[player]?.buttons[7]?.value ?? 0)>.5;
    if(r1Down && !this.r1Held[player]) this.r1Started[player]=performance.now();
    this.r1Held[player]=r1Down;
    // A slightly delayed lone R1 avoids triggering duel while the player
    // is pressing R1+R2 to activate the forward special.
    const r1Solo=r1Down && !r2Down &&
      performance.now()-this.r1Started[player]>=105;
    // Two-finger or one-finger swipe chords work beside an independent joystick.
    const commands=deriveCommandChords({
      block:state.block,kick:state.kick,heavy:state.heavy,
      r1Solo,r1AndR2:r1Down && r2Down,
      duelSwipe:player===0 && (this.comboSwipePointers.size>0 ||
        performance.now()<this.comboSwipePulseUntil),
      specialSwipe:player===0 && (this.specialSwipePointers.size>0 ||
        performance.now()<this.specialSwipePulseUntil),
    });
    state.duel=commands.duel;
    state.special=commands.special;
    state.splash=splashChord({
      up:state.up,light:state.light,heavy:state.heavy,l1:l1Down,r1:r1Down,
    });
    if(state.splash){
      // Real Up+X+Y (or X↔Y swipe) and Up+L1+R1 take priority.
      state.duel=false;state.special=false;
    } else if(state.special){
      // A+B is never also a Y attack. Shield accidental overlaps with
      // the nearby Y touch region without suppressing a genuine splash.
      state.heavy=false;
    }
    const touchGrabSwipe = player === 0 &&
      (this.grabSwipePointers.size > 0 ||
       performance.now() < this.grabSwipePulseUntil);
    state.grab ||= state.light && state.block || touchGrabSwipe;
    if(state.splash)state.grab=false;

    // Preserve the held X+A/L1 input during a grapple, including diagonals.
    // Outside a grapple, ArenaScene gives a roll priority over a new grab.
    // Without a direction L2/LT remains inert.
    const horizontal = state.left !== state.right;
    const chordRoll = state.down && (state.light && state.block || touchGrabSwipe);
    state.roll = horizontal && (state.roll || chordRoll);
    return state;
  }
}
