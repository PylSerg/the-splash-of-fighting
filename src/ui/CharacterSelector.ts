import type { FighterId } from '../combat/Fighter';
import { CHARACTERS, getCharacter } from '../characters/Roster';
import { characterFigureSvg } from '../characters/Figures';

export type MatchMode = 'cpu' | 'versus';

/**
 * A single, full-viewport animated carousel: each fighter has ONE full-body
 * SVG element which is moved/scaled/dimmed instead of duplicate image assets.
 */
export class CharacterSelector {
  private root: HTMLElement;
  private carousel: HTMLElement;
  private roster: HTMLElement;
  private instructions: HTMLElement;
  private lineup: HTMLElement;
  private currentName: HTMLElement;
  private currentTitle: HTMLElement;
  private counter: HTMLElement;
  private startButton: HTMLButtonElement;
  private backButton: HTMLButtonElement;
  private cpuButton: HTMLButtonElement;
  private versusButton: HTMLButtonElement;
  private resetButton: HTMLButtonElement;
  private mode: MatchMode = 'cpu';
  private p1: FighterId | null = null;
  private phase: 1 | 2 = 1;
  private index = 0;
  private allowBack = true;
  private backLabel = '← Назад';
  private previousCpuPair: { first: FighterId; second: FighterId } | null = null;
  private previousPair: { first: FighterId; second: FighterId } | null = null;
  private touch: { id: number; x: number; y: number } | null = null;
  private ignoreClickUntil = 0;

  constructor(
    private readonly onStart: (p1: FighterId, p2: FighterId, mode: MatchMode) => void,
    private readonly onBack: () => void,
  ) {
    const get = <T extends HTMLElement>(selector: string): T => {
      const el = document.querySelector<T>(selector);
      if (!el) throw new Error('Character carousel is missing ' + selector);
      return el;
    };
    this.root = get('#character-select');
    this.carousel = get('#select-carousel');
    this.roster = get('#select-roster');
    this.instructions = get('#select-instructions');
    this.lineup = get('#select-lineup');
    this.currentName = get('#select-active-name');
    this.currentTitle = get('#select-active-title');
    this.counter = get('#select-counter');
    this.startButton = get('#btn-select-fight');
    this.backButton = get('#btn-select-back');
    this.cpuButton = get('#btn-select-cpu');
    this.versusButton = get('#btn-select-versus');
    this.resetButton = get('#btn-select-reset');

    CHARACTERS.forEach(character => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fighter-slide';
      button.dataset.character = character.id;
      button.style.setProperty('--fighter-accent', character.color);
      button.style.setProperty('--fighter-glow', character.glow);
      button.setAttribute('aria-label', 'Персонаж ' + character.name);
      button.innerHTML = `<span class="fighter-glow" aria-hidden="true"></span>
        <span class="fighter-figure">${characterFigureSvg(character.id)}</span>
        <span class="fighter-ground" aria-hidden="true"></span>
        <span class="fighter-taken" aria-hidden="true">ВЖЕ ОБРАНО P1</span>`;
      button.addEventListener('click', () => {
        if (performance.now() < this.ignoreClickUntil) return;
        const target = CHARACTERS.findIndex(item => item.id === character.id);
        if (target !== this.index) {
          this.index = target;
          this.paint();
        } else {
          this.confirmCurrent();
        }
      });
      this.roster.append(button);
    });

    get<HTMLButtonElement>('#btn-fighter-prev').addEventListener('click', () => this.navigate(-1));
    get<HTMLButtonElement>('#btn-fighter-next').addEventListener('click', () => this.navigate(1));
    this.cpuButton.addEventListener('click', () => this.switchMode('cpu'));
    this.versusButton.addEventListener('click', () => this.switchMode('versus'));
    this.resetButton.addEventListener('click', () => this.reset());
    this.backButton.addEventListener('click', () => this.goBack());
    this.startButton.addEventListener('click', () => this.confirmCurrent());

