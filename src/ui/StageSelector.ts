import { STAGES, type StageId } from '../stages/Stages';

export class StageSelector {
  private root: HTMLElement;
  private roster: HTMLElement;
  private confirm: HTMLButtonElement;
  private back: HTMLButtonElement;
  private choice: StageId | null = null;

  constructor(
    private readonly onConfirm: (id: StageId) => void,
    private readonly onBack: () => void,
  ) {
    const get = <T extends HTMLElement>(selector: string): T => {
      const el=document.querySelector<T>(selector);
      if(!el) throw new Error('Missing stage selector element: '+selector);
      return el;
    };
    this.root=get('#arena-select');
    this.roster=get('#stage-roster');
    this.confirm=get('#btn-stage-confirm');
    this.back=get('#btn-stage-back');
    const help=get('#stage-select-help');

    for(const stage of STAGES) {
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='stage-card';
      btn.dataset.stage=stage.id;
      btn.innerHTML=`<span class="stage-preview stage-preview-${stage.theme}" aria-hidden="true">
        <span class="stage-symbol">${stage.symbol}</span>
        <span class="stage-skyline"></span><span class="stage-horizon"></span>
      </span>
      <span class="stage-card-caption"><strong>${stage.name}</strong><small>${stage.description}</small></span>
      <span class="stage-choice-mark" aria-hidden="true">◇</span>`;
      btn.addEventListener('click',()=>{
        this.choice=stage.id;
        this.paint();
      });
      this.roster.append(btn);
    }
    this.confirm.addEventListener('click',()=>{
      if(this.choice) this.onConfirm(this.choice);
    });
    this.back.addEventListener('click',()=>this.onBack());
    help.textContent='Після вибору бійців обери місце наступного поєдинку.';
  }

  show(preselect: StageId | null): void {
    this.choice=preselect;
    this.root.hidden=false;
    this.paint();
    this.roster.querySelector<HTMLButtonElement>('.stage-card:not(:disabled)')?.focus({
      preventScroll:true,
    });
  }
  hide(): void { this.root.hidden=true; }
  get isOpen(): boolean { return !this.root.hidden; }
  goBack(): void { this.onBack(); }

  private paint(): void {
    for(const el of this.roster.querySelectorAll<HTMLButtonElement>('.stage-card')){
      const selected=el.dataset.stage===this.choice;
      el.classList.toggle('selected',selected);
      el.setAttribute('aria-pressed',String(selected));
      const mark=el.querySelector<HTMLElement>('.stage-choice-mark');
      if(mark) mark.textContent=selected?'✓':'◇';
    }
    this.confirm.disabled=!this.choice;
  }
}
