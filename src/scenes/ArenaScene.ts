import Phaser from 'phaser';
import { Controls, emptyInput, type InputState } from '../input/Controls';
import { Fighter, GROUND_Y, STAGE_MIN_X, STAGE_MAX_X, setStageViewportWidth } from '../combat/Fighter';

type GameMode = 'cpu' | 'versus';
interface Grapple {
  attacker: Fighter;
  defender: Fighter;
  phase: 'reach' | 'hold';
  elapsed: number;
}
// Slow, readable two-stage throw: reach first, then a counterable hold.
const GRAB_REACH_TIME = .32;
const GRAB_HOLD_TIME = .62;
const GRAB_MAX_START = 135;
const GRAB_CATCH_RANGE = 90;
const THROW_DAMAGE = 16;
const STEP = 1/60;
const ZERO = () => emptyInput();

function justPressed(current: InputState, previous: InputState): InputState {
  const next = emptyInput();
  for (const key of Object.keys(next) as (keyof InputState)[]) {
    next[key] = current[key] && !previous[key];
  }
  return next;
}
function overlap(a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}): boolean {
  return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
}

export class ArenaScene extends Phaser.Scene {
  private controls: Controls;
  private onStatus: (message: string) => void;
  private evi!: Fighter;
  private nara!: Fighter;
  private prev1 = ZERO();
  private prev2 = ZERO();
  private mode: GameMode = 'cpu';
  private debug = false;
  private hud!: Phaser.GameObjects.Graphics;
  private debugDraw!: Phaser.GameObjects.Graphics;
  private centerLabel!: Phaser.GameObjects.Text;
  private timeLabel!: Phaser.GameObjects.Text;
  private leftName!: Phaser.GameObjects.Text;
  private rightName!: Phaser.GameObjects.Text;
  private extraHalf = 0;
  private readyTime = 1.5;
  private roundTime = 99;
  private roundOver = false;
  private accumulator = 0;
  private aiCooldown = .85;
  private aiCount = 0;
  private frameCount = 0;
  private grapple: Grapple | null = null;

  constructor(controls: Controls, onStatus: (message: string) => void) {
    super({ key: 'Arena' });
    this.controls=controls;
    this.onStatus=onStatus;
  }

  create(): void {
    this.drawStage();
    this.evi = new Fighter(this,'evi',250,1);
    this.nara = new Fighter(this,'nara',710,-1);
    this.debugDraw = this.add.graphics().setDepth(12);
    this.hud = this.add.graphics().setDepth(20);
    const labelStyle = {fontFamily:'Rajdhani, Arial, sans-serif',fontSize:'27px',color:'#f7f4ff',fontStyle:'bold',stroke:'#12132d',strokeThickness:4};
    this.leftName = this.add.text(39,11,'EVI',labelStyle).setDepth(21);
    this.rightName = this.add.text(918,11,'NARA',labelStyle).setOrigin(1,0).setDepth(21);
    this.timeLabel = this.add.text(480,25,'99',{
      fontFamily:'Rajdhani, Arial, sans-serif',fontSize:'42px',color:'#ffe7a6',fontStyle:'bold',
      stroke:'#251e3a',strokeThickness:5,
    }).setOrigin(.5,0).setDepth(21);
    this.centerLabel = this.add.text(480,210,'READY?',{
      fontFamily:'Rajdhani, Impact, sans-serif',fontSize:'77px',color:'#fff1ca',fontStyle:'bold',
      stroke:'#792f65',strokeThickness:10,
    }).setOrigin(.5).setDepth(22);
    this.add.text(480,510,'THE SPLASH OF FIGHTING   •   FIRST PLAYABLE', {
      fontFamily:'Rajdhani, sans-serif',fontSize:'15px',color:'#bb9dbb',fontStyle:'bold',
    }).setOrigin(.5).setDepth(10);
    this.resizeViewport(this.scale.width);
    this.paintHud();
    this.onStatus('Готово! ABXY · захват X+A (G), вихід із захвату A або X.');
  }

