export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'light' | 'heavy' | 'kick' | 'block' | 'special';
export type InputState = Record<Action, boolean>;
type Direction = 'left' | 'right' | 'up' | 'down';

const ACTIONS: Action[] = ['left', 'right', 'up', 'down', 'jump', 'light', 'heavy', 'kick', 'block', 'special'];
const DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down'];

export const emptyInput = (): InputState => ({
  left: false, right: false, up: false, down: false, jump: false,
  light: false, heavy: false, kick: false, block: false, special: false,
});

const KEYMAPS: Record<Action, string>[] = [
  {
    left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', jump: 'Space',
    light: 'KeyJ', heavy: 'KeyK', kick: 'KeyL', block: 'KeyH', special: 'KeyI',
  },
  {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'Numpad0',
    light: 'Numpad1', heavy: 'Numpad2', kick: 'Numpad4', block: 'Numpad5', special: 'Numpad6',
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
  // B+Y is a chord; R1 / RB (button 5) is a direct special shortcut.
  state.block = held(0);
  state.kick = held(1);
  state.light = held(2);
  state.heavy = held(3);
  state.special = held(5) || (state.kick && state.heavy);
  state.jump = held(4); // Optional LB/L1 jump; stick up remains the primary jump control.
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
  // One-finger combo swipe: drag a held B (kick) onto Y (heavy), or the reverse.
  // The gesture remains active for the pointer lifetime, like a two-button chord.
  private comboSwipePointers = new Set<number>();
  // Preserve fast swipes long enough for the next 60Hz simulation sample.
  private comboSwipePulseUntil = 0;

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
        const other = action === 'kick' ? 'heavy' : action === 'heavy' ? 'kick' : null;
        if (!other || this.comboSwipePointers.has(event.pointerId)) return;
        const partner = this.buttons.get(other);
        if (!partner) return;
        const rect = partner.getBoundingClientRect();
        const tolerance = 9;
        if (event.clientX >= rect.left - tolerance && event.clientX <= rect.right + tolerance &&
            event.clientY >= rect.top - tolerance && event.clientY <= rect.bottom + tolerance) {
          this.comboSwipePointers.add(event.pointerId);
          this.comboSwipePulseUntil = performance.now() + 220;
          this.updateVisuals();
        }
      });
      const release = (event: PointerEvent) => {
        this.touches.delete(event.pointerId);
        this.comboSwipePointers.delete(event.pointerId);
        this.updateVisuals();
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', event => event.preventDefault());
    });
  }

  private updateVisuals(): void {
    const pressed = new Set(this.touches.values());
    for (const [action, button] of this.buttons) {
      button.classList.toggle('pressed', pressed.has(action));
    }
    document.querySelector('.touch-attacks')?.classList.toggle('combo-active',
      (pressed.has('kick') && pressed.has('heavy')) || this.comboSwipePointers.size > 0);
  }

  clear(): void {
    this.keys.clear();
    this.touches.clear();
    this.comboSwipePointers.clear();
    this.comboSwipePulseUntil=0;
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
    // Touchscreen: a single thumb swipe B<->Y produces the same special
    // signal as the two-finger chord. No additional visible button is needed.
    state.special ||= state.kick && state.heavy;
    if (player === 0 && (this.comboSwipePointers.size > 0 ||
        performance.now() < this.comboSwipePulseUntil)) state.special = true;
    return state;
  }
}
