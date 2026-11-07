import Phaser from 'phaser';
import { Controls, emptyInput, type InputState } from '../input/Controls';
import {
  Fighter, ATTACKS, GROUND_Y, STAGE_MIN_X, STAGE_MAX_X,
  setStageViewportWidth, type FighterId, type ActiveAttack,
} from '../combat/Fighter';
import {
  isSimultaneousClash, type ClashAttempt, type ClashRect,
} from '../combat/StrikeClashRules';
import { getCharacter } from '../characters/Roster';
import { HIT_LEVEL_NAMES } from '../combat/HitRules';
import { sweepTrips } from '../combat/CrouchRules';
import {
  advanceHealthTrail, healthFillRect, makeHealthTrail,
  type HealthTrail, SPECIAL_METER_COST, MAX_HEALTH,
} from '../combat/CombatFeedback';
import { canBeGrabbed } from '../combat/GrabRules';
import {
  DUEL_DURATION, DUEL_RESULT_ANIMATION, DUEL_GUARD_STUN,
  DUEL_TIE_PUSH, DUEL_GUARD_PUSH, chooseDuelInput,
  resolveDuel, duelDamage, type DuelChoice, type DuelStrike,
} from '../combat/DuelRules';
import { getStage, type StageId } from '../stages/Stages';
import { SPLASH_WINDUP, SPLASH_MOVES, SPLASH_DUEL_WIN_GAIN,
  comboSplashBonus, canSplashGuard } from '../combat/SplashRules';
import { awardRound, MATCH_MAX_ROUNDS, ROUND_INTRO_TOTAL, roundIntroText } from '../combat/MatchRules';