  /** Extend the camera horizontally instead of distorting/cropping 16:9 fighters. */
  resizeViewport(width: number): void {
    if (!this.cameras?.main) return;
    const screenWidth = Math.max(960, Math.round(width));
    this.extraHalf = (screenWidth - 960) / 2;
    setStageViewportWidth(screenWidth);
    this.cameras.main.setViewport(0,0,screenWidth,540);
    this.cameras.main.setScroll(-this.extraHalf,0);
    if (this.leftName) this.leftName.x = 39 - this.extraHalf;
    if (this.rightName) this.rightName.x = 918 + this.extraHalf;
    this.paintHud();
    this.paintDebug();
  }

  private drawStage(): void {
    const g=this.add.graphics().setDepth(-10);
    // Overscan: expose extra buildings / platform on wide devices.
    const leftEdge = -1600, sceneWidth = 4160;
    for(let y=0;y<540;y+=7){
      const ratio=y/540;
      const r=Math.floor(11+ratio*22), gr=Math.floor(16+ratio*10), b=Math.floor(39+ratio*42);
      g.fillStyle((r<<16)|(gr<<8)|b).fillRect(leftEdge,y,sceneWidth,7);
    }
    g.fillStyle(0xc8a2d0,.24).fillCircle(490,138,91);
    g.fillStyle(0xebcade,.25).fillCircle(490,138,57);
    g.lineStyle(3,0xa775c4,.5).strokeCircle(490,138,100);
    // Distant towers and lit windows, deterministic so the arena is reproducible.
    for(let i=-34;i<56;i++){
      const x=i*49-14;
      const h=65+(i*61%130);
      g.fillStyle(i%2?0x22243c:0x1b233e,.95).fillRect(x,373-h,42,h);
      g.fillStyle(i%3?0xbb739c:0x5fc7c6,.55);
      for(let yy=383-h;yy<357;yy+=16){
        for(let xx=x+7;xx<x+38;xx+=12) if((xx+yy+i)%4!==0)g.fillRect(xx,yy,4,6);
      }
    }
    g.fillStyle(0x121a32).fillRect(leftEdge,373,sceneWidth,74);
    g.lineStyle(2,0xcd6fbd,.7).lineBetween(leftEdge,374,leftEdge+sceneWidth,374);
    for(let i=-28;i<52;i++){
      const x=i*62;
      g.fillStyle(0x283f5c,.7).fillRoundedRect(x,352,24,75,8);
      g.fillStyle(0xee90bb,.6).fillRect(x+9,345,6,8);
    }
    // Fighting platform
    g.fillStyle(0x20263a).fillRect(leftEdge,GROUND_Y,sceneWidth,97);
    g.fillStyle(0x434966).fillRect(leftEdge,GROUND_Y,sceneWidth,5);
    g.fillStyle(0xc28cb6,.8).fillRect(leftEdge,GROUND_Y+5,sceneWidth,2);
    g.lineStyle(2,0x66789e,.37);
    for(let i=-32;i<64;i++){
      g.lineBetween(i*70-155,540,i*50+80,GROUND_Y+8);
    }
    for(let y=GROUND_Y+25;y<540;y+=24)g.lineBetween(leftEdge,y,leftEdge+sceneWidth,y);
    // Arcades: poles, lamps, animated-looking neon rings
    for(const x of [80,880]){
      g.fillStyle(0x1b2440).fillRoundedRect(x-15,210,30,234,8);
      g.lineStyle(5,0x53beca,.8).strokeRoundedRect(x-11,208,22,174,8);
      g.fillStyle(0xe9b1d2).fillEllipse(x,197,50,17);
    }
    this.add.text(480,325,'SPLASH  ★  CITY',{
      fontFamily:'Rajdhani, sans-serif',fontSize:'32px',fontStyle:'bold',color:'#ec9fc9',
      stroke:'#332447',strokeThickness:5,
    }).setOrigin(.5).setDepth(-5);
  }

  setMode(mode: GameMode): void {
    this.mode=mode;
    this.resetRound();
    this.onStatus(mode==='cpu'
      ? 'Режим: гра проти Нари (CPU).'
      : 'Режим: 2 гравці. Другий гравець: стрілки та Num1/2/4/5.');
  }

  getMode(): GameMode { return this.mode; }

  setDebug(next: boolean): void {
    this.debug=next;
    this.debugDraw?.clear();
    this.onStatus(this.debug ? 'Режим розробника: показую зони ударів і персонажів.' : 'Режим розробника вимкнено.');
  }

