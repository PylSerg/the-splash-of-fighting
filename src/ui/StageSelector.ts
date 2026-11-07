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
  private loreButton: HTMLButtonElement;
  private loreOverlay: HTMLElement;
  private loreArt: HTMLElement;
  private loreName: HTMLElement;
  private loreSubtitle: HTMLElement;
  private loreStory: HTMLElement;
  private loreAtmosphere: HTMLElement;
  private loreLandmark: HTMLElement;
  private loreClose: HTMLButtonElement;
  private loreReturn: HTMLButtonElement;
  private lorePreviousFocus: HTMLElement | null = null;
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
    this.loreButton=get('#btn-stage-lore');
    this.loreOverlay=get('#stage-lore-dialog');
    this.loreArt=get('#stage-lore-art');
    this.loreName=get('#stage-lore-name');
    this.loreSubtitle=get('#stage-lore-title');
    this.loreStory=get('#stage-lore-story');
    this.loreAtmosphere=get('#stage-lore-atmosphere');
    this.loreLandmark=get('#stage-lore-landmark');
    this.loreClose=get('#stage-lore-close');
    this.loreReturn=get('#stage-lore-return');
    this.loreButton.addEventListener('click',()=>this.inspect());
    this.loreClose.addEventListener('click',()=>this.closeLore());
    this.loreReturn.addEventListener('click',()=>this.closeLore());
    this.loreOverlay.addEventListener('click',event=>{
      if(event.target===this.loreOverlay)this.closeLore();
    });
    this.loreOverlay.addEventListener('keydown',event=>{
      // Match the fighter biography: keyboard focus stays inside the lore.
      if(event.key!=='Tab')return;
      if(event.shiftKey && document.activeElement===this.loreClose){
        event.preventDefault();this.loreReturn.focus();
      }else if(!event.shiftKey && document.activeElement===this.loreReturn){
        event.preventDefault();this.loreClose.focus();
      }
    });

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
        } else this.inspect(); // Inspect the chosen stage, just like a fighter bio.
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
        if(index>=0 && index!==this.index){ this.index=index; this.paint(); }
        else if(index===this.index)this.inspect();
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
    this.closeLore(false);
    const found=STAGES.findIndex(stage=>stage.id===preselect);
    this.index=found<0?0:found;
    this.root.hidden=false;
    this.drag=null;
    this.suppressClickUntil=0;
    this.paint();
    this.carousel.focus({preventScroll:true});
  }
  hide():void { this.closeLore(false);this.root.hidden=true;this.drag=null; }
  get isOpen():boolean { return !this.root.hidden; }
  get isLoreOpen():boolean { return !this.loreOverlay.hidden; }
  goBack():void {
    if(this.isLoreOpen){this.closeLore();return;}
    if(this.isOpen)this.onBack();
  }

  /** Inspecting a selected stage opens the same style of panel as the
   * fighter's story. Closing never selects an arena or starts combat.
   */
  inspect():void {
    if(!this.isOpen || this.isLoreOpen)return;
    const stage=STAGES[this.index];
    if(!stage)return;
    this.lorePreviousFocus=document.activeElement instanceof HTMLElement
      ?document.activeElement:this.loreButton;
    this.loreOverlay.style.setProperty('--bio-accent',stage.id==='lagoon'?'#8fe4da':'#efa4db');
    this.loreName.textContent=stage.name;
    this.loreSubtitle.textContent=stage.description;
    this.loreStory.textContent=stage.story;
    this.loreAtmosphere.textContent=stage.atmosphere;
    this.loreLandmark.textContent=stage.landmark;
    const preview=this.roster.querySelector<HTMLButtonElement>(
      '.stage-slide[data-stage="'+stage.id+'"] .stage-art');
    this.loreArt.replaceChildren(
      preview?.cloneNode(true)??document.createElement('span'));
    this.root.inert=true;
    this.loreOverlay.hidden=false;
    this.loreClose.focus({preventScroll:true});
  }
  closeLore(restoreFocus=true):void {
    if(!this.isLoreOpen)return;
    this.loreOverlay.hidden=true;
    this.root.inert=false;
    const previous=this.lorePreviousFocus;
    this.lorePreviousFocus=null;
    if(restoreFocus && previous?.isConnected)
      previous.focus({preventScroll:true});
  }

  navigate(direction:-1|1):void {
    if(!this.isOpen || this.isLoreOpen || STAGES.length<2) return;
    this.index=(this.index+STAGES.length+direction)%STAGES.length;
    this.paint();
  }
  confirm():void {
    if(!this.isOpen || this.isLoreOpen)return;
    const stage=STAGES[this.index];
    if(stage)this.onConfirm(stage.id);
  }

  private paint():void {
    const stage=STAGES[this.index];
    this.currentName.textContent=stage?.name??'';
    this.currentDescription.textContent=stage?.description??'';
    this.counter.textContent=(this.index+1)+' / '+STAGES.length;
    this.confirmButton.disabled=!stage;
    this.loreButton.disabled=!stage;
    this.loreButton.setAttribute('aria-label','Прочитати історію арени '+(stage?.name??''));
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
      button.tabIndex=slot==='center'?0:-1;
      button.setAttribute('aria-label','Арена '+STAGES[i].name+
        (slot==='center'?'. Натисни ще раз, щоб прочитати історію.':'. Вибрати арену.'));
      button.setAttribute('aria-hidden',String(slot==='hidden'));
      button.setAttribute('aria-pressed',String(slot==='center'));
    }
  }
}