type GameMode = 'cpu' | 'versus';
interface DuelPending {
  attacker: Fighter;
  defender: Fighter;
  /** Zero-damage Y starter actually overlapped, ignoring the guard. */
  connected: boolean;
}
interface DuelAftermath {
  attacker: Fighter;
  defender: Fighter;
  attackerChoice: DuelChoice;
  defenderChoice: DuelChoice;
  elapsed: number;
}
interface DuelSession {
  attacker: Fighter;
  defender: Fighter;
  elapsed: number;
  /** Index 0=P1, 1=P2; never revealed until resolution. */
  choices: [DuelChoice,DuelChoice];
  previous: [InputState,InputState];
}
interface SplashSession {
  attacker:Fighter;
  defender:Fighter;
  elapsed:number;
  guarded:boolean;
  pulses:number;
}
interface Grapple {
  attacker: Fighter;
  defender: Fighter;
  phase: 'reach' | 'hold';
  elapsed: number;
  /** The pull must be a NEW backward gesture once the hold begins. */
  backWasHeld: boolean;
}
// Two-stage grab: approach, then maintain grip and PULL backward to throw.
const GRAB_REACH_TIME = .32;
// A generous but finite opportunity to commit to the throw. No automatic throws.
const GRAB_HOLD_TIMEOUT = 1.65;
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
  private roundLabel!: Phaser.GameObjects.Text;
  private splashLabel1!: Phaser.GameObjects.Text;
  private splashLabel2!: Phaser.GameObjects.Text;
  private leftName!: Phaser.GameObjects.Text;
  private rightName!: Phaser.GameObjects.Text;
  private extraHalf = 0;
  private readyTime = ROUND_INTRO_TOTAL;
  private roundTime = 99;
  private roundOver = false;
  private accumulator = 0;
  private aiCooldown = .85;
  private aiCount = 0;
  private frameCount = 0;
  private grapple: Grapple | null = null;
  private duel: DuelSession | null = null;
  private duelPending: DuelPending | null = null;
  private duelAftermath: DuelAftermath | null = null;
  private splash: SplashSession | null = null;
  private matchWins:[number,number]=[0,0];
  private roundsPlayed=0;
  private matchWinner:0|1|null=null;
  private roundTransition=0;
  private healthTrail1: HealthTrail = makeHealthTrail(MAX_HEALTH);
  private healthTrail2: HealthTrail = makeHealthTrail(MAX_HEALTH);

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
    this.roundLabel=this.add.text(480,81,'ROUND 1 / 3',{
      fontFamily:'Rajdhani, Arial, sans-serif',fontSize:'18px',
      color:'#fff0bd',fontStyle:'bold',stroke:'#19192f',strokeThickness:3,
    }).setOrigin(.5,0).setDepth(21);
    const splashLabelStyle={
      fontFamily:'Rajdhani, Arial, sans-serif',fontSize:'16px',
      color:'#a8eefa',fontStyle:'bold',stroke:'#14172b',strokeThickness:3,
    };
    this.splashLabel1=this.add.text(112,466,'SPLASH',splashLabelStyle).setDepth(21);
    this.splashLabel2=this.add.text(848,466,'SPLASH',splashLabelStyle)
      .setOrigin(1,0).setDepth(21);
    this.centerLabel = this.add.text(480,210,'READY?',{
      fontFamily:'Rajdhani, Impact, sans-serif',fontSize:'77px',color:'#fff1ca',fontStyle:'bold',
      stroke:'#792f65',strokeThickness:10,
    }).setOrigin(.5).setDepth(22);
    this.add.text(480,510,'THE SPLASH OF FIGHTING   •   FIRST PLAYABLE', {
      fontFamily:'Rajdhani, sans-serif',fontSize:'15px',color:'#bb9dbb',fontStyle:'bold',
    }).setOrigin(.5).setDepth(10);
    this.resizeViewport(this.scale.width);
    this.paintHud();
    this.onStatus('A+X утримувати для захвату; назад (у т. ч. ↖/↙) для кидка. Вниз+напрямок+X+A = перекат.');
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
    if (this.splashLabel1) this.splashLabel1.x=112-this.extraHalf;
    if (this.splashLabel2) this.splashLabel2.x=848+this.extraHalf;
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
    this.restartMatch();
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
    if (this.hasMatch) this.restartMatch();
  }
  getMode(): GameMode { return this.mode; }

  setDebug(next: boolean): void {
    this.debug=next;
    this.debugDraw?.clear();
    this.onStatus(this.debug ? 'Режим розробника: показую зони ударів і персонажів.' : 'Режим розробника вимкнено.');
  }

  getDebug(): boolean { return this.debug; }

  /** Starting a fresh match clears wins and both energy bars. */
  restartMatch():void {
    this.matchWins=[0,0];
    this.roundsPlayed=0;
    this.matchWinner=null;
    this.resetRound(false);
  }

  /** Between rounds preserve only splash energy; reset regular special energy. */
  resetRound(preserveSplash=false): void {
    if(!this.player1||!this.player2)return;
    this.controls.clear();
    this.player1.reset(250,1,preserveSplash);
    this.player2.reset(710,-1,preserveSplash);
    this.healthTrail1=makeHealthTrail(this.player1.hp);
    this.healthTrail2=makeHealthTrail(this.player2.hp);
    this.prev1=ZERO();this.prev2=ZERO();
    this.readyTime=ROUND_INTRO_TOTAL;this.roundTime=99;this.roundOver=false;
    this.grapple=null;
    this.duel=null;
    this.duelPending=null;
    this.duelAftermath=null;
    this.splash=null;
    this.roundTransition=0;
    this.aiCooldown=.85;this.aiCount=0;this.frameCount=0;this.accumulator=0;
    this.centerLabel.setText(roundIntroText(this.readyTime,this.roundsPlayed+1) ?? '')
      .setColor('#fff0c0').setVisible(true);
    this.roundLabel.setText('ROUND '+(this.roundsPlayed+1)+' / '+MATCH_MAX_ROUNDS);
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
    // HUD animations advance even after a KO or while fighters are recovering.
    const visualDt=(this.duel || this.duelAftermath || this.splash)?0:
      Math.min(Math.max(0,delta/1000),.10);
    this.healthTrail1=advanceHealthTrail(this.healthTrail1,this.player1.hp,visualDt);
    this.healthTrail2=advanceHealthTrail(this.healthTrail2,this.player2.hp,visualDt);
    this.paintHud();
    this.paintDebug();
  }

  private step(dt: number): void {
    this.frameCount++;
    if(this.readyTime>0){
      this.readyTime=Math.max(0,this.readyTime-dt);
      const label=roundIntroText(this.readyTime,this.roundsPlayed+1);
      if(label)this.centerLabel.setText(label);
      else this.centerLabel.setVisible(false);
      return;
    }
    if(this.splash){
      this.stepSplash(dt);
      return;
    }
    // During a duel, movement, AI attacks, countdown and hit detection freeze.
    // Only the private button-selection timer is allowed to advance.
    if(this.duel) {
      this.stepDuel(dt);
      return;
    }
    if(this.duelAftermath) {
      this.stepDuelAftermath(dt);
      return;
    }
    if(this.roundOver) {
      this.advanceFallenFighters(dt);
      if(this.matchWinner===null){
        this.roundTransition=Math.max(0,this.roundTransition-dt);
        if(this.roundTransition===0 && this.player1.knockdownPhase!=='flying' &&
           this.player2.knockdownPhase!=='flying'){
          this.resetRound(true);
          this.onStatus('Раунд '+(this.roundsPlayed+1)+' із 3. Заряд SPLASH збережено!');
        }
      }
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

    // Cinematic splash has priority over all component X/Y/L1/R1 inputs.
    if(!this.grapple && !this.duelPending){
      const splash1=just1.splash && this.player1.tryStartSplash();
      const splash2=just2.splash && this.player2.tryStartSplash();
      if(splash1&&splash2){
        this.player1.endSplashPose();this.player2.endSplashPose();
        this.player1.stunned=.5;this.player2.stunned=.5;
        this.combatNotice('SPLASH CLASH!',480,GROUND_Y-215,0x9af4f4);
        this.onStatus('Одночасні сплеші! Взаємне блокування: 0 шкоди.');
        return;
      }
      if(splash1||splash2){
        const attacker=splash1?this.player1:this.player2;
        const defender=splash1?this.player2:this.player1;
        this.splash={attacker,defender,elapsed:0,guarded:false,pulses:0};
        this.combatNotice('SPLASH!',attacker.x,GROUND_Y-222,
          SPLASH_MOVES[attacker.id].color);
        this.onStatus(getCharacter(attacker.id).name+': '+
          SPLASH_MOVES[attacker.id].name+
          '! У суперника 0,5 с на ↓+A, звичайний блок не діє!');
        this.stepSplash(dt);
        return;
      }
    }

    if (!this.grapple && !this.duelPending) {
      // A duel opener has priority over its component B/Y attacks, and
      // the forward direction is interpreted relative to each fighter's face.
      const duel1=just1.duel && this.player1.tryBeginDuel(input1);
      const duel2=just2.duel && this.player2.tryBeginDuel(input2);
      if(duel1 || duel2) this.onStatus('ВИКЛИК! Неблокований замах Y. Якщо влучить, почнеться дуель!');
      // The crouched or rolling X+A chord is NOT a standing grab.
      const p1CanGrab = !duel1 && !duel2 && just1.grab &&
        this.canBeginGrab(this.player1,this.player2,input1,input2,just2);
      const p2CanGrab = !duel1 && !duel2 && just2.grab &&
        this.canBeginGrab(this.player2,this.player1,input2,input1,just1);
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
      // Evaluate both live impact frames against the SAME world snapshot.
      // Neither fighter receives damage before a mutual hit is identified.
      this.resolveFrameStrikes();
    }
    // Defer duel initiation until AFTER the completed Y swing, including
    // its follow-through. Miss recovery also starts AFTER that animation.
    this.advancePendingDuel();

    // If HP reaches zero now, the next fixed step will animate the fall.
    // A timeout can end the round immediately, with the defeated fighter
    // continuing its knockdown in the round-over branch.
    if(this.roundTime<=0 && !this.duel && !this.duelPending && !this.duelAftermath) {
      this.finishRound();
    }
  }


  /** Phase 1 is reactable. After 0.5 s the opponent is locked until the end.
   * Only an actual crouching A guard during the wind-up survives the cinematic.
   * One final damage application prevents early KO animations from escaping it.
   */
  private stepSplash(dt:number):void {
    const session=this.splash;
    if(!session)return;
    const {attacker,defender}=session;
    const move=SPLASH_MOVES[attacker.id];
    const oldElapsed=session.elapsed;
    session.elapsed=Math.min(move.duration,session.elapsed+dt);
    const justEntered=oldElapsed<SPLASH_WINDUP && session.elapsed>=SPLASH_WINDUP;

    if(oldElapsed<SPLASH_WINDUP){
      // Until the attack begins, defender input (including walking and guard)
      // stays live. The splash attacker is committed and cannot be controlled.
      const defensiveInput=defender===this.player1 ? this.controls.read(0) :
        this.mode==='cpu' ? this.cpuSplashDefense(session) : this.controls.read(1);
      const oldInput=defender===this.player1?this.prev1:this.prev2;
      const just=justPressed(defensiveInput,oldInput);
      if(defender===this.player1)this.prev1=defensiveInput;
      else this.prev2=defensiveInput;
      defender.step(dt,defensiveInput,just,attacker.x);
      session.guarded ||= canSplashGuard({
        down:defensiveInput.down,block:defensiveInput.block,
        airborne:defender.airborne,knockedDown:defender.knockedDown,
        knockedOut:defender.knockedOut,stunned:defender.stunned,
        guarding:defender.blocking && defender.crouching,
      });
      attacker.stepSplashPose(dt,'startup',
        Math.min(1,session.elapsed/SPLASH_WINDUP),defender.x);
    }
    if(session.elapsed>=SPLASH_WINDUP){
      const progress=Math.min(1,(session.elapsed-SPLASH_WINDUP)/
        (move.duration-SPLASH_WINDUP));
      if(justEntered){
        this.combatNotice(session.guarded?'SPLASH GUARD!':'SPLASH HIT!',
          defender.x,GROUND_Y-218,session.guarded?0x78e5ed:move.color);
      }
      attacker.stepSplashPose(oldElapsed<SPLASH_WINDUP?0:dt,'attack',
        progress,defender.x);
      // Even a jumping, attacking or rolling defender is frozen from here.
      defender.stepSplashPose(0,session.guarded?'guard':'victim',
        progress,attacker.x);
      const pulse=Math.min(move.pulses,Math.floor(progress*move.pulses));
      while(session.pulses<pulse){
        session.pulses++;
        this.spawnSparks(defender.x,GROUND_Y+defender.yOffset-104,
          session.guarded);
        if(session.pulses===Math.ceil(move.pulses/2))
          this.combatNotice(session.guarded?'BLOCKED!':'COMBO SPLASH!',
            defender.x,GROUND_Y-202,session.guarded?0x87f1ec:move.color);
      }
    }
    if(session.elapsed>=move.duration){
      attacker.endSplashPose();
      defender.endSplashPose();
      let damage=0;
      if(!session.guarded){
        const hit=defender.receiveHit({
          ...ATTACKS.special,damage:move.damage,stun:.56,push:380,
        },attacker.face,true);
        damage=hit.damage;
        this.cameras.main.shake(200,.009);
      }else{
        defender.deflectSimultaneousStrike(ATTACKS.special,attacker.face);
      }
      this.combatNotice(session.guarded?'PERFECT GUARD!':'SPLASH FINISH!',
        defender.x,GROUND_Y-238,session.guarded?0x82edee:move.color);
      this.onStatus(session.guarded
        ? getCharacter(defender.id).name+
          ' вчасно натискає ↓+A! Увесь сплеш заблоковано, 0 HP.'
        : getCharacter(attacker.id).name+' виконує '+move.name+
          ' і завдає '+damage+' HP!'+(defender.knockedOut?' НОКАУТ!':''));
      this.splash=null;
      // Holding the cinematic chord must not queue a regular hit afterwards.
      this.prev1=this.controls.read(0);
      this.prev2=this.mode==='cpu'?emptyInput():this.controls.read(1);
    }
  }

  /** CPU has a human-like reaction delay and does not always find ↓+A. */
  private cpuSplashDefense(session:SplashSession):InputState {
    const input=emptyInput();
    if(session.elapsed>=.20 && this.aiCount%3===0){
      input.down=true;input.block=true;
    }
    return input;
  }

  private advanceFallenFighters(dt: number): void {
    const inert=emptyInput();
    if(this.player1.knockedDown) this.player1.step(dt,inert,inert,this.player2.x);
    if(this.player2.knockedDown) this.player2.step(dt,inert,inert,this.player1.x);
    this.paintHud();
  }

  private canBeginGrab(
    attacker: Fighter, defender: Fighter,
    attackerInput: InputState, defenderInput: InputState, defenderJust: InputState,
  ): boolean {
    // The attacker must start upright. The target must be standing or walking:
    // crouches and jumps evade a grab, even on their first input frame.
    // Horizontal input never excludes a defender who is simply walking.
    return !attackerInput.down && !attackerInput.up && !attackerInput.jump &&
      !attackerInput.roll && !attacker.crouching && !attacker.knockedOut &&
      attacker.stunned<=0 && defender.stunned<=0 &&
      !attacker.airborne && !attacker.knockedDown && !attacker.isRolling &&
      !attacker.grabPose && attacker.grabRecovery<=0 &&
      !attacker.isComboRecovering && !attacker.isDuelRecovering &&
      attacker.attack?.name!=='duel' && attacker.attack?.comboStage!==3 &&
      attacker.attack?.name!=='special' &&
      canBeGrabbed(defender, {
        down: defenderInput.down, up: defenderInput.up, jump: defenderJust.jump,
      }) &&
      Math.abs(attacker.x-defender.x)<=GRAB_MAX_START;
  }

  private beginGrab(attacker: Fighter, defender: Fighter): void {
    // The short windup is visible and still allows the defender to react.
    attacker.attack=null;
    attacker.clearCombo();
    attacker.grabPose='reach';
    this.grapple={attacker,defender,phase:'reach',elapsed:0,backWasHeld:false};
    this.onStatus(getCharacter(attacker.id).name+
      ' тягнеться до суперника! Утримуй A+X; суперник може звільнитися A або X.');
    this.combatNotice('GRAB!', (attacker.x+defender.x)/2,290,0xd4b3f5);
  }

  private stopGrab(reason: 'block' | 'counter' | 'released' | 'expired' | 'interrupted'): void {
    const grapple=this.grapple;
    if (!grapple) return;
    const counterDamage=grapple.attacker.breakGrab(reason==='counter');
    if(counterDamage>0) grapple.defender.rewardDamage(counterDamage);
    if(reason==='block') {
      // A defender who guards in time sends the grappler backward, while
      // remaining in place. It is a non-damaging, recoverable shove.
      grapple.attacker.repelBlockedGrab(grapple.defender.x);
      this.spawnSparks((grapple.attacker.x+grapple.defender.x)/2,GROUND_Y-95,true);
    }
    grapple.defender.grabPose=null;
    this.grapple=null;
    const label=reason==='counter'?'COUNTER!':
      reason==='block'?'PUSH BACK!':
      reason==='interrupted'?'INTERRUPT!':
      reason==='released'?'RELEASE!':'ESCAPE!';
    this.combatNotice(label,(grapple.attacker.x+grapple.defender.x)/2,260,
      reason==='counter'?0xffd1a4:0x9cf3eb);
    const status:Record<typeof reason,string>={
      counter:'Захват перервано швидким ударом X! Атакувальний втрачає 3 HP.',
      block:'БЛОК ЗАХВАТУ! Суперник відштовхує атакувального на кілька кроків назад.',
      interrupted:'Захват перервано ударом суперника.',
      released:'Захват відпущено: для кидка треба продовжувати тримати A+X (або L1).',
      expired:'Час на кидок вийшов. Суперник звільнився із захвату.',
    };
    this.onStatus(status[reason]);
  }

  /** Direction is always relative to the thrower's CURRENT opponent-facing side.
   *  A backward diagonal is still backward: up/down MUST NOT jump/crouch.
   */
  private holdingBack(attacker: Fighter, input: InputState): boolean {
    return attacker.face===1 ? input.left && !input.right :
      input.right && !input.left;
  }

  private progressGrab(
    dt: number, input1: InputState, input2: InputState,
    just1: InputState, just2: InputState
  ): void {
    const g=this.grapple;
    if (!g) return;
    const defenderInput=g.defender===this.player1?input1:input2;
    const defenderJust=g.defender===this.player1?just1:just2;
    const attackerInput=g.attacker===this.player1?input1:input2;
    // A+X (or its existing L1 / keyboard grab shortcut) must remain held.
    // Even when a backward+down diagonal sets the roll flag, the raw grip
    // is preserved by Controls so it can be used for a throw instead.
    if (!attackerInput.grab) {
      this.stopGrab('released');
      return;
    }
    const wasFastAttacking=g.defender.attack?.name==='light';
    if (defenderInput.block || defenderJust.light || wasFastAttacking) {
      this.stopGrab(defenderJust.light || wasFastAttacking?'counter':'block');
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
        // A damaging strike is NOT a blocked grab: don't apply an extra push.
        this.stopGrab('interrupted');
        return;
      }
      if(g.elapsed>=GRAB_REACH_TIME) {
        const targetUpright=canBeGrabbed(g.defender,{
          down:defenderInput.down,up:defenderInput.up,jump:defenderJust.jump,
        });
        if(Math.abs(g.attacker.x-g.defender.x)>GRAB_CATCH_RANGE ||
           !targetUpright) {
          // No forced stand-up: crouching/jumping away really avoids capture.
          g.attacker.breakGrab(false);
          this.grapple=null;
          this.onStatus(targetUpright
            ? 'Захват не вдався: суперник відійшов від рук.'
            : 'Захват не вдався: присідання або стрибок дозволили уникнути захоплення.');
          return;
        }
        g.phase='hold';
        g.elapsed=0;
        // If back was held before contact, release and press it again.
        // Otherwise an approach held throughout would auto-throw.
        g.backWasHeld=this.holdingBack(g.attacker,attackerInput);
        g.attacker.grabPose='hold';
        g.defender.grabPose='held';
        this.onStatus('СХОПЛЕНО! Тримай A+X та потягни джойстик НАЗАД. ↖/↙ теж працюють; суперник може вирватися A або X.');
        this.combatNotice('CAUGHT!',(g.attacker.x+g.defender.x)/2,255,0xffd4ad);
      }
      return;
    }

    // Both fighters are rooted and upright for the entire hold and throw.
    // stepGrapple intentionally ignores jump and crouch inputs, allowing
    // backward+UP and backward+DOWN as two ways to issue the SAME overhead throw.
    g.defender.x=Phaser.Math.Clamp(g.attacker.x+g.attacker.face*47,STAGE_MIN_X+4,STAGE_MAX_X-4);
    g.attacker.stepGrapple(dt,g.defender.x);
    g.defender.stepGrapple(dt,g.attacker.x);

    const backNow=this.holdingBack(g.attacker,attackerInput);
    const newPull=backNow && !g.backWasHeld;
    g.backWasHeld=backNow;
    if (newPull) {
      const face=g.attacker.face;
      const throwDamage=g.attacker.throwDamage;
      const actualDamage=g.defender.receiveThrow(throwDamage,face);
      g.attacker.rewardDamage(actualDamage);
      g.attacker.grabPose='throw';
      g.attacker.grabRecovery=.40;
      g.defender.grabPose=null;
      this.spawnSparks(g.defender.x,GROUND_Y-110,false);
      this.cameras.main.shake(120,.006);
      this.combatNotice('THROW!',g.defender.x,240,0xffd29b);
      this.onStatus(getCharacter(g.attacker.id).name+
        ' перекидає суперника через себе! -'+throwDamage+' HP.'+
        (g.defender.knockedOut ? ' Нокаут: суперник не підводиться!' :
        ' Падіння, 0,5 с лежачи й 0,5 с підйому.'));
      this.grapple=null;
    } else if (g.elapsed >= GRAB_HOLD_TIMEOUT) {
      this.stopGrab('expired');
    }
  }

  /** Wait for the entire challenge strike animation, not just its hitbox. */
  private advancePendingDuel(): void {
    const pending=this.duelPending;
    if(!pending)return;
    // Contact is not enough: target must remain standing or walking
    // throughout the follow-through. Any crouch, jump, block, strike, roll,
    // grab, stun or knockdown turns this pending duel into a true miss.
    // Once invalidated it cannot magically reconnect on a later frame.
    pending.connected=pending.connected && pending.defender.isDuelTargetEligible;
    if(pending.attacker.takeDuelStarterFinished()) {
      this.duelPending=null;
      if(pending.connected && !pending.attacker.knockedOut &&
         !pending.defender.knockedOut && !pending.attacker.knockedDown &&
         !pending.defender.knockedDown && pending.attacker.stunned<=0) {
        this.beginDuel(pending.attacker,pending.defender);
      } else {
        pending.attacker.duelStarterMiss();
        this.combatNotice('DUEL WHIFF!',pending.attacker.x,GROUND_Y-190,0xd6bcff);
        this.onStatus('Виклик не вдався. Після повного замаху Y нападник відпочиває 0,3 секунди.');
      }
    } else if(!pending.attacker.isDuelStarting) {
      // Interrupting the swing before the full animation forfeits the duel.
      this.duelPending=null;
    }
  }

  /** Zero-damage Y-height challenge connected, despite any ordinary guard. */
  private beginDuel(attacker: Fighter, defender: Fighter): void {
    if(this.duel || this.grapple) return;
    attacker.duelStarterConnected();
    // Both fighters must enter with NO pending attack/animation or a paused
    // strike could reappear immediately after the showdown.
    defender.duelStarterConnected();
    this.duel={
      attacker,defender,elapsed:0,choices:[null,null],
      previous:[this.prev1,this.prev2],
    };
    this.centerLabel.setText('DUEL!').setColor('#f9c5ff').setVisible(true);
    this.combatNotice('DUEL!',(attacker.x+defender.x)/2,GROUND_Y-210,0xf4aaff);
    this.onStatus('ДУЕЛЬ! 2 секунди на таємний вибір: X, Y або B. Захисник може натиснути A. Бій завмер!');
  }

  /** Only input polling and a visible two-second stripe advance here.
   * Fighters, gravity, stage timer, attacks and CPU locomotion are frozen.
   * Each selection is locked on its first NEW press and never displayed.
   */
  private stepDuel(dt: number): void {
    const duel=this.duel;
    if(!duel)return;
    const p1=this.controls.read(0);
    const p2=this.mode==='cpu'?emptyInput():this.controls.read(1);
    const j1=justPressed(p1,duel.previous[0]);
    const j2=justPressed(p2,duel.previous[1]);
    duel.previous=[p1,p2];
    this.prev1=p1;this.prev2=p2;
    if(duel.choices[0]===null) {
      duel.choices[0]=chooseDuelInput(j1,duel.defender===this.player1);
    }
    if(this.mode==='versus' && duel.choices[1]===null) {
      duel.choices[1]=chooseDuelInput(j2,duel.defender===this.player2);
    }
    duel.elapsed=Math.min(DUEL_DURATION,duel.elapsed+dt);
    if(this.mode==='cpu' && duel.choices[1]===null && duel.elapsed>=.32) {
      const pool: DuelChoice[] = duel.defender===this.player2
        ? ['light','heavy','kick','block'] : ['light','heavy','kick'];
      duel.choices[1]=pool[Math.floor(Math.random()*pool.length)];
    }
    if(duel.elapsed>=DUEL_DURATION) this.resolveDuelChoices(duel);
  }

  /** Reveal no selections during the timer. Once it expires, both players
   * perform their selected strike simultaneously, even when one will lose.
   * Only at the END of this short cinematic do we apply the winning hit.
   */
  private resolveDuelChoices(duel: DuelSession): void {
    if(this.duel!==duel)return;
    this.duel=null;
    this.centerLabel.setVisible(false);
    const aIndex=duel.attacker===this.player1?0:1;
    const attackerChoice=duel.choices[aIndex];
    const defenderChoice=duel.choices[1-aIndex];
    this.duelAftermath={
      attacker:duel.attacker,defender:duel.defender,
      attackerChoice,defenderChoice,elapsed:0,
    };
    if(attackerChoice && attackerChoice!=='block') {
      duel.attacker.showDuelResultStrike(attackerChoice);
    }
    if(defenderChoice==='block') duel.defender.showDuelResultGuard();
    else if(defenderChoice) duel.defender.showDuelResultStrike(defenderChoice);
    // Decisions become visible through each fighter's animation, NEVER
    // during the two-second secret selection.
    this.onStatus('ВИБІР ЗРОБЛЕНО! Бійці виконують удари одночасно…');
  }

  private stepDuelAftermath(dt: number): void {
    const result=this.duelAftermath;
    if(!result)return;
    result.elapsed=Math.min(DUEL_RESULT_ANIMATION,result.elapsed+dt);
    // No movement, gravity, special-meter gain or damage while both
    // selected moves play at the same time.
    result.attacker.stepDuelResultPose(dt);
    result.defender.stepDuelResultPose(dt);
    if(result.elapsed>=DUEL_RESULT_ANIMATION) this.finishDuelAftermath(result);
  }

  private finishDuelAftermath(aftermath: DuelAftermath): void {
    if(this.duelAftermath!==aftermath)return;
    this.duelAftermath=null;
    aftermath.attacker.endDuelResultPose();
    aftermath.defender.endDuelResultPose();
    // Avoid stale edges from secretly held buttons becoming attacks after
    // the cinematic. The next press must be a NEW button press.
    this.prev1=this.controls.read(0);
    this.prev2=this.mode==='cpu'?emptyInput():this.controls.read(1);

    const {attacker,defender,attackerChoice,defenderChoice}=aftermath;
    const result=resolveDuel(attackerChoice,defenderChoice);

    if(result==='guard') {
      // Defender A produces both a powerful backward shove and 0.5 s of
      // true hitstun. Attacker cannot block, attack, move, roll or re-challenge.
      attacker.duelRecoil(defender.x,DUEL_GUARD_PUSH);
      attacker.stunFromDuelGuard(DUEL_GUARD_STUN);
      this.combatNotice('DUEL BLOCK!',attacker.x,GROUND_Y-210,0x95eafb);
      this.combatNotice('STUN 0.5s!',attacker.x,GROUND_Y-260,0xffb56a);
      this.spawnSparks((attacker.x+defender.x)/2,GROUND_Y-105,true);
      this.onStatus(getCharacter(defender.id).name+
        ' ставить блок у дуелі! Нападника сильно відкинуто й оглушено на 0,5 секунди. HP не змінюється.');
      return;
    }
    if(result==='tie') {
      attacker.duelRecoil(defender.x,DUEL_TIE_PUSH);
      defender.duelRecoil(attacker.x,DUEL_TIE_PUSH);
      this.combatNotice('DUEL CLASH!',480,GROUND_Y-230,0xffdcaf);
      this.spawnSparks((attacker.x+defender.x)/2,GROUND_Y-98,true);
      this.onStatus('Нічия в дуелі! Обидві однакові атаки вже зіграли, тепер бійців розштовхує без шкоди.');
      return;
    }

    const winner=result==='attacker'?attacker:defender;
    const loser=result==='attacker'?defender:attacker;
    const choice=result==='attacker'?attackerChoice:defenderChoice;
    // resolveDuel guarantees an actual strike for the winner.
    const move=(choice==='light'||choice==='heavy'||choice==='kick'?choice:'heavy') as DuelStrike;
    const base=ATTACKS[move];
    const hit=loser.receiveHit({
      ...base,damage:duelDamage(winner.id==='runa'),stun:.5,push:430,
    },winner.face,true);
    winner.rewardDamage(hit.damage);
    winner.gainSplash(SPLASH_DUEL_WIN_GAIN);
    this.cameras.main.shake(165,.008);
    this.spawnSparks(loser.x,GROUND_Y-103,false);
    this.combatNotice('DUEL WIN!',loser.x,GROUND_Y-240,0xffd18c);
    this.onStatus(getCharacter(winner.id).name+' виграє дуель ('+
      (move==='heavy'?'Y':move==='light'?'X':'B')+
      ') і завдає '+hit.damage+' HP! Обидві анімації були показані, але шкоду отримав лише програвший.'+
      (loser.knockedOut?' НОКАУТ!':''));
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
    if(this.grapple?.attacker===this.player2) {
      // CPU must obey the very same two-stage input rule as a human:
      // keep its grip, then make a NEW backward motion after the catch.
      input.grab=true;
      if (this.grapple.phase==='hold' && this.grapple.elapsed>.24) {
        input[this.player2.face===1?'left':'right']=true;
        // Occasionally use a diagonal. Throwing remains ground-only.
        if (this.aiCount%3===0) input.up=true;
        else if (this.aiCount%3===1) input.down=true;
      }
      return input;
    }
    if(this.grapple?.defender===this.player2) {
      // The CPU sometimes reacts in time, but not on every attempt.
      if (this.grapple.phase==='hold' && this.grapple.elapsed>.22 &&
          this.aiCount%3!==0) input.block=true;
      return input;
    }
    if(this.player2.stunned>0||this.player2.knockedOut||this.player2.knockedDown ||
       this.player2.isComboRecovering||this.player2.isDuelRecovering)return input;
    // CPU occasionally links a completed hit into a valid X/B/Y chain.
    // Read options only after impact; inputs remain single-frame presses.
    const followUps=this.player2.comboOptions;
    if(followUps.length>0 && distance<185 && this.aiCount%3!==1) {
      input[followUps[this.aiCount%followUps.length]]=true;
      return input;
    }
    if(distance>130)input[forward]=true;
    else if(distance<75 && this.aiCount%5===0)input.block=true;
    if(distance<160 && this.player1.attack && this.aiCount%4===0) {
      const incoming=this.player1.attack.spec.level;
      // CPU considers the strike's real height when deciding its defense.
      if(incoming==='high' && this.aiCount%3===0) {
        input.block=false;
        input.down=true; // duck beneath a high attack.
      } else {
        input.block=true;
        input.down=incoming==='low'; // standing A loses against low X.
      }
    }
    // The CPU cannot advance while guarding/crouching. Backward motion
    // can be combined with down, preserving the low-guard stance.
    if (input.block || input.down) {
      input[forward]=false;
      const backward=forward==='left'?'right':'left';
      if (input.block && distance<135 && this.player1.attack) input[backward]=true;
    }
    this.aiCooldown-=dt;
    if(this.aiCooldown<=0){
      this.aiCount++;
      this.aiCooldown=.52+((this.aiCount*17)%9)*.09;
      if(distance<220 && this.player2.splashEnergy>=100 && this.aiCount%4===0){
        // CPU spends its slow, combo/duel-only splash gauge sparingly.
        input.block=false;input.down=false;input[forward]=false;
        input.up=true;input.splash=true;
      } else if(distance<115 && this.aiCount%6===3) input.grab=true;
      else if(distance<130 && this.aiCount%8===2) {
        input.block=false;input.down=false;input[forward]=true;
        input.duel=true; // CPU may challenge an opponent as well.
      }
      else if(distance<210 && this.player2.energy>=40 && this.aiCount%5===0) {
        input.block=false;input.down=false;input[forward]=true;
        input.special=true;
      }
      else if(distance<141 && !input.block) {
        const choice=this.aiCount%7;
        if(choice===0 && distance<116) {
          // The AI occasionally uses the same crouched trip as the player.
          input.down=true;input.kick=true;
        } else if(choice===1 && distance<108) {
          input.down=true;input.light=true; // weak mid crouch jab.
        } else if(choice===2 || choice===3) input.light=true;
        else if(choice===4 || choice===5) input.kick=true;
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

  private resolveFrameStrikes(): void {
    const first=this.player1,second=this.player2;
    // Capture both before either can clear the rival's attack with hitstun.
    const strike1=first.getActiveStrike();
    const strike2=second.getActiveStrike();
    const box1=strike1?first.strikeBox():null;
    const box2=strike2?second.strikeBox():null;
    const attempt1: ClashAttempt | null = strike1 ? {
      name:strike1.name,strikeBox:box1,rivalBody:second.bodyBox(),
      rivalKnockedOut:second.knockedOut,rivalKnockedDown:second.knockedDown,
      rivalRollInvulnerable:second.isRollInvulnerable,
      rivalAirborne:second.airborne,
    } : null;
    const attempt2: ClashAttempt | null = strike2 ? {
      name:strike2.name,strikeBox:box2,rivalBody:first.bodyBox(),
      rivalKnockedOut:first.knockedOut,rivalKnockedDown:first.knockedDown,
      rivalRollInvulnerable:first.isRollInvulnerable,
      rivalAirborne:first.airborne,
    } : null;
    if(strike1 && strike2 && isSimultaneousClash(attempt1,attempt2)) {
      // Both hitboxes contact their respective hurtboxes on this SAME 60Hz
      // frame: force two blocks, never deal damage, reward meter or trip.
      // Even a previously unblockable combo finisher is deflected by the
      // *other incoming strike*, not by an ordinary A guard.
      strike1.connected=true;
      strike2.connected=true;
      first.deflectSimultaneousStrike(strike2.spec,second.face);
      second.deflectSimultaneousStrike(strike1.spec,first.face);
      first.recordComboImpact(strike1,true,true,0);
      second.recordComboImpact(strike2,true,true,0);
      const middle=(first.x+second.x)/2;
      this.spawnSparks(middle,GROUND_Y-98,true);
      this.combatNotice('CLASH!',middle,GROUND_Y-205,0x88f5f2);
      this.cameras.main.shake(65,.002);
      this.onStatus('ЗІТКНЕННЯ УДАРІВ! Обидві атаки заблоковані одночасно: 0 HP, 0 енергії.');
      return;
    }
    // Non-mutual strikes still resolve normally, but both snapshot attacks
    // are consumed even if the first attack interrupts the second fighter.
    this.resolveStrike(first,second,strike1,box1);
    if(!this.duel) this.resolveStrike(second,first,strike2,box2);
  }

  private resolveStrike(attacker: Fighter,target: Fighter,
    strike: ActiveAttack | null = attacker.getActiveStrike(),
    box: ClashRect | null = attacker.strikeBox()): void {
    if(!strike)return;
    // Consume the one impact frame even if the attack misses. Otherwise a
    // whiff could "hit late" during follow-through and become unavoidable.
    strike.connected=true;
    if(strike.name==='duel') {
      // Zero-damage, unblockable hitbox: contact is recorded here, but
      // neither the duel nor miss recovery starts before full Y follow-through.
      const connects=Boolean(box && target.isDuelTargetEligible &&
        !target.isRollInvulnerable && overlap(box,target.bodyBox()));
      if(!this.duelPending) this.duelPending={
        attacker,defender:target,connected:connects,
      };
      return;
    }
    if(target.knockedOut||target.knockedDown||!box) {
      attacker.recordComboImpact(strike,false,false,0);
      return;
    }
    // A ground-level leg sweep cannot trip an airborne opponent.
    if(strike.name==='sweep' && target.airborne) {
      attacker.recordComboImpact(strike,false,false,0);
      return;
    }
    const hurt=target.bodyBox();
    if(!overlap(box,hurt)) {
      attacker.recordComboImpact(strike,false,false,0);
      // The high hitbox ends ABOVE crouching hurtboxes. Even an unguarded
      // crouch slips beneath Y, so this is a true miss, not a blocked hit.
      if(strike.spec.level==='high' && target.crouching &&
         box.x<hurt.x+hurt.w && box.x+box.w>hurt.x) {
        this.combatNotice('WHIFF!',target.x,GROUND_Y-150,0xa3d7ff);
        this.onStatus('Верхній удар пройшов над присілим суперником!');
      }
      return;
    }
    if(target.isRollInvulnerable) {
      attacker.recordComboImpact(strike,false,false,0);
      this.combatNotice('DODGE!',target.x,GROUND_Y-152,0x9aeefb);
      return; // No damage or energy reward during the roll's evasion window.
    }
    // Only a third strike PREPARED by two successful unblocked hits
    // ignores guard. It must still genuinely overlap the target's hurtbox.
    const unblockable=attacker.isUnblockableFinisher(strike);
    const failedHighGuard=target.guardStance==='standing' && strike.spec.level==='low';
    const hit=target.receiveHit(strike.spec,attacker.face,unblockable);
    const comboHits=attacker.recordComboImpact(strike,true,hit.blocked,hit.damage);
    const sweepLanded=sweepTrips(strike.name,hit.blocked,target.airborne,target.knockedOut);
    if(sweepLanded) {
      // Only a real low hit trips: crouch block, roll invulnerability,
      // jumping and out-of-range opponents never fall.
      target.receiveSweep(attacker.face);
      this.combatNotice('SWEEP!',target.x,GROUND_Y-143,0xffd596);
    }
    attacker.rewardDamage(hit.damage);
    attacker.gainSplash(comboSplashBonus(comboHits));
    if(comboHits===2) {
      this.combatNotice('2 HIT!',target.x,GROUND_Y-206,0x8ce9fa);
    } else if(comboHits===3) {
      this.combatNotice('3 HIT COMBO!',target.x,GROUND_Y-206,0xffce77);
    }
    if(unblockable && hit.damage>0) {
      this.combatNotice('UNBLOCKABLE!',target.x,GROUND_Y-252,0xff9fab);
    }
    this.spawnSparks(target.x,GROUND_Y+target.yOffset-(strike.spec.level==='low'?37:85),hit.blocked);
    if(hit.interrupted) {
      this.combatNotice('INTERRUPT!',target.x,GROUND_Y+target.yOffset-173,0xffd898);
    }
    if(!hit.blocked && failedHighGuard && !sweepLanded) {
      this.combatNotice('LOW HIT!',target.x,GROUND_Y-152,0xffd080);
    }
    if(!hit.blocked)this.cameras.main.shake(sweepLanded?105:75,sweepLanded?.004:.003);
    const level=HIT_LEVEL_NAMES[strike.spec.level];
    this.onStatus(comboHits===3
      ? getCharacter(attacker.id).name+' завершує 3-ударне комбо! Третій удар неможливо заблокувати. -'+hit.damage+' HP.'
      :hit.blocked
        ? getCharacter(target.id).name+' блокує '+level+' атаку! Шкоди немає.'
      :sweepLanded
        ? getCharacter(attacker.id).name+' виконує підсічку! -'+hit.damage+
          ' HP, '+getCharacter(target.id).name+' падає на землю.'
        :getCharacter(attacker.id).name+' влучає ('+level+' атака)! -'+hit.damage+
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
    if(this.roundOver)return;
    this.roundOver=true;
    const winnerIndex:0|1|null=this.player1.hp===this.player2.hp?null:
      this.player1.hp>this.player2.hp?0:1;
    const result=awardRound({wins:this.matchWins,roundsPlayed:this.roundsPlayed},winnerIndex);
    this.matchWins=result.wins;
    this.roundsPlayed=result.roundsPlayed;
    this.matchWinner=result.matchWinner;
    this.roundTransition=2.8;

    if(winnerIndex!==null){
      const victor=winnerIndex===0?this.player1:this.player2;
      const loser=winnerIndex===0?this.player2:this.player1;
      // On timeout, a standing loser must visibly fall before the next round.
      if(!loser.knockedDown)loser.startDefeatFall(victor.face);
    }
    const label=winnerIndex===null?'DRAW!':this.matchWinner!==null
      ?getCharacter((this.matchWinner===0?this.player1:this.player2).id).name+' CHAMPION!'
      :getCharacter((winnerIndex===0?this.player1:this.player2).id).name+' WINS!';
    this.centerLabel.setText(label).setColor('#ffe5a4').setVisible(true);
    this.onStatus(this.matchWinner!==null
      ?label+' Матч завершено: '+this.matchWins.join(':')+
        '. У меню можна почати новий матч.'
      :winnerIndex===null
        ?'Нічия! Раунд буде переграно. Заряд сплешу збережено.'
        :'Раунд '+this.roundsPlayed+' завершено! Рахунок '+
          this.matchWins.join(':')+'. Далі раунд '+result.roundNumber+
          '. SPLASH залишається.');
  }

  private paintHud(): void {
    if(!this.hud)return;
    this.hud.clear();
    // Leave room for the portraits at both outer edges.
    const left=112-this.extraHalf;
    const right=548+this.extraHalf;
    // Each roster fighter contributes their own HUD color, including Lyra.
    this.drawHealth(left,55,this.player1.hp,this.healthTrail1.displayed,
      Number.parseInt(getCharacter(this.player1.id).color.slice(1),16),false);
    this.drawHealth(right,55,this.player2.hp,this.healthTrail2.displayed,
      Number.parseInt(getCharacter(this.player2.id).color.slice(1),16),true);
    this.drawEnergy(left,82,this.player1.energy,0xa18afa);
    this.drawEnergy(right,82,this.player2.energy,0xa18afa);
    const p1Color=Number.parseInt(getCharacter(this.player1.id).color.slice(1),16);
    const p2Color=Number.parseInt(getCharacter(this.player2.id).color.slice(1),16);
    this.drawSplashMeter(left,492,this.player1.splashEnergy,p1Color);
    this.drawSplashMeter(right+100,492,this.player2.splashEnergy,p2Color);
    this.splashLabel1.setText(this.player1.splashEnergy>=100?'SPLASH READY!':'SPLASH');
    this.splashLabel2.setText(this.player2.splashEnergy>=100?'SPLASH READY!':'SPLASH');
    // Two victory pips at each side; no round is awarded for a draw.
    for(let i=0;i<2;i++){
      const x1=left+284-i*22,x2=right+16+i*22;
      this.hud.fillStyle(i<this.matchWins[0]?p1Color:0x171a2e,.96).fillCircle(x1,36,8);
      this.hud.fillStyle(i<this.matchWins[1]?p2Color:0x171a2e,.96).fillCircle(x2,36,8);
      this.hud.lineStyle(2,0xf5e8d9,.75).strokeCircle(x1,36,8).strokeCircle(x2,36,8);
    }
    if(this.duel) {
      // Full viewport width under both HUD bars; fills from both edges
      // toward the center as the two-second decision window closes.
      const full=960+this.extraHalf*2;
      const remaining=full*Math.max(0,1-this.duel.elapsed/DUEL_DURATION);
      const x=480-full/2, y=107, h=25;
      this.hud.fillStyle(0x17172e,.96).fillRect(x,y,full,h);
      this.hud.fillStyle(0xf2a5ff,.92).fillRect(480-remaining/2,y,remaining,h);
      this.hud.lineStyle(2,0xe6d0fd,.82).strokeRect(x,y,full,h);
      this.hud.lineStyle(2,0xffffff,.9).lineBetween(480,y,480,y+h);
    }
    this.timeLabel.setText(String(Math.ceil(this.roundTime)));
  }

  private drawHealth(x:number,y:number,hp:number,trailHp:number,color:number,right:boolean): void {
    const w=300,h=19;
    this.hud.fillStyle(0x111326,.94).fillRoundedRect(x-4,y-4,w+8,h+8,6);
    this.hud.fillStyle(0x4d314f).fillRect(x,y,w,h);
    // Two physical layers: red = health BEFORE the latest hit; the live
    // fighter-colored bar covers its surviving portion. Both use the same
    // anchor, so P1 shows lost health on its right, P2 on its left.
    const trail=healthFillRect(x,w,trailHp/MAX_HEALTH*100,right);
    this.hud.fillStyle(0xf34b55,.95).fillRect(trail.x,y,trail.width,h);
    const live=healthFillRect(x,w,hp/MAX_HEALTH*100,right);
    this.hud.fillStyle(color).fillRect(live.x,y,live.width,h);
    this.hud.fillStyle(0xffffff,.2).fillRect(live.x,y,live.width,4);
    this.hud.lineStyle(2,0xc7abc1,.7).strokeRoundedRect(x-4,y-4,w+8,h+8,6);
  }
  private drawEnergy(x:number,y:number,power:number,color:number): void {
    const w=300;
    this.hud.fillStyle(0x14162a).fillRect(x,y,w,8);
    this.hud.fillStyle(color).fillRect(x,y,w*Math.min(100,power)/100,8);
    this.hud.fillStyle(0xd6cbff).fillRect(x+w*SPECIAL_METER_COST/100-1,y,2,8);
    this.hud.lineStyle(1,0x827caa).strokeRect(x,y,w,8);
  }

  private drawSplashMeter(x:number,y:number,power:number,color:number):void {
    const w=200,h=8;
    this.hud.fillStyle(0x11152b,.93).fillRoundedRect(x-3,y-3,w+6,h+6,4);
    this.hud.fillStyle(0x243547,.92).fillRect(x,y,w,h);
    this.hud.fillStyle(color,power>=100?1:.92)
      .fillRect(x,y,w*Math.max(0,Math.min(100,power))/100,h);
    this.hud.lineStyle(1,power>=100?0xffffff:0x658d9c,.85)
      .strokeRoundedRect(x-3,y-3,w+6,h+6,4);
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