  getDebug(): boolean { return this.debug; }

  resetRound(): void {
    if(!this.evi||!this.nara)return;
    this.controls.clear();
    this.evi.reset(250,1);
    this.nara.reset(710,-1);
    this.prev1=ZERO();this.prev2=ZERO();
    this.readyTime=1.5;this.roundTime=99;this.roundOver=false;
    this.grapple=null;
    this.aiCooldown=.85;this.aiCount=0;this.frameCount=0;this.accumulator=0;
    this.centerLabel.setText('READY?').setColor('#fff0c0').setVisible(true);
    this.paintHud();
  }

  update(_time: number, delta: number): void {
    if(!this.evi||!this.nara)return;
    // Fixed 60Hz simulation: frame windows do not depend on the display refresh rate.
    this.accumulator+=Math.min(delta/1000,.10);
    let frames=0;
    while(this.accumulator>=STEP && frames<6){
      this.step(STEP);
      this.accumulator-=STEP;
      frames++;
    }
    this.paintHud();
    this.paintDebug();
  }

  private step(dt: number): void {
    this.frameCount++;
    if(this.readyTime>0){
      this.readyTime=Math.max(0,this.readyTime-dt);
      this.centerLabel.setText(this.readyTime>.52?'READY?':'FIGHT!');
      if(this.readyTime===0)this.centerLabel.setVisible(false);
      return;
    }
    if(this.roundOver) {
      // Let the defeated fighter finish falling AFTER the winner is announced
      // (time-out loss); everybody else remains frozen.
      this.advanceFallenFighters(dt);
      return;
    }
    // Once someone has 0 HP, freeze the remaining fight and let the KO fall
    // finish before displaying the winner. There can be no extra attacks.
    if(this.evi.knockedOut || this.nara.knockedOut) {
      this.advanceFallenFighters(dt);
      if((!this.evi.knockedOut || this.evi.knockoutSettled) &&
         (!this.nara.knockedOut || this.nara.knockoutSettled)) this.finishRound();
      return;
    }
    this.roundTime=Math.max(0,this.roundTime-dt);
    const input1=this.controls.read(0);
    const input2=this.mode==='cpu'?this.cpuInput(dt):this.controls.read(1);
    const just1=justPressed(input1,this.prev1);
    const just2=justPressed(input2,this.prev2);
    this.prev1=input1;this.prev2=input2;

    if (!this.grapple) {
      const p1CanGrab = just1.grab && this.canBeginGrab(this.evi,this.nara);
      const p2CanGrab = just2.grab && this.canBeginGrab(this.nara,this.evi);
      if (p1CanGrab && p2CanGrab) {
        // Simultaneous grabs clash; neither fighter gets a free throw.
        this.evi.grabRecovery=.24;this.nara.grabRecovery=.24;
        this.combatNotice('CLASH!',480,230,0xf7cf9b);
      } else if (p1CanGrab) this.beginGrab(this.evi,this.nara);
      else if (p2CanGrab) this.beginGrab(this.nara,this.evi);
    }
    if (this.grapple) {
      this.progressGrab(dt,input1,input2,just1,just2);
    } else {
      this.evi.step(dt,input1,just1,this.nara.x);
      this.nara.step(dt,input2,just2,this.evi.x);
      this.preventOverlap();
      this.resolveStrike(this.evi,this.nara);
      this.resolveStrike(this.nara,this.evi);
    }

    // If HP reaches zero now, the next fixed step will animate the fall.
    // A timeout can end the round immediately, with the defeated fighter
    // continuing its knockdown in the round-over branch.
    if (this.roundTime<=0) this.finishRound();
  }

  private advanceFallenFighters(dt: number): void {
    const inert=emptyInput();
    if(this.evi.knockedDown) this.evi.step(dt,inert,inert,this.nara.x);
    if(this.nara.knockedDown) this.nara.step(dt,inert,inert,this.evi.x);
    this.paintHud();
  }

