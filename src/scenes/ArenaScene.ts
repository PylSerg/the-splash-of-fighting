import Phaser from 'phaser';
import { Controls, emptyInput, type InputState } from '../input/Controls';
import { Fighter, GROUND_Y, STAGE_MIN_X, STAGE_MAX_X, setStageViewportWidth, type FighterId } from '../combat/Fighter';
import { getCharacter } from '../characters/Roster';
import { getStage, type StageId } from '../stages/Stages';

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
  private player1!: Fighter;
  private player2!: Fighter;
  private hasMatch = false;
  private stageId: StageId = 'city';
  private stageBackground?: Phaser.GameObjects.Graphics;
  private stageSign?: Phaser.GameObjects.Text;
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
    this.player1 = new Fighter(this,'evi',250,1);
    this.player2 = new Fighter(this,'runa',710,-1);
    this.debugDraw = this.add.graphics().setDepth(12);
    this.hud = this.add.graphics().setDepth(20);
    const labelStyle = {fontFamily:'Rajdhani, Arial, sans-serif',fontSize:'27px',color:'#f7f4ff',fontStyle:'bold',stroke:'#12132d',strokeThickness:4};
    this.leftName = this.add.text(112,11,'ЕВІ',labelStyle).setDepth(21);
    this.rightName = this.add.text(848,11,'РУНА',labelStyle).setOrigin(1,0).setDepth(21);
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
    this.onStatus('Готово! X+A = захват. Вниз + напрямок + X+A або напрямок + L2 = перекат.');
  }

  /** Extend the camera horizontally instead of distorting/cropping 16:9 fighters. */
  resizeViewport(width: number): void {
    if (!this.cameras?.main) return;
    const screenWidth = Math.max(960, Math.round(width));
    this.extraHalf = (screenWidth - 960) / 2;
    setStageViewportWidth(screenWidth);
    this.cameras.main.setViewport(0,0,screenWidth,540);
    this.cameras.main.setScroll(-this.extraHalf,0);
    if (this.leftName) this.leftName.x = 112 - this.extraHalf;
    if (this.rightName) this.rightName.x = 848 + this.extraHalf;
    this.paintHud();
    this.paintDebug();
  }

  getStageId(): StageId { return this.stageId; }

  setArena(id: StageId): void {
    if (this.stageId === id) return;
    getStage(id);
    this.stageId = id;
    if (this.stageBackground) this.drawStage();
    this.onStatus('Арена: ' + getStage(id).name);
  }

  private drawStage(): void {
    this.stageBackground?.destroy();
    this.stageSign?.destroy();
    const g=this.add.graphics().setDepth(-10);
    this.stageBackground=g;
    if (this.stageId === 'lagoon') {
      this.drawLagoon(g);
      return;
    }
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
    this.stageSign=this.add.text(480,325,'SPLASH  ★  CITY',{
      fontFamily:'Rajdhani, sans-serif',fontSize:'32px',fontStyle:'bold',color:'#ec9fc9',
      stroke:'#332447',strokeThickness:5,
    }).setOrigin(.5).setDepth(-5);
  }

  /**
   * Construct each roster choice in its correct player slot, independent
   * of character identity. Only valid, unique pairs may enter a round.
   */
  getMatchup(): { first: FighterId; second: FighterId; mode: GameMode } | null {
    if (!this.hasMatch) return null;
    return { first: this.player1.id, second: this.player2.id, mode: this.mode };
  }

  setMatchup(first: FighterId, second: FighterId, mode: GameMode): void {
    if (first === second) throw new Error('A mirror match is not allowed.');
    this.player1?.destroy();
    this.player2?.destroy();
    this.player1=new Fighter(this,first,250,1);
    this.player2=new Fighter(this,second,710,-1);
    this.mode=mode;
    this.hasMatch=true;
    this.leftName.setText(getCharacter(first).name);
    this.rightName.setText(getCharacter(second).name);
    this.resetRound();
    this.onStatus(mode==='cpu'
      ? getCharacter(first).name+' проти '+getCharacter(second).name+' (CPU)!'
      : getCharacter(first).name+' проти '+getCharacter(second).name+' (PvP)!');
  }

  /** Original hand-drawn moonlit coast, extending beyond 16:9 devices. */
  private drawLagoon(g: Phaser.GameObjects.Graphics): void {
    const left=-1600, wide=4160;
    // Deep indigo sky with warm twilight near the horizon.
    for(let y=0;y<540;y+=6) {
      const t=y/540;
      const r=Math.floor(8+t*28);
      const gr=Math.floor(13+t*34);
      const b=Math.floor(44+t*37);
      g.fillStyle((r<<16)|(gr<<8)|b).fillRect(left,y,wide,6);
    }
    // Stars spread over the full extra-wide world.
    for(let i=-75;i<126;i++){
      const x=i*26 + (i*i*19 % 21);
      const y=24+((i*i*31+421)%245);
      const rad=i%9===0?2.1:1.1;
      g.fillStyle(i%7===0?0xffdfb3:0xc7e9ff,.37+(i%4)*.13).fillCircle(x,y,rad);
    }
    g.fillStyle(0x8ddfe6,.10).fillCircle(489,138,106);
    g.fillStyle(0xe2e0e7,.10).fillCircle(489,138,80);
    g.fillStyle(0xf9edce,.97).fillCircle(489,138,60);
    g.fillStyle(0xffffff,.23).fillCircle(470,117,8);
    g.fillStyle(0xf1dabc,.33).fillCircle(510,163,15);

    // Multiple bands of distant islands with increasing atmospheric opacity.
    for(let i=-14;i<25;i++){
      const x=i*178-75;
      const peak=257+(i*41%38);
      g.fillStyle(i%2?0x263c60:0x2a476b,.8);
      g.fillTriangle(x,339,x+95,peak,x+226,339);
      g.fillStyle(0x334e68,.9).fillTriangle(x+68,340,x+148,peak+17,x+280,341);
    }
    // The lagoon: horizontal shimmer and moonlit ripples.
    g.fillStyle(0x183e5c).fillRect(left,333,wide,112);
    for(let y=337;y<445;y+=9) {
      const w=50+((y*13)%140);
      for(let i=-20;i<35;i++) {
        const x=i*136+(i*i*7%73)-22;
        g.fillStyle(i%3===0?0x8ed7d3:0x6bb2cb,.16 + ((y/9)%3)*.065);
        g.fillRoundedRect(x,y,w,2,1);
      }
    }
    for(let j=0;j<7;j++){
      const y=347+j*15;
      const w=16+j*26;
      g.fillStyle(0xf0efd3,.18-j*.015).fillRoundedRect(489-w/2,y,w,3,1);
    }
    // Shoreline ground and subtle wet sand.
    g.fillStyle(0x26394d).fillRect(left,GROUND_Y,wide,97);
    g.fillStyle(0xbcae91,.75).fillRect(left,GROUND_Y,wide,5);
    g.lineStyle(3,0xa1dbd7,.55).lineBetween(left,GROUND_Y,left+wide,GROUND_Y);
    for(let y=GROUND_Y+16;y<540;y+=19){
      g.lineStyle(1,y%3===0?0x718c99:0x617b90,.28).lineBetween(left,y,left+wide,y);
    }
    for(let i=-37;i<66;i++){
      g.lineStyle(1,0x85948e,.16)
        .lineBetween(i*71-110,540,i*46+92,GROUND_Y+7);
    }

    // Glow mushrooms and coastal lanterns framing the fighting area.
    for(const x of [105,866]) {
      g.fillStyle(0x121e36).fillRoundedRect(x-7,342,14,103,6);
      g.fillStyle(0xfec793,.11).fillCircle(x,337,40);
      g.fillStyle(0xfed5a2,.87).fillEllipse(x,327,27,24);
      g.fillStyle(0x6a8aa1,.85).fillRoundedRect(x-11,331,22,8,2);
      g.lineStyle(2,0xbcc6bc,.6).lineBetween(x,344,x,356);
    }
    // Rocky silhouettes at the distant edges.
    for(const x of [-280,1150]) {
      g.fillStyle(0x152f43,.84).fillTriangle(x,418,x+80,271,x+191,418);
      g.fillStyle(0x183c4b,.78).fillTriangle(x+75,425,x+158,313,x+270,425);
      g.lineStyle(3,0x587e78,.34).lineBetween(x+15,418,x+80,271);
    }
    // Colorful shells near the combat floor.
    for(const x of [215,774,-220,1170]){
      g.fillStyle(0xe7bea7,.47).fillEllipse(x,GROUND_Y-3,22,8);
      g.fillStyle(0x7db7ba,.46).fillTriangle(x-7,GROUND_Y-3,x,GROUND_Y-15,x+7,GROUND_Y-3);
    }
    this.stageSign=this.add.text(480,313,'MOONLIGHT  ☾  LAGOON',{
      fontFamily:'Rajdhani, sans-serif',fontSize:'28px',fontStyle:'bold',
      color:'#bfe8ed',stroke:'#1b3b52',strokeThickness:5,
    }).setOrigin(.5).setDepth(-5);
  }

  setMode(mode: GameMode): void {
    this.mode=mode;
    if (this.hasMatch) this.resetRound();
  }
  getMode(): GameMode { return this.mode; }

  setDebug(next: boolean): void {
    this.debug=next;
    this.debugDraw?.clear();
    this.onStatus(this.debug ? 'Режим розробника: показую зони ударів і персонажів.' : 'Режим розробника вимкнено.');
  }

  getDebug(): boolean { return this.debug; }

  resetRound(): void {
    if(!this.player1||!this.player2)return;
    this.controls.clear();
    this.player1.reset(250,1);
    this.player2.reset(710,-1);
    this.prev1=ZERO();this.prev2=ZERO();
    this.readyTime=1.5;this.roundTime=99;this.roundOver=false;
    this.grapple=null;
    this.aiCooldown=.85;this.aiCount=0;this.frameCount=0;this.accumulator=0;
    this.centerLabel.setText('READY?').setColor('#fff0c0').setVisible(true);
    this.paintHud();
  }

  update(_time: number, delta: number): void {
    // The initial character selector must not advance simulation or AI.
    if(!this.hasMatch||!this.player1||!this.player2)return;
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
    if(this.player1.knockedOut || this.player2.knockedOut) {
      this.advanceFallenFighters(dt);
      if((!this.player1.knockedOut || this.player1.knockoutSettled) &&
         (!this.player2.knockedOut || this.player2.knockoutSettled)) this.finishRound();
      return;
    }
    this.roundTime=Math.max(0,this.roundTime-dt);
    const input1=this.controls.read(0);
    const input2=this.mode==='cpu'?this.cpuInput(dt):this.controls.read(1);
    const just1=justPressed(input1,this.prev1);
    const just2=justPressed(input2,this.prev2);
    this.prev1=input1;this.prev2=input2;

    if (!this.grapple) {
      const p1CanGrab = just1.grab && this.canBeginGrab(this.player1,this.player2);
      const p2CanGrab = just2.grab && this.canBeginGrab(this.player2,this.player1);
      if (p1CanGrab && p2CanGrab) {
        // Simultaneous grabs clash; neither fighter gets a free throw.
        this.player1.grabRecovery=.24;this.player2.grabRecovery=.24;
        this.combatNotice('CLASH!',480,230,0xf7cf9b);
      } else if (p1CanGrab) this.beginGrab(this.player1,this.player2);
      else if (p2CanGrab) this.beginGrab(this.player2,this.player1);
    }
    if (this.grapple) {
      this.progressGrab(dt,input1,input2,just1,just2);
    } else {
      const p1WasRolling = this.player1.isRolling;
      const p2WasRolling = this.player2.isRolling;
      this.player1.step(dt,input1,just1,this.player2.x);
      this.player2.step(dt,input2,just2,this.player1.x);
      if (!p1WasRolling && this.player1.isRolling) {
        this.combatNotice('ROLL!',this.player1.x,GROUND_Y-135,0x95ecff);
      }
      if (!p2WasRolling && this.player2.isRolling) {
        this.combatNotice('ROLL!',this.player2.x,GROUND_Y-135,0x95ecff);
      }
      this.preventOverlap();
      this.resolveStrike(this.player1,this.player2);
      this.resolveStrike(this.player2,this.player1);
    }

    // If HP reaches zero now, the next fixed step will animate the fall.
    // A timeout can end the round immediately, with the defeated fighter
    // continuing its knockdown in the round-over branch.
    if (this.roundTime<=0) this.finishRound();
  }

  private advanceFallenFighters(dt: number): void {
    const inert=emptyInput();
    if(this.player1.knockedDown) this.player1.step(dt,inert,inert,this.player2.x);
    if(this.player2.knockedDown) this.player2.step(dt,inert,inert,this.player1.x);
    this.paintHud();
  }

  private canBeginGrab(attacker: Fighter, defender: Fighter): boolean {
    return !attacker.knockedOut && !defender.knockedOut &&
      attacker.stunned<=0 && defender.stunned<=0 &&
      !attacker.airborne && !defender.airborne &&
      !attacker.knockedDown && !defender.knockedDown &&
      !attacker.isRolling && !defender.isRolling &&
      attacker.grabRecovery<=0 &&
      attacker.attack?.name!=='special' &&
      Math.abs(attacker.x-defender.x)<=GRAB_MAX_START;
  }

  private beginGrab(attacker: Fighter, defender: Fighter): void {
    // The short windup is visible and still allows the defender to react.
    attacker.attack=null;
    attacker.grabPose='reach';
    this.grapple={attacker,defender,phase:'reach',elapsed:0};
    this.onStatus(getCharacter(attacker.id).name+
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
    const defenderInput=g.defender===this.player1?input1:input2;
    const defenderJust=g.defender===this.player1?just1:just2;
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
           g.defender.airborne || g.defender.knockedOut ||
           g.defender.isRolling) {
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
      const throwDamage = g.attacker.throwDamage;
      g.defender.receiveThrow(throwDamage,face);
      g.attacker.grabPose='throw';
      g.attacker.grabRecovery=.40;
      g.defender.grabPose=null;
      g.attacker.energy=Math.min(100,g.attacker.energy+12);
      this.spawnSparks(g.defender.x,GROUND_Y-110,false);
      this.cameras.main.shake(120,.006);
      this.combatNotice('THROW!',g.defender.x,240,0xffd29b);
      this.onStatus(getCharacter(g.attacker.id).name+
        ' перекидає суперника за спину! -'+throwDamage+' HP.'+
        (g.defender.knockedOut ? ' Нокаут: суперник не підводиться!' :
        ' Падіння, 0,5 с лежачи й 0,5 с підйому.'));
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
    const distance=Math.abs(this.player1.x-this.player2.x);
    const forward=this.player1.x>this.player2.x?'right':'left';
    if(this.grapple?.defender===this.player2) {
      // The CPU sometimes reacts in time, but not on every attempt.
      if (this.grapple.phase==='hold' && this.grapple.elapsed>.22 &&
          this.aiCount%3!==0) input.block=true;
      return input;
    }
    if(this.player2.stunned>0||this.player2.knockedOut||this.player2.knockedDown)return input;
    if(distance>130)input[forward]=true;
    else if(distance<75 && this.aiCount%5===0)input.block=true;
    if(distance<160 && this.player1.attack && this.aiCount%4===0) input.block=true;
    // The CPU has the same guard restrictions: halt its approach or
    // retreat when blocking rather than guarding while moving forward.
    if (input.block) {
      input[forward]=false;
      const backward=forward==='left'?'right':'left';
      if (distance<135 && this.player1.attack) input[backward]=true;
    }
    this.aiCooldown-=dt;
    if(this.aiCooldown<=0){
      this.aiCount++;
      this.aiCooldown=.52+((this.aiCount*17)%9)*.09;
      if(distance<115 && this.aiCount%6===3) input.grab=true;
      else if(distance<210 && this.player2.energy>=40 && this.aiCount%5===0)input.special=true;
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
    if (this.player1.knockedDown || this.player2.knockedDown ||
        this.player1.isRolling || this.player2.isRolling) return;
    const dx=this.player2.x-this.player1.x;
    if(Math.abs(dx)>=51)return;
    const sign=dx>=0?1:-1;
    const middle=(this.player1.x+this.player2.x)/2;
    this.player1.x=Phaser.Math.Clamp(middle-sign*26,STAGE_MIN_X+2,STAGE_MAX_X-2);
    this.player2.x=Phaser.Math.Clamp(middle+sign*26,STAGE_MIN_X+2,STAGE_MAX_X-2);
  }

  private resolveStrike(attacker: Fighter, target: Fighter): void {
    const strike=attacker.getActiveStrike();
    if(!strike)return;
    const box=attacker.strikeBox();
    // Consume the one impact frame even if the attack misses. Otherwise a
    // whiff could "hit late" during follow-through and become unavoidable.
    strike.connected=true;
    if(target.knockedOut||target.knockedDown||!box||!overlap(box,target.bodyBox()))return;
    if(target.isRollInvulnerable) {
      this.combatNotice('DODGE!',target.x,GROUND_Y-152,0x9aeefb);
      return; // No damage or energy reward during the roll's evasion window.
    }
    const hit=target.receiveHit(strike.spec,attacker.face,strike.name);
    attacker.rewardHit(strike.spec);
    this.spawnSparks(target.x,GROUND_Y+target.yOffset-85,hit.blocked);
    if(hit.interrupted) {
      this.combatNotice('INTERRUPT!',target.x,GROUND_Y+target.yOffset-173,0xffd898);
    }
    if(!hit.blocked)this.cameras.main.shake(75,.003);
    this.onStatus(hit.blocked
      ? (hit.damage>0 ? 'Блок! Y пробив '+hit.damage.toLocaleString('uk-UA')+' HP (25% шкоди).' : 'Блок! Ушкодження поглинуто.')
      :getCharacter(attacker.id).name+' влучає! -'+hit.damage+
        ' HP '+getCharacter(target.id).name+'.');
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
    const winner=this.player1.hp===this.player2.hp?'DRAW!'
      :this.player1.hp>this.player2.hp?getCharacter(this.player1.id).name+' WINS!'
        :getCharacter(this.player2.id).name+' WINS!';
    if (winner !== 'DRAW!') {
      const loser=this.player1.hp<this.player2.hp?this.player1:this.player2;
      const victor=loser===this.player1?this.player2:this.player1;
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
    // Leave room for the portraits at both outer edges.
    const left=112-this.extraHalf;
    const right=548+this.extraHalf;
    // Each roster fighter contributes their own HUD color, including Lyra.
    this.drawHealth(left,55,this.player1.hp,
      Number.parseInt(getCharacter(this.player1.id).color.slice(1),16),false);
    this.drawHealth(right,55,this.player2.hp,
      Number.parseInt(getCharacter(this.player2.id).color.slice(1),16),true);
    this.drawEnergy(left,82,this.player1.energy,0xa18afa);
    this.drawEnergy(right,82,this.player2.energy,0xa18afa);
    this.timeLabel.setText(String(Math.ceil(this.roundTime)));
  }

  private drawHealth(x:number,y:number,hp:number,color:number,right:boolean): void {
    const w=300,h=19;
    this.hud.fillStyle(0x111326,.94).fillRoundedRect(x-4,y-4,w+8,h+8,6);
    this.hud.fillStyle(0x4d314f).fillRect(x,y,w,h);
    const fill=Math.max(0,w*hp/100);
    this.hud.fillStyle(color).fillRect(right?x+w-fill:x,y,fill,h);
    this.hud.fillStyle(0xffffff,.2).fillRect(right?x+w-fill:x,y,fill,4);
    this.hud.lineStyle(2,0xc7abc1,.7).strokeRoundedRect(x-4,y-4,w+8,h+8,6);
  }
  private drawEnergy(x:number,y:number,power:number,color:number): void {
    const w=300;
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
    for(const fighter of [this.player1,this.player2]){
      const rect=fighter.bodyBox();
      this.debugDraw.lineStyle(2,0x56f3a4,.9).strokeRect(rect.x,rect.y,rect.w,rect.h);
      const strike=fighter.strikeBox();
      if(strike)this.debugDraw.lineStyle(2,0xff5575,.95).strokeRect(strike.x,strike.y,strike.w,strike.h);
    }
  }
}
