import { STAGES, type StageId } from '../stages/Stages';

/** Fullscreen stage carousel. A single live DOM illustration per arena is
 * transformed into the center or dimmed side preview, without extra assets.
 */
export class StageSelector {
  private root: HTMLElement;
  private carousel: HTMLElement;
  private roster: HTMLElement;
  private confirmButton: HTMLButtonElement;
  private backButton: HTMLButtonElement;
  private currentName: HTMLElement;
  private currentDescription: HTMLElement;
  private counter: HTMLElement;
  private index = 0;
  private drag: { id: number; x: number; y: number; target: StageId | null } | null = null;
  private suppressClickUntil = 0;

  constructor(
    private readonly onConfirm: (id: StageId) => void,
    private readonly onBack: () => void,
  ) {
    const get = <T extends HTMLElement>(selector: string): T => {
      const el = document.querySelector<T>(selector);
      if (!el) throw new Error('Missing fullscreen arena selector: ' + selector);
      return el;
    };
    this.root=get('#arena-select');
    this.carousel=get('#arena-carousel');
    this.roster=get('#stage-roster');
    this.confirmButton=get('#btn-stage-confirm');
    this.backButton=get('#btn-stage-back');
    this.currentName=get('#stage-active-name');
    this.currentDescription=get('#stage-active-description');
    this.counter=get('#stage-counter');

    STAGES.forEach(stage => {
      const button=document.createElement('button');
      button.type='button';
      button.className='stage-slide';
      button.dataset.stage=stage.id;
      button.setAttribute('aria-label', 'Арена ' + stage.name);
      button.innerHTML=`<span class="stage-art stage-art-${stage.theme}" aria-hidden="true">
        <span class="stage-art-stars"></span>
        <span class="stage-art-moon"></span>
        <span class="stage-art-backdrop"></span>
        <span class="stage-art-buildings"></span>
        <span class="stage-art-ground"></span>
        <span class="stage-art-glimmer"></span>
        <span class="stage-art-title">${stage.name}</span>
      </span>`;
      button.addEventListener('click',()=>{
        if(performance.now()<this.suppressClickUntil) return;
        const target=STAGES.findIndex(s=>s.id===stage.id);
        if(target !== this.index){
          this.index=target;
          this.paint();
        } else this.confirm();
      });
      this.roster.append(button);
    });
    this.confirmButton.addEventListener('click',()=>this.confirm());
    this.backButton.addEventListener('click',()=>this.goBack());

    this.carousel.addEventListener('pointerdown',event=>{
      if(!this.isOpen || !event.isPrimary) return;
      const target=(event.target as Element).closest<HTMLButtonElement>('.stage-slide');
      this.drag={
        id:event.pointerId,x:event.clientX,y:event.clientY,
        target:target?.dataset.stage as StageId | undefined ?? null,
      };
      if(event.pointerType==='touch')this.carousel.setPointerCapture(event.pointerId);
    });
    this.carousel.addEventListener('pointerup',event=>{
      if(!this.drag || this.drag.id!==event.pointerId) return;
      const dx=event.clientX-this.drag.x;
      const dy=event.clientY-this.drag.y;
      const tapped=this.drag.target;
      this.drag=null;
      if(Math.abs(dx)>42 && Math.abs(dx)>Math.abs(dy)*1.15){
        this.suppressClickUntil=performance.now()+350;
        this.navigate(dx<0?1:-1);
        event.preventDefault();
      } else if(event.pointerType==='touch' && tapped){
        this.suppressClickUntil=performance.now()+350;
        const index=STAGES.findIndex(stage=>stage.id===tapped);
        if(index===this.index) this.confirm();
        else if(index>=0){ this.index=index; this.paint(); }
      }
    });
    this.carousel.addEventListener('pointercancel',()=>{this.drag=null;});
    this.carousel.addEventListener('click',event=>{
      if(performance.now()<this.suppressClickUntil){
        event.preventDefault();
        event.stopPropagation();
      }
    },true);
    this.paint();
  }

  show(preselect: StageId | null): void {
    const found=STAGES.findIndex(stage=>stage.id===preselect);
    this.index=found<0?0:found;
    this.root.hidden=false;
    this.drag=null;
    this.suppressClickUntil=0;
    this.paint();
    this.carousel.focus({preventScroll:true});
  }
  hide():void { this.root.hidden=true;this.drag=null; }
  get isOpen():boolean { return !this.root.hidden; }
  goBack():void { if(this.isOpen)this.onBack(); }

  navigate(direction:-1|1):void {
    if(!this.isOpen || STAGES.length<2) return;
    this.index=(this.index+STAGES.length+direction)%STAGES.length;
    this.paint();
  }
  confirm():void {
    if(!this.isOpen)return;
    const stage=STAGES[this.index];
    if(stage)this.onConfirm(stage.id);
  }

  private paint():void {
    const stage=STAGES[this.index];
    this.currentName.textContent=stage?.name??'';
    this.currentDescription.textContent=stage?.description??'';
    this.counter.textContent=(this.index+1)+' / '+STAGES.length;
    this.confirmButton.disabled=!stage;
    this.root.style.setProperty('--active-stage',stage?.id==='lagoon'?'#8fe4da':'#efa4db');
    for(const button of this.roster.querySelectorAll<HTMLButtonElement>('.stage-slide')){
      const i=STAGES.findIndex(s=>s.id===button.dataset.stage);
      // With only two stages, there is one secondary preview. CSS puts it
      // behind the center, with a consistent animation when navigating.
      let slot='hidden';
      if(i===this.index)slot='center';
      else if(STAGES.length===2)slot=this.index===0?'right':'left';
      else {
        const relative=(i-this.index+STAGES.length)%STAGES.length;
        slot=relative===1?'right':relative===STAGES.length-1?'left':'hidden';
      }
      button.dataset.slot=slot;
      button.tabIndex=-1;
      button.setAttribute('aria-hidden',String(slot==='hidden'));
      button.setAttribute('aria-pressed',String(slot==='center'));
    }
  }
}