  private canBeginGrab(attacker: Fighter, defender: Fighter): boolean {
    return !attacker.knockedOut && !defender.knockedOut &&
      attacker.stunned<=0 && defender.stunned<=0 &&
      !attacker.airborne && !defender.airborne &&
      !attacker.knockedDown && !defender.knockedDown &&
      attacker.grabRecovery<=0 &&
      attacker.attack?.name!=='special' &&
      Math.abs(attacker.x-defender.x)<=GRAB_MAX_START;
  }

  private beginGrab(attacker: Fighter, defender: Fighter): void {
    // The short windup is visible and still allows the defender to react.
    attacker.attack=null;
    attacker.grabPose='reach';
    this.grapple={attacker,defender,phase:'reach',elapsed:0};
    this.onStatus((attacker.id==='evi'?'Еві':'Нара')+
      ' тягнеться до суперника! A (блок) або X (швидкий удар) зривають захват.');
    this.combatNotice('GRAB!', (attacker.x+defender.x)/2,290,0xd4b3f5);
  }

  private stopGrab(counter: boolean): void {
    const grapple=this.grapple;
    if (!grapple) return;
    grapple.attacker.breakGrab(counter);
    grapple.defender.grabPose=null;
    this.grapple=null;
    this.combatNotice(counter?'COUNTER!':'BREAK!',(grapple.attacker.x+grapple.defender.x)/2,260,
      counter?0xffd1a4:0x9cf3eb);
    this.onStatus(counter
      ? 'Захват перервано швидким ударом X! Атакувальний втрачає 3 HP.'
      : 'Захват перервано блоком A!');
  }

  private progressGrab(
    dt: number, input1: InputState, input2: InputState,
    just1: InputState, just2: InputState
  ): void {
    const g=this.grapple;
    if (!g) return;
    const defenderInput=g.defender===this.evi?input1:input2;
    const defenderJust=g.defender===this.evi?just1:just2;
    const wasFastAttacking=g.defender.attack?.name==='light';
    if (defenderInput.block || defenderJust.light || wasFastAttacking) {
      this.stopGrab(defenderJust.light || wasFastAttacking);
      return;
    }

    g.elapsed+=dt;
    if(g.phase==='reach') {
      const defenderInputNow=defenderInput;
      const defenderJustNow=defenderJust;
      g.attacker.stepGrapple(dt,g.defender.x);
      g.defender.step(dt,defenderInputNow,defenderJustNow,g.attacker.x);
      // Other regular attacks can hit a reaching opponent before capture.
      this.resolveStrike(g.defender,g.attacker);
      if (g.attacker.stunned>0 || g.attacker.knockedOut) {
        this.stopGrab(false);
        return;
      }
      if(g.elapsed>=GRAB_REACH_TIME) {
        if(Math.abs(g.attacker.x-g.defender.x)>GRAB_CATCH_RANGE ||
           g.defender.airborne || g.defender.knockedOut) {
          g.attacker.breakGrab(false);
          this.grapple=null;
          this.onStatus('Захват не вдався: суперник відійшов від рук.');
          return;
        }
        g.phase='hold';
        g.elapsed=0;
        g.attacker.grabPose='hold';
        g.defender.grabPose='held';
        this.onStatus('ЗАХВАТ! Є час вирватися: тримай A або натисни X.');
        this.combatNotice('CAUGHT!',(g.attacker.x+g.defender.x)/2,255,0xffd4ad);
      }
      return;
    }

    // During the hold both fighters are fixed at close range.
    // This provides a visible escape window instead of an instant throw.
    g.defender.x=Phaser.Math.Clamp(g.attacker.x+g.attacker.face*47,STAGE_MIN_X+4,STAGE_MAX_X-4);
    g.attacker.stepGrapple(dt,g.defender.x);
    g.defender.stepGrapple(dt,g.attacker.x);
    if(g.elapsed>=GRAB_HOLD_TIME) {
      const face=g.attacker.face;
      g.defender.receiveThrow(THROW_DAMAGE,face);
      g.attacker.grabPose='throw';
      g.attacker.grabRecovery=.40;
      g.defender.grabPose=null;
      g.attacker.energy=Math.min(100,g.attacker.energy+12);
      this.spawnSparks(g.defender.x,GROUND_Y-110,false);
      this.cameras.main.shake(120,.006);
      this.combatNotice('THROW!',g.defender.x,240,0xffd29b);
      this.onStatus((g.attacker.id==='evi'?'Еві':'Нара')+
        ' перекидає суперника за спину! -'+THROW_DAMAGE+' HP. Падіння, 0,5 с лежачи й 0,5 с підйому.');
      this.grapple=null;
    }
  }

