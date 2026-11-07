import type { FighterId } from '../combat/Fighter';
import { CHARACTERS, getCharacter, portraitSvg } from '../characters/Roster';
import { characterFigureSvg } from '../characters/Figures';

export type MatchMode = 'cpu' | 'versus';
type Player = 0 | 1;
type SwipeStart = { id: number; x: number; y: number; target: FighterId | null };

/**
 * Two independent fullscreen carousel halves.
 *
 * A focused character is reserved immediately. The OTHER side's list is
 * recomputed on every change, making mirror selections impossible even while
 * two touch pointers (one in each zone) move at the same time.
 */
export class CharacterSelector {
  private root: HTMLElement;
  private areas: [HTMLElement, HTMLElement];
  private rosters: [HTMLElement, HTMLElement];
  private names: [HTMLElement, HTMLElement];
  private titles: [HTMLElement, HTMLElement];
  private counts: [HTMLElement, HTMLElement];
  private readyButtons: [HTMLButtonElement, HTMLButtonElement];
  private randomButton: HTMLButtonElement;
  private secondLabel: HTMLElement;
  private instructions: HTMLElement;
  private lineup: HTMLElement;
  private startButton: HTMLButtonElement;
  private backButton: HTMLButtonElement;
  private cpuButton: HTMLButtonElement;
  private versusButton: HTMLButtonElement;
  private resetButton: HTMLButtonElement;
  private bioOverlay: HTMLElement;
  private bioPortrait: HTMLElement;
  private bioName: HTMLElement;
  private bioTitle: HTMLElement;
  private bioStory: HTMLElement;
  private bioWeapon: HTMLElement;
  private bioStyle: HTMLElement;
  private bioClose: HTMLButtonElement;
  private bioReturn: HTMLButtonElement;
  private bioPreviousFocus: HTMLElement | null = null;
  private mode: MatchMode = 'cpu';
  private training=false;
  private picks: [FighterId, FighterId];
  private ready: [boolean, boolean] = [false, false];
  private allowBack = true;
  private swipe: [SwipeStart | null, SwipeStart | null] = [null, null];
  private suppressClicks: [number, number] = [0, 0];

