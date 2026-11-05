import type { FighterId } from '../combat/Fighter';
import { CHARACTERS, getCharacter, portraitSvg } from '../characters/Roster';

export type MatchMode = 'cpu' | 'versus';

/**
 * Data-driven character selector. PvP prohibits mirrors, and CPU chooses
 * uniformly from all available roster characters other than player 1.
 */
export class CharacterSelector {
  private root: HTMLElement;
  private roster: HTMLElement;
  private instructions: HTMLElement;
  private lineup: HTMLElement;
  private startButton: HTMLButtonElement;
  private backButton: HTMLButtonElement;
  private cpuButton: HTMLButtonElement;
  private versusButton: HTMLButtonElement;
  private resetButton: HTMLButtonElement;
  private mode: MatchMode = 'cpu';
  private p1: FighterId | null = null;
  private p2: FighterId | null = null;
  private allowBack = false;

  constructor(
    private readonly onStart: (p1: FighterId, p2: FighterId, mode: MatchMode) => void,
    private readonly onBack: () => void,
  ) {
    const get = <T extends HTMLElement>(selector: string): T => {
      const el = document.querySelector<T>(selector);
      if (!el) throw new Error('Character selector is missing ' + selector);
      return el;
    };
    this.root = get('#character-select');
    this.roster = get('#select-roster');
    this.instructions = get('#select-instructions');
    this.lineup = get('#select-lineup');
    this.startButton = get('#btn-select-fight');
    this.backButton = get('#btn-select-back');
    this.cpuButton = get('#btn-select-cpu');
    this.versusButton = get('#btn-select-versus');
    this.resetButton = get('#btn-select-reset');

    for (const character of CHARACTERS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-card';
      button.dataset.character = character.id;
      button.style.setProperty('--character-accent', character.color);
      button.innerHTML = `<span class="character-card-portrait">${portraitSvg(character.id)}</span>
        <span class="character-card-info"><strong>${character.name}</strong>
        <small>${character.title}</small></span>
        <span class="character-card-marker" aria-hidden="true">◇</span>`;
      button.addEventListener('click', () => this.select(character.id));
      this.roster.append(button);
    }
    this.cpuButton.addEventListener('click', () => this.switchMode('cpu'));
    this.versusButton.addEventListener('click', () => this.switchMode('versus'));
    this.resetButton.addEventListener('click', () => {
      this.p1 = null; this.p2 = null; this.paint();
    });
    this.backButton.addEventListener('click', () => { if (this.allowBack) this.onBack(); });
    this.startButton.addEventListener('click', () => this.start());
    this.paint();
  }

  show(mode: MatchMode, allowBack: boolean): void {
    this.mode = mode;
    this.p1 = null;
    this.p2 = null;
    this.allowBack = allowBack;
    this.root.hidden = false;
    this.paint();
    this.cpuButton.focus({ preventScroll: true });
  }

  hide(): void {
    this.root.hidden = true;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  get canGoBack(): boolean {
    return this.allowBack;
  }

  goBack(): void {
    if (this.allowBack) this.onBack();
  }

  private switchMode(mode: MatchMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.p2 = null;
    this.paint();
  }

  private select(id: FighterId): void {
    if (this.p1 === null) {
      this.p1 = id;
    } else if (this.mode === 'cpu') {
      this.p1 = id;
    } else if (id !== this.p1) {
      this.p2 = id;
    }
    this.paint();
  }

  private paint(): void {
    const versus = this.mode === 'versus';
    this.cpuButton.classList.toggle('selected', !versus);
    this.versusButton.classList.toggle('selected', versus);
    this.cpuButton.setAttribute('aria-pressed', String(!versus));
    this.versusButton.setAttribute('aria-pressed', String(versus));
    this.backButton.hidden = !this.allowBack;

    this.instructions.textContent = this.p1 === null
      ? 'Гравець 1: обери свого бійця.'
      : versus && this.p2 === null
        ? 'Гравець 2: обери іншого персонажа.'
        : versus
          ? 'Обох бійців обрано. Можна починати!'
          : 'Суперник CPU буде обраний випадково з решти персонажів.';

    for (const button of this.roster.querySelectorAll<HTMLButtonElement>('.character-card')) {
      const id = button.dataset.character as FighterId;
      const pickedByP1 = this.p1 === id;
      const pickedByP2 = versus && this.p2 === id;
      button.classList.toggle('chosen-p1', pickedByP1);
      button.classList.toggle('chosen-p2', Boolean(pickedByP2));
      // Player 2 cannot choose player 1's character.
      button.disabled = Boolean(versus && pickedByP1 && this.p2 === null);
      const marker = button.querySelector<HTMLElement>('.character-card-marker');
      if (marker) marker.textContent = pickedByP1 ? 'P1 ✓' : pickedByP2 ? 'P2 ✓' : '◇';
      button.setAttribute('aria-pressed', String(pickedByP1 || pickedByP2));
    }
    const p1 = this.p1 ? getCharacter(this.p1).name : '???';
    const p2 = versus ? (this.p2 ? getCharacter(this.p2).name : '???') : '🎲 CPU';
    this.lineup.textContent = 'P1: ' + p1 + '  VS  ' + (versus ? 'P2: ' : '') + p2;
    const eligible = this.p1 ? CHARACTERS.filter(x => x.id !== this.p1).length : 0;
    this.startButton.disabled = !this.p1 || (versus ? !this.p2 : eligible === 0);
    this.startButton.textContent = versus ? '🥊 Почати PvP' : '⚡ Знайти суперника і битися';
    this.resetButton.disabled = this.p1 === null;
  }

  private start(): void {
    if (!this.p1 || this.startButton.disabled) return;
    let second: FighterId;
    if (this.mode === 'versus') {
      if (!this.p2 || this.p2 === this.p1) return;
      second = this.p2;
    } else {
      const candidates = CHARACTERS.filter(item => item.id !== this.p1);
      if (candidates.length === 0) return;
      const index = Math.floor(Math.random() * candidates.length);
      second = candidates[index].id;
    }
    this.onStart(this.p1, second, this.mode);
  }
}