  private combatNotice(text: string,x: number,y: number,color: number): void {
    const label=this.add.text(x,y,text,{
      fontFamily:'Rajdhani, Arial, sans-serif',fontSize:'43px',fontStyle:'bold',
      color:'#ffffff',stroke:'#27233a',strokeThickness:7,
    }).setOrigin(.5).setTint(color).setDepth(18);
    this.tweens.add({
      targets:label,y:y-38,alpha:0,duration:630,ease:'Quad.easeOut',
      onComplete:()=>label.destroy(),
    });
  }

  private cpuInput(dt: number): InputState {
    const input=emptyInput();
    const distance=Math.abs(this.evi.x-this.nara.x);
    const forward=this.evi.x>this.nara.x?'right':'left';
    if(this.grapple?.defender===this.nara) {
      // The CPU sometimes reacts in time, but not on every attempt.
      if (this.grapple.phase==='hold' && this.grapple.elapsed>.22 &&
          this.aiCount%3!==0) input.block=true;
      return input;
    }
    if(this.nara.stunned>0||this.nara.knockedOut||this.nara.knockedDown)return input;
    if(distance>130)input[forward]=true;
    else if(distance<75 && this.aiCount%5===0)input.block=true;
    if(distance<160 && this.evi.attack && this.aiCount%4===0) input.block=true;
    // The CPU has the same guard restrictions: halt its approach or
    // retreat when blocking rather than guarding while moving forward.
    if (input.block) {
      input[forward]=false;
      const backward=forward==='left'?'right':'left';
      if (distance<135 && this.evi.attack) input[backward]=true;
    }
    this.aiCooldown-=dt;
    if(this.aiCooldown<=0){
      this.aiCount++;
      this.aiCooldown=.52+((this.aiCount*17)%9)*.09;
      if(distance<115 && this.aiCount%6===3) input.grab=true;
      else if(distance<210 && this.nara.energy>=40 && this.aiCount%5===0)input.special=true;
      else if(distance<141) {
        const choice=this.aiCount%3;
        if(choice===0)input.light=true;
        else if(choice===1)input.kick=true;
        else input.heavy=true;
      }
    }
    return input;
  }

  private preventOverlap(): void {
    // A thrown fighter must be able to pass THROUGH the thrower to land
    // behind them. Ordinary overlap resolution would push the victim back
    // to the original side on every frame, cancelling the reversed throw.
    if (this.evi.knockedDown || this.nara.knockedDown) return;
    const dx=this.nara.x-this.evi.x;
    if(Math.abs(dx)>=51)return;
    const sign=dx>=0?1:-1;
    const middle=(this.evi.x+this.nara.x)/2;
    this.evi.x=Phaser.Math.Clamp(middle-sign*26,STAGE_MIN_X+2,STAGE_MAX_X-2);
    this.nara.x=Phaser.Math.Clamp(middle+sign*26,STAGE_MIN_X+2,STAGE_MAX_X-2);
  }

  private resolveStrike(attacker: Fighter, target: Fighter): void {
    const strike=attacker.getActiveStrike();
    if(!strike)return;
    const box=attacker.strikeBox();
    // Consume the one impact frame even if the attack misses. Otherwise a
    // whiff could "hit late" during follow-through and become unavoidable.
    strike.connected=true;
    if(target.knockedOut||target.knockedDown||!box||!overlap(box,target.bodyBox()))return;
    const hit=target.receiveHit(strike.spec,attacker.face,strike.name);
    attacker.rewardHit(strike.spec);
    this.spawnSparks(target.x,GROUND_Y+target.yOffset-85,hit.blocked);
    if(hit.interrupted) {
      this.combatNotice('INTERRUPT!',target.x,GROUND_Y+target.yOffset-173,0xffd898);
    }
    if(!hit.blocked)this.cameras.main.shake(75,.003);
    this.onStatus(hit.blocked
      ? (hit.damage>0 ? 'Блок! Y пробив '+hit.damage.toLocaleString('uk-UA')+' HP (25% шкоди).' : 'Блок! Ушкодження поглинуто.')
      : attacker.id==='evi'
        ?'Еві влучила! -'+hit.damage+' HP Нари.'
        :'Нара влучила! -'+hit.damage+' HP Еві.');
  }

