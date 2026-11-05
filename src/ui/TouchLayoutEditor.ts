type ControlName = 'joystick' | 'diamond';
interface Placement { x: number; y: number; scale: number; }
type ControlLayout = Record<ControlName, Placement>;

const STORAGE_KEY = 'the-splash-control-layout-v1';
const DEFAULTS: ControlLayout = {
  joystick: { x: .13, y: .78, scale: 1 },
  diamond: { x: .78, y: .73, scale: 1 },
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Normalized, persistent layout for the complete joystick and ABXY diamond. */
export class TouchLayoutEditor {
  private frame: HTMLElement;
  private touchControls: HTMLElement;
  private editor: HTMLElement;
  private elements: Record<ControlName, HTMLElement>;
  private ranges: Record<ControlName, HTMLInputElement>;
  private values: Record<ControlName, HTMLOutputElement>;
  private placements: ControlLayout;
  private drag: {
    name: ControlName;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null = null;
  isEditing = false;

  constructor() {
    const required = <T extends HTMLElement>(selector: string): T => {
      const el = document.querySelector<T>(selector);
      if (!el) throw new Error('Missing touch layout element: ' + selector);
      return el;
    };
    this.frame = required('#game-frame');
    this.touchControls = required('.touch-controls');
    this.editor = required('#control-layout-editor');
    this.elements = {
      joystick: required('#virtual-joystick'),
      diamond: required('.touch-attacks'),
    };
    this.ranges = {
      joystick: required('#joystick-scale'),
      diamond: required('#diamond-scale'),
    };
    this.values = {
      joystick: required('#joystick-scale-value'),
      diamond: required('#diamond-scale-value'),
    };
    this.placements = this.load();
    this.sync();

    for (const name of ['joystick', 'diamond'] as const) {
      this.ranges[name].addEventListener('input', () => {
        this.placements[name].scale = clamp(Number(this.ranges[name].value) / 100, .65, 1.6);
        this.apply(name);
        this.save();
      });
      const element = this.elements[name];
      // Capture before the game's action handlers: editing must never attack.
      element.addEventListener('pointerdown', event => {
        if (!this.isEditing) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const rect = this.frame.getBoundingClientRect();
        const target = this.placements[name];
        this.drag = {
          name, pointerId: event.pointerId,
          offsetX: event.clientX - (rect.left + target.x * rect.width),
          offsetY: event.clientY - (rect.top + target.y * rect.height),
        };
        element.setPointerCapture(event.pointerId);
        element.classList.add('dragging');
      }, true);
      element.addEventListener('pointermove', event => {
        if (!this.isEditing || !this.drag ||
          this.drag.name !== name || this.drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const rect = this.frame.getBoundingClientRect();
        const centerX = (event.clientX - rect.left - this.drag.offsetX) / rect.width;
        const centerY = (event.clientY - rect.top - this.drag.offsetY) / rect.height;
        this.placements[name].x = centerX;
        this.placements[name].y = centerY;
        this.apply(name);
      }, true);
      const release = (event: PointerEvent) => {
        if (!this.drag || this.drag.name !== name ||
            this.drag.pointerId !== event.pointerId) return;
        event.stopImmediatePropagation();
        this.drag = null;
        element.classList.remove('dragging');
        if (element.hasPointerCapture(event.pointerId)) {
          element.releasePointerCapture(event.pointerId);
        }
        this.save();
      };
      element.addEventListener('pointerup', release, true);
      element.addEventListener('pointercancel', release, true);
      element.addEventListener('lostpointercapture', release, true);
    }
    document.querySelector('#btn-layout-reset')?.addEventListener('click', () => this.reset());
    document.querySelector('#btn-layout-reset-menu')?.addEventListener('click', () => this.reset());
  }

  private load(): ControlLayout {
    let stored: unknown;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { /* Private mode. */ }
    const data = stored && typeof stored === 'object' ? stored as Record<string, unknown> : {};
    const restore = (name: ControlName): Placement => {
      const raw = data[name];
      const o = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      const def = DEFAULTS[name];
      return {
        x: typeof o.x === 'number' && Number.isFinite(o.x) ? o.x : def.x,
        y: typeof o.y === 'number' && Number.isFinite(o.y) ? o.y : def.y,
        scale: typeof o.scale === 'number' && Number.isFinite(o.scale)
          ? clamp(o.scale, .65, 1.6) : def.scale,
      };
    };
    return { joystick: restore('joystick'), diamond: restore('diamond') };
  }

  private save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.placements)); }
    catch { /* Storage can be blocked without affecting play. */ }
  }

  private apply(name: ControlName): void {
    const el = this.elements[name];
    const rect = this.frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const p = this.placements[name];
    const scaledHalfWidth = el.offsetWidth * p.scale / 2 + 7;
    const scaledHalfHeight = el.offsetHeight * p.scale / 2 + 7;
    const marginX = Math.min(.5, scaledHalfWidth / rect.width);
    const marginY = Math.min(.5, scaledHalfHeight / rect.height);
    p.x = clamp(p.x, marginX, 1 - marginX);
    p.y = clamp(p.y, marginY, 1 - marginY);
    el.style.left = (p.x * 100).toFixed(3) + '%';
    el.style.top = (p.y * 100).toFixed(3) + '%';
    el.style.setProperty('--control-scale', String(p.scale));
    this.ranges[name].value = String(Math.round(p.scale * 100));
    this.values[name].textContent = Math.round(p.scale * 100) + '%';
  }

  sync(): void {
    this.apply('joystick');
    this.apply('diamond');
  }

  start(): void {
    if (this.isEditing) return;
    this.isEditing = true;
    this.editor.hidden = false;
    this.touchControls.classList.add('layout-editing');
    this.sync();
    document.querySelector<HTMLButtonElement>('#btn-layout-done')?.focus({ preventScroll: true });
  }

  stop(): void {
    if (!this.isEditing) return;
    this.isEditing = false;
    this.drag = null;
    for (const el of Object.values(this.elements)) el.classList.remove('dragging');
    this.touchControls.classList.remove('layout-editing');
    this.editor.hidden = true;
    this.save();
  }

  reset(): void {
    this.placements = {
      joystick: { ...DEFAULTS.joystick },
      diamond: { ...DEFAULTS.diamond },
    };
    this.sync();
    this.save();
  }
}