    this.carousel.addEventListener('pointerdown', event => {
      if (!this.isOpen || !event.isPrimary) return;
      this.touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
      if (event.pointerType === 'touch') {
        this.carousel.setPointerCapture(event.pointerId);
      }
    });
    this.carousel.addEventListener('pointerup', event => {
      if (!this.touch || this.touch.id !== event.pointerId) return;
      const dx = event.clientX - this.touch.x;
      const dy = event.clientY - this.touch.y;
      this.touch = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        this.ignoreClickUntil = performance.now() + 350;
        this.navigate(dx < 0 ? 1 : -1);
        event.preventDefault();
      }
    });
    this.carousel.addEventListener('pointercancel', () => { this.touch = null; });
    this.carousel.addEventListener('click', event => {
      if (performance.now() < this.ignoreClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    this.paint();
  }

  show(
    mode: MatchMode,
    allowBack: boolean,
    previous?: { first: FighterId; second: FighterId },
  ): void {
    this.mode = mode;
    this.p1 = null;
    this.phase = 1;
    this.previousPair = previous ?? null;
    this.previousCpuPair = previous && mode === 'cpu' ? previous : null;
    this.index = Math.max(0, CHARACTERS.findIndex(c => c.id === previous?.first));
    this.allowBack = allowBack;
    this.backLabel = this.backButton.textContent || '← Назад';
    this.root.hidden = false;
    this.touch = null;
    this.ignoreClickUntil = 0;
    this.paint();
    this.carousel.focus({ preventScroll: true });
  }

  hide(): void {
    this.root.hidden = true;
    this.touch = null;
  }
  get isOpen(): boolean { return !this.root.hidden; }
  get canGoBack(): boolean { return this.allowBack; }

  navigate(direction: -1 | 1): void {
    if (!this.isOpen || CHARACTERS.length <= 1) return;
    this.index = (this.index + CHARACTERS.length + direction) % CHARACTERS.length;
    this.paint();
  }

  confirmCurrent(): void {
    if (!this.isOpen) return;
    const id = CHARACTERS[this.index]?.id;
    if (!id) return;
    if (this.phase === 1) {
      if (this.mode === 'cpu') {
        const candidates = CHARACTERS.filter(c => c.id !== id);
        if (!candidates.length) return;
        const samePick = this.previousCpuPair?.first === id;
        const previousOpponent = this.previousCpuPair?.second;
        const second = samePick && previousOpponent &&
          candidates.some(c => c.id === previousOpponent)
          ? previousOpponent
          : candidates[Math.floor(Math.random() * candidates.length)].id;
        this.onStart(id, second, this.mode);
      } else {
        if (CHARACTERS.length < 2) return;
        this.p1 = id;
        this.phase = 2;
        const desired = this.previousPair?.first === id
          ? this.previousPair.second : null;
        const next = CHARACTERS.findIndex(c => c.id === desired);
        this.index = next >= 0 && desired !== id
          ? next : (this.index + 1) % CHARACTERS.length;
        this.paint();
      }
    } else {
      if (!this.p1 || this.p1 === id) return;
      this.onStart(this.p1, id, this.mode);
    }
  }

  goBack(): void {
    if (!this.isOpen) return;
    if (this.phase === 2) {
      const prior = this.p1;
      this.phase = 1;
      this.p1 = null;
      const found = CHARACTERS.findIndex(c => c.id === prior);
      this.index = found < 0 ? 0 : found;
      this.paint();
      return;
    }
    if (this.allowBack) this.onBack();
  }

  private switchMode(mode: MatchMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.phase = 1;
    this.p1 = null;
    this.previousCpuPair = mode === 'cpu' ? this.previousPair : null;
    this.paint();
  }

  private reset(): void {
    this.phase = 1;
    this.p1 = null;
    this.paint();
  }

  private paint(): void {
    const versus = this.mode === 'versus';
    this.cpuButton.classList.toggle('selected', !versus);
    this.versusButton.classList.toggle('selected', versus);
    this.cpuButton.setAttribute('aria-pressed', String(!versus));
    this.versusButton.setAttribute('aria-pressed', String(versus));

    this.backButton.hidden = !this.allowBack;
    this.backButton.textContent = this.phase === 2 ? '← До гравця 1' : this.backLabel;
    this.instructions.textContent = this.phase === 2
      ? 'ГРАВЕЦЬ 2 · Обери іншого бійця'
      : versus
        ? 'ГРАВЕЦЬ 1 · Обери свого бійця'
        : 'ОБЕРИ БІЙЦЯ · Суперник CPU визначиться випадково';
    const current = CHARACTERS[this.index];
    if (current) {
      this.currentName.textContent = current.name;
      this.currentTitle.textContent = current.title;
    }
    this.counter.textContent = (this.index + 1) + ' / ' + CHARACTERS.length;
    this.lineup.textContent = this.phase === 2 && this.p1
      ? 'P1: ' + getCharacter(this.p1).name + '   •   P2: ?'
      : versus ? 'P1 → P2 · по черзі' : 'P1 + випадковий CPU';

    for (const item of this.roster.querySelectorAll<HTMLButtonElement>('.fighter-slide')) {
      const i = CHARACTERS.findIndex(c => c.id === item.dataset.character);
      const relative = (i - this.index + CHARACTERS.length) % CHARACTERS.length;
      const slot = relative === 0 ? 'center' : relative === 1 ? 'right'
        : relative === CHARACTERS.length - 1 ? 'left' : 'hidden';
      item.dataset.slot = slot;
      item.classList.toggle('fighter-locked', this.phase === 2 && item.dataset.character === this.p1);
      item.tabIndex = -1;
      item.setAttribute('aria-hidden', String(slot === 'hidden'));
      item.setAttribute('aria-pressed', String(slot === 'center'));
    }

    const invalid = this.phase === 2 && current?.id === this.p1;
    this.startButton.disabled = !current || Boolean(invalid);
    this.startButton.textContent = this.phase === 2
      ? '✓ Обрати для P2'
      : versus ? '✓ Обрати для P1' : '✓ Обрати бійця';
    this.resetButton.disabled = this.phase === 1 && this.p1 === null;
    this.root.style.setProperty('--active-color', current?.color ?? '#e1a1ce');
    this.root.style.setProperty('--active-glow', current?.glow ?? '#b9d0fc');
  }
}
