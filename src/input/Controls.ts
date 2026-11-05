export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'light' | 'heavy' | 'kick' | 'special';
export type InputState = Record<Action, boolean>;
type Direction = 'left' | 'right' | 'up' | 'down';

const ACTIONS: Action[] = ['left', 'right', 'up', 'down', 'jump', 'light', 'heavy', 'kick', 'special'];
const DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down'];

export const emptyInput = (): InputState => ({
  left: false, right: false, up: false, down: false, jump: false,
  light: false, heavy: false, kick: false, special: false,
});

const KEYMAPS: Record<Action, string>[] = [
  {
    left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', jump: 'Space',
    light: 'KeyJ', heavy: 'KeyK', kick: 'KeyU', special: 'KeyI',
  },
  {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'Numpad0',
    light: 'Numpad1', heavy: 'Numpad2', kick: 'Numpad4', special: 'Numpad5',
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
  // Standard mapping: X=light, Y=heavy, A=kick, B=special.
  state.light = held(2);
  state.heavy = held(3);
  state.kick = held(0);
  state.special = held(1);
  state.jump = held(5); // Optional: right shoulder button for jumping while moving.
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

  private joystickPointer: number | null = null;
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
      // Capturing this pointer allows thumb movement even outside the base.
      area.setPointerCapture(event.pointerId);
      area.classList.add('engaged');
      this.moveJoystick(event);
    });
    area.addEventListener('pointermove', event => {
      if (event.pointerId !== this.joystickPointer) return;
      if (event.cancelable) event.preventDefault();
      this.moveJoystick(event);
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId === this.joystickPointer) this.releaseJoystick();
    };
    area.addEventListener('pointerup', release);
    area.addEventListener('pointercancel', release);
    area.addEventListener('lostpointercapture', release);
    area.addEventListener('contextmenu', event => event.preventDefault());
  }

  private moveJoystick(event: PointerEvent): void {
    if (!this.joystickBase || !this.joystickThumb) return;
    const rect = this.joystickBase.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const maxRadius = rect.width * 0.30; // 36px for a 120px base
    const deadZone = rect.width / 6; // 20px for a 120px base
    const ratio = distance > 0 ? Math.min(1, maxRadius / distance) : 0;
    this.joystickThumb.style.setProperty('--joy-x', `${Math.round(dx * ratio)}px`);
    this.joystickThumb.style.setProperty('--joy-y', `${Math.round(dy * ratio)}px`);

    for (const direction of DIRECTIONS) this.joystickDirections[direction] = false;
    if (distance <= deadZone) {
      this.joystickBase.classList.remove('moving');
      return;
    }
    this.joystickBase.classList.add('moving');
    // Wider diagonal sectors: up + horizontal can be activated without releasing movement.
    // The separate jump button has an independent state, so jumping remains possible
    // even when the directional stick is already held upward.
    const nx = dx / distance;
    const ny = dy / distance;
    const diagonalThreshold = 0.30;
    this.joystickDirections.left = nx < -diagonalThreshold;
    this.joystickDirections.right = nx > diagonalThreshold;
    this.joystickDirections.up = ny < -diagonalThreshold;
    this.joystickDirections.down = ny > diagonalThreshold;
  }

  private releaseJoystick(): void {
    const pointer = this.joystickPointer;
    this.joystickPointer = null;
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
      const release = (event: PointerEvent) => {
        this.touches.delete(event.pointerId);
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
  }

  clear(): void {
    this.keys.clear();
    this.touches.clear();
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
      for (const direction of DIRECTIONS) {
        state[direction] ||= this.joystickDirections[direction];
      }
    }
    const pads = navigator.getGamepads?.() ?? [];
    const pad = gamepadInput(pads[player] ?? null);
    for (const action of ACTIONS) {
      state[action] ||= pad[action];
    }
    return state;
  }
}