  constructor(
    private readonly onStart: (p1: FighterId, p2: FighterId, mode: MatchMode) => void,
    private readonly onBack: () => void,
  ) {
    const get = <T extends HTMLElement>(selector: string): T => {
      const el = document.querySelector<T>(selector);
      if (!el) throw new Error('Dual character select missing: ' + selector);
      return el;
    };
    this.root = get('#character-select');
    this.areas = [get('#select-zone-p1'), get('#select-zone-p2')];
    this.rosters = [get('#select-roster-p1'), get('#select-roster-p2')];
    this.names = [get('#select-name-p1'), get('#select-name-p2')];
    this.titles = [get('#select-title-p1'), get('#select-title-p2')];
    this.counts = [get('#select-counter-p1'), get('#select-counter-p2')];
    this.readyButtons = [get('#btn-select-ready-p1'), get('#btn-select-ready-p2')];
    this.randomButton = get('#btn-select-random');
    this.secondLabel = get('#select-side-two-label');
    this.instructions = get('#select-instructions');
    this.lineup = get('#select-lineup');
    this.startButton = get('#btn-select-fight');
    this.backButton = get('#btn-select-back');
    this.cpuButton = get('#btn-select-cpu');
    this.versusButton = get('#btn-select-versus');
    this.resetButton = get('#btn-select-reset');
    this.bioOverlay = get('#fighter-bio-dialog');
    this.bioPortrait = get('#fighter-bio-portrait');
    this.bioName = get('#fighter-bio-name');
    this.bioTitle = get('#fighter-bio-title');
    this.bioStory = get('#fighter-bio-story');
    this.bioWeapon = get('#fighter-bio-weapon');
    this.bioStyle = get('#fighter-bio-style');
    this.bioClose = get('#fighter-bio-close');
    this.bioReturn = get('#fighter-bio-return');
    this.bioClose.addEventListener('click', () => this.closeBio());
    this.bioReturn.addEventListener('click', () => this.closeBio());
    this.bioOverlay.addEventListener('click', event => {
      if (event.target === this.bioOverlay) this.closeBio();
    });
    this.bioOverlay.addEventListener('keydown', event => {
      // Keep keyboard Tab focus inside the biography panel.
      if (event.key !== 'Tab') return;
      if (event.shiftKey && document.activeElement === this.bioClose) {
        event.preventDefault(); this.bioReturn.focus();
      } else if (!event.shiftKey && document.activeElement === this.bioReturn) {
        event.preventDefault(); this.bioClose.focus();
      }
    });

    const first = CHARACTERS[0]?.id;
    const second = CHARACTERS[1]?.id;
    if (!first || !second) throw new Error('A battle requires two fighters.');
    this.picks = [first, second];

    for (const p of [0, 1] as const) {
      const area = this.areas[p];
      for (const character of CHARACTERS) {
        // Each side renders its OWN selection from reusable character artwork.
        // It never needs duplicated light/dark image files for side previews.
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'fighter-slide';
        button.dataset.character = character.id;
        button.style.setProperty('--fighter-accent', character.color);
        button.style.setProperty('--fighter-glow', character.glow);
        button.setAttribute('aria-label', 'Персонаж ' + character.name);
        button.innerHTML = `<span class="fighter-glow" aria-hidden="true"></span>
          <span class="fighter-figure">${characterFigureSvg(character.id)}</span>
          <span class="fighter-ground" aria-hidden="true"></span>`;
        button.addEventListener('click', () => {
          if (performance.now() < this.suppressClicks[p]) return;
          if (this.picks[p] === character.id) this.inspectPlayer(p);
          else this.select(p, character.id);
        });
        this.rosters[p].append(button);
      }

      // Each half has its own pointer identity, intentionally no isPrimary
      // check. Two fingers can swipe BOTH player carousels simultaneously.
      area.addEventListener('pointerdown', event => {
        if (!this.isOpen || this.swipe[p]) return;
        const target = (event.target as Element).closest<HTMLButtonElement>('.fighter-slide');
        this.swipe[p] = {
          id: event.pointerId, x: event.clientX, y: event.clientY,
          target: target?.dataset.character as FighterId | undefined ?? null,
        };
        if (event.pointerType === 'touch') area.setPointerCapture(event.pointerId);
      });
      area.addEventListener('pointerup', event => {
        const start = this.swipe[p];
        if (!start || start.id !== event.pointerId) return;
        this.swipe[p] = null;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.13) {
          this.suppressClicks[p] = performance.now() + 350;
          this.navigate(p, dx < 0 ? 1 : -1);
          event.preventDefault();
        } else if (event.pointerType === 'touch' && start.target) {
          this.suppressClicks[p] = performance.now() + 350;
          if (this.picks[p] === start.target) this.inspectPlayer(p);
          else this.select(p, start.target);
        }
      });
      area.addEventListener('pointercancel', event => {
        if (this.swipe[p]?.id === event.pointerId) this.swipe[p] = null;
      });
      area.addEventListener('click', event => {
        if (performance.now() < this.suppressClicks[p]) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
      this.readyButtons[p].addEventListener('click', () => this.confirmPlayer(p));
    }
    this.cpuButton.addEventListener('click', () => this.switchMode('cpu'));
    this.versusButton.addEventListener('click', () => this.switchMode('versus'));
    this.randomButton.addEventListener('click', () => this.randomizeOpponent());
    this.resetButton.addEventListener('click', () => this.reset());
    this.backButton.addEventListener('click', () => this.goBack());
    this.startButton.addEventListener('click', () => this.confirmCurrent());
    this.paint();
  }

  show(
    mode: MatchMode,
    allowBack: boolean,
    previous?: { first: FighterId; second: FighterId },
    training=false,
  ): void {
    this.closeBio(false);
    this.training=training;
    this.mode = training?'cpu':mode;
    const valid = previous && previous.first !== previous.second &&
      CHARACTERS.some(c => c.id === previous.first) &&
      CHARACTERS.some(c => c.id === previous.second);
    this.picks = valid
      ? [previous.first, previous.second]
      : [CHARACTERS[0].id, CHARACTERS[1].id];
    this.ready = [false, false];
    this.allowBack = allowBack;
    this.swipe = [null, null];
    this.suppressClicks = [0, 0];
    this.root.hidden = false;
    this.paint();
    this.areas[0].focus({ preventScroll: true });
  }

  hide(): void {
    this.closeBio(false);
    this.root.hidden = true;
    this.swipe = [null, null];
  }
  get isOpen(): boolean { return !this.root.hidden; }
  get isBioOpen(): boolean { return !this.bioOverlay.hidden; }
  get canGoBack(): boolean { return this.allowBack; }
  goBack(): void {
    if (this.isBioOpen) { this.closeBio(); return; }
    if (this.isOpen && this.allowBack) this.onBack();
  }

  /** A tap on the current fighter never confirms a match. */
  inspectPlayer(player: Player): void {
    if (!this.isOpen || this.isBioOpen) return;
    const fighter = getCharacter(this.picks[player]);
    this.bioPreviousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement : this.areas[player];
    this.bioOverlay.style.setProperty('--bio-accent', fighter.color);
    this.bioPortrait.innerHTML = portraitSvg(fighter.id);
    this.bioName.textContent = fighter.name;
    this.bioTitle.textContent = fighter.title;
    this.bioStory.textContent = fighter.bio ?? 'Історія незабаром з’явиться.';
    this.bioWeapon.textContent = fighter.weapon ?? 'Не визначена';
    this.bioStyle.textContent = fighter.style ?? fighter.title;
    this.root.inert = true;
    this.bioOverlay.hidden = false;
    this.bioClose.focus({ preventScroll: true });
  }

  closeBio(restoreFocus=true): void {
    if (!this.isBioOpen) return;
    this.bioOverlay.hidden = true;
    this.root.inert = false;
    const previousFocus = this.bioPreviousFocus;
    this.bioPreviousFocus = null;
    if (restoreFocus && previousFocus?.isConnected) {
      previousFocus.focus({ preventScroll: true });
    }
  }

  /** The list is always derived from the opponent's current reservation. */
  private available(player: Player): FighterId[] {
    return CHARACTERS.filter(c => c.id !== this.picks[player === 0 ? 1 : 0])
      .map(c => c.id);
  }

  navigate(player: Player, direction: -1 | 1): void {
    if (!this.isOpen || this.isBioOpen || (this.mode === 'versus' && this.ready[player])) return;
    const choices = this.available(player);
    if (choices.length < 2) return;
    const current = choices.indexOf(this.picks[player]);
    const index = (current + choices.length + direction) % choices.length;
    this.select(player, choices[index]);
  }

  /** Both choices are exclusive already before either player presses Ready. */
  private select(player: Player, id: FighterId): void {
    if (!this.isOpen || this.isBioOpen || (this.mode === 'versus' && this.ready[player])) return;
    if (!this.available(player).includes(id) || this.picks[player] === id) return;
    this.picks[player] = id;
    this.ready[player] = false;
    this.paint(); // Recalculate BOTH lists immediately, not just this half.
  }

  confirmPlayer(player: Player): void {
    if (!this.isOpen || this.isBioOpen) return;
    if (this.mode === 'versus') {
      this.ready[player] = !this.ready[player];
      this.paint();
    } else {
      this.inspectPlayer(player);
    }
  }

  /** CPU selection can be swiped manually or rerolled with one touch. */
  randomizeOpponent(): void {
    if (!this.isOpen || this.isBioOpen || this.mode !== 'cpu') return;
    const candidates = this.available(1);
    if (!candidates.length) return;
    // Uniform random draw from every legal opponent (including the current).
    this.picks[1] = candidates[Math.floor(Math.random() * candidates.length)];
    this.paint();
  }

  confirmCurrent(): void {
    if (!this.isOpen || this.isBioOpen) return;
    if (this.mode === 'versus' && (!this.ready[0] || !this.ready[1])) return;
    const [first, second] = this.picks;
    if (first === second) return;
    this.onStart(first, second, this.mode);
  }

  private switchMode(mode: MatchMode): void {
    if (this.isBioOpen || this.training || this.mode === mode) return;
    this.mode = mode;
    this.ready = [false, false];
    this.paint();
  }

  private reset(): void {
    if (this.isBioOpen) return;
    this.ready = [false, false];
    this.picks = [CHARACTERS[0].id, CHARACTERS[1].id];
    this.paint();
  }

  private paint(): void {
    const versus = this.mode === 'versus';
    this.versusButton.hidden=this.training;
    this.cpuButton.textContent=this.training?'🎯 Тренування':'⚡ CPU';
    this.cpuButton.classList.toggle('selected', !versus);
    this.versusButton.classList.toggle('selected', versus);
    this.cpuButton.setAttribute('aria-pressed', String(!versus));
    this.versusButton.setAttribute('aria-pressed', String(versus));
    this.backButton.hidden = !this.allowBack;
    this.secondLabel.textContent = versus ? 'P2 · ГРАВЕЦЬ 2' :
      this.training?'🎯 ТРЕНУВАЛЬНИЙ СУПЕРНИК':'⚡ СУПЕРНИК CPU';
    this.instructions.textContent = this.training
      ? 'ТРЕНУВАННЯ · Два бійці · Нескінченне здоров’я · Поведінка CPU в меню бою'
      : versus
        ? 'PvP · Свайп для вибору · Торкнись бійця для історії · Підтверди готовність'
        : 'CPU · Свайп для вибору · Торкнись бійця для історії · Далі: арена';

    this.randomButton.hidden = versus;
    for (const p of [0, 1] as const) {
      const character = getCharacter(this.picks[p]);
      const choices = this.available(p);
      this.names[p].textContent = character.name;
      this.titles[p].textContent = character.title;
      this.counts[p].textContent = choices.length + ' доступні';
      this.areas[p].style.setProperty('--active-color', character.color);
      this.areas[p].style.setProperty('--active-glow', character.glow);
      this.readyButtons[p].hidden = !versus;
      this.readyButtons[p].classList.toggle('is-ready', this.ready[p]);
      this.readyButtons[p].textContent = this.ready[p]
        ? '✓ P' + (p + 1) + ' готовий · змінити'
        : '✓ Готово P' + (p + 1);

      for (const item of this.rosters[p].querySelectorAll<HTMLButtonElement>('.fighter-slide')) {
        const id = item.dataset.character as FighterId;
        const currentIndex = choices.indexOf(this.picks[p]);
        const i = choices.indexOf(id);
        let slot = 'hidden';
        if (i >= 0) {
          if (id === this.picks[p]) slot = 'center';
          else if (choices.length === 2) slot = p === 0 ? 'left' : 'right';
          else {
            const relative = (i - currentIndex + choices.length) % choices.length;
            slot = relative === 1 ? 'right' : relative === choices.length - 1
              ? 'left' : 'hidden';
          }
        }
        item.dataset.slot = slot;
        item.disabled = i < 0 || (versus && this.ready[p]);
        item.tabIndex = -1;
        item.setAttribute('aria-hidden', String(slot === 'hidden'));
        item.setAttribute('aria-pressed', String(slot === 'center'));
        item.setAttribute('aria-label', 'Персонаж ' + getCharacter(id).name +
          (slot === 'center' ? '. Натисни, щоб прочитати історію.' :
            '. Натисни, щоб вибрати.'));
      }
    }

    const [a,b] = this.picks;
    this.lineup.textContent = 'P1: ' + getCharacter(a).name + '  ⚔  ' +
      (versus ? 'P2: ' : this.training?'ТРЕНЕР: ':'CPU: ') + getCharacter(b).name;
    this.startButton.disabled = a === b || (versus && !this.ready.every(Boolean));
    this.startButton.textContent = versus ? '🥊 Далі: арена' : '✓ Далі: арена';
  }
}
