export type Action = 'left' | 'right' | 'up' | 'down' | 'light' | 'heavy' | 'kick' | 'special';
export type InputState = Record<Action, boolean>;

const ACTIONS: Action[] = ['left', 'right', 'up', 'down', 'light', 'heavy', 'kick', 'special'];

export const emptyInput = (): InputState => ({
  left: false, right: false, up: false, down: false,
  light: false, heavy: false, kick: false, special: false,
});

const KEYMAPS: Record<Action, string> [] = [
  {
    left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
    light: 'KeyJ', heavy: 'KeyK', kick: 'KeyU', special: 'KeyI',
  },
  {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
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
  // Standard Gamepad mapping: X=light, Y=heavy, A=kick, B=special.
  state.light = held(2);
  state.heavy = held(3);
  state.kick = held(0);
  state.special = held(1);
  return state;
}

export class Controls {
  private keys = new Set<string>();
  private touches = new Map<number, Action>();
  private buttons = new Map<Action, HTMLButtonElement>();

  constructor() {
    window.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (KEYMAPS.some(map => Object.values(map).includes(event.code)) ||
          ['Space', 'KeyR', 'KeyH'].includes(event.code)) {
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
    document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach(button => {
      const action = button.dataset.control as Action;
      this.buttons.set(action, button);
      button.addEventListener('pointerdown', (event) => {
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
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    });
  }

  private updateVisuals(): void {
    for (const [action, button] of this.buttons) {
      button.classList.toggle('pressed', [...this.touches.values()].includes(action));
    }
  }

  clear(): void {
    this.keys.clear();
    this.touches.clear();
    this.updateVisuals();
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  read(player: 0 | 1): InputState {
    const state = emptyInput();
    const map = KEYMAPS[player];
    for (const action of ACTIONS) {
      state[action] = this.keys.has(map[action]);
      if (player === 0 && [...this.touches.values()].includes(action)) {
        state[action] = true;
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