  private spawnSparks(x:number,y:number,blocked:boolean): void {
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4+this.frameCount*.1;
      const spread=16+(i%3)*9;
      const dot=this.add.circle(x,y,blocked?4:6,blocked?0x7ce9f2:(i%2?0xffe9a4:0xff89b5),.95).setDepth(16);
      this.tweens.add({
        targets:dot,
        x:x+Math.cos(angle)*spread,y:y+Math.sin(angle)*spread,
        alpha:0,scaleX:0,scaleY:0,duration:180+(i%3)*38,
        onComplete:()=>dot.destroy(),
      });
    }
  }

  private finishRound(): void {
    if (this.roundOver) return;
    this.roundOver=true;
    const winner=this.evi.hp===this.nara.hp?'DRAW!'
      :this.evi.hp>this.nara.hp?'EVI WINS!':'NARA WINS!';
    if (winner !== 'DRAW!') {
      const loser=this.evi.hp<this.nara.hp?this.evi:this.nara;
      const victor=loser===this.evi?this.nara:this.evi;
      // On time-out, the loser can still have HP and be standing. The
      // victory screen must also leave this fighter lying on the ground.
      if (!loser.knockedDown) loser.startDefeatFall(victor.face);
    }
    this.centerLabel.setText(winner).setColor('#ffe5a4').setVisible(true);
    this.onStatus(winner+' Натисни «Новий раунд» у меню або R для повтору.');
  }

  private paintHud(): void {
    if(!this.hud)return;
    this.hud.clear();
    this.drawHealth(39-this.extraHalf,55,this.evi.hp,0xe78fb9,false);
    this.drawHealth(571+this.extraHalf,55,this.nara.hp,0x69d6d2,true);
    this.drawEnergy(39-this.extraHalf,82,this.evi.energy,0xa18afa);
    this.drawEnergy(571+this.extraHalf,82,this.nara.energy,0xa18afa);
    this.timeLabel.setText(String(Math.ceil(this.roundTime)));
  }

  private drawHealth(x:number,y:number,hp:number,color:number,right:boolean): void {
    const w=350,h=19;
    this.hud.fillStyle(0x111326,.94).fillRoundedRect(x-4,y-4,w+8,h+8,6);
    this.hud.fillStyle(0x4d314f).fillRect(x,y,w,h);
    const fill=Math.max(0,w*hp/100);
    this.hud.fillStyle(color).fillRect(right?x+w-fill:x,y,fill,h);
    this.hud.fillStyle(0xffffff,.2).fillRect(right?x+w-fill:x,y,fill,4);
    this.hud.lineStyle(2,0xc7abc1,.7).strokeRoundedRect(x-4,y-4,w+8,h+8,6);
  }
  private drawEnergy(x:number,y:number,power:number,color:number): void {
    const w=350;
    this.hud.fillStyle(0x14162a).fillRect(x,y,w,8);
    this.hud.fillStyle(color).fillRect(x,y,w*Math.min(100,power)/100,8);
    this.hud.fillStyle(0xd6cbff).fillRect(x+w*.4-1,y,2,8);
    this.hud.lineStyle(1,0x827caa).strokeRect(x,y,w,8);
  }

  private paintDebug(): void {
    if(!this.debugDraw)return;
    this.debugDraw.clear();
    if(!this.debug)return;
    if(this.grapple?.phase==='reach') {
      const a=this.grapple.attacker;
      this.debugDraw.lineStyle(2,0xf7ca89,.8)
        .strokeCircle(a.x,GROUND_Y-73,GRAB_CATCH_RANGE);
    }
    for(const fighter of [this.evi,this.nara]){
      const rect=fighter.bodyBox();
      this.debugDraw.lineStyle(2,0x56f3a4,.9).strokeRect(rect.x,rect.y,rect.w,rect.h);
      const strike=fighter.strikeBox();
      if(strike)this.debugDraw.lineStyle(2,0xff5575,.95).strokeRect(strike.x,strike.y,strike.w,strike.h);
    }
  }
}
