import Phaser from 'phaser';
import { Controls, emptyInput, type InputState } from '../input/Controls';
import { Fighter, GROUND_Y } from '../combat/Fighter';

type GameMode = 'cpu' | 'versus';
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
  private readyTime = 1.5;
  private roundTime = 99;
  private roundOver = false;
  private accumulator = 0;
  private aiCooldown = .85;
  private aiCount = 0;
  private frameCount = 0;

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
    this.add.text(39,11,'EVI',labelStyle).setDepth(21);
    this.add.text(918,11,'NARA',labelStyle).setOrigin(1,0).setDepth(21);
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
    this.paintHud();
    this.onStatus('Готово! Еві проти Нари. Рух: WASD, удари: J/K/U/I.');
  }

  private drawStage(): void {
    const g=this.add.graphics().setDepth(-10);
    for(let y=0;y<540;y+=7){
      const ratio=y/540;
      const r=Math.floor(11+ratio*22), gr=Math.floor(16+ratio*10), b=Math.floor(39+ratio*42);
      g.fillStyle((r<<16)|(gr<<8)|b).fillRect(0,y,960,7);
    }
    g.fillStyle(0xc8a2d0,.24).fillCircle(490,138,91);
    g.fillStyle(0xebcade,.25).fillCircle(490,138,57);
    g.lineStyle(3,0xa775c4,.5).strokeCircle(490,138,100);
    // Distant towers and lit windows, deterministic so the arena is reproducible.
    for(let i=0;i<21;i++){
      const x=i*49-14;
      const h=65+(i*61%130);
      g.fillStyle(i%2?0x22243c:0x1b233e,.95).fillRect(x,373-h,42,h);
      g.fillStyle(i%3?0xbb739c:0x5fc7c6,.55);
      for(let yy=383-h;yy<357;yy+=16){
        for(let xx=x+7;xx<x+38;xx+=12) if((xx+yy+i)%4!==0)g.fillRect(xx,yy,4,6);
      }
    }
    g.fillStyle(0x121a32).fillRect(0,373,960,74);
    g.lineStyle(2,0xcd6fbd,.7).lineBetween(0,374,960,374);
    for(let i=0;i<17;i++){
      const x=i*62;
      g.fillStyle(0x283f5c,.7).fillRoundedRect(x,352,24,75,8);
      g.fillStyle(0xee90bb,.6).fillRect(x+9,345,6,8);
    }
    // Fighting platform
    g.fillStyle(0x20263a).fillRect(0,GROUND_Y,960,97);
    g.fillStyle(0x434966).fillRect(0,GROUND_Y,960,5);
    g.fillStyle(0xc28cb6,.8).fillRect(0,GROUND_Y+5,960,2);
    g.lineStyle(2,0x66789e,.37);
    for(let i=0;i<19;i++){
      g.lineBetween(i*70-155,540,i*50+80,GROUND_Y+8);
    }
    for(let y=GROUND_Y+25;y<540;y+=24)g.lineBetween(0,y,960,y);
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
    if(this.roundOver)return;
    this.roundTime=Math.max(0,this.roundTime-dt);
    const input1=this.controls.read(0);
    const input2=this.mode==='cpu'?this.cpuInput(dt):this.controls.read(1);
    const just1=justPressed(input1,this.prev1);
    const just2=justPressed(input2,this.prev2);
    this.prev1=input1;this.prev2=input2;
    this.evi.step(dt,input1,just1,this.nara.x);
    this.nara.step(dt,input2,just2,this.evi.x);
    this.preventOverlap();
    this.resolveStrike(this.evi,this.nara);
    this.resolveStrike(this.nara,this.evi);

    if(this.evi.knockedOut||this.nara.knockedOut||this.roundTime<=0){
      this.finishRound();
    }
  }

  private cpuInput(dt: number): InputState {
    const input=emptyInput();
    const distance=Math.abs(this.evi.x-this.nara.x);
    const forward=this.evi.x>this.nara.x?'right':'left';
    if(this.nara.stunned>0||this.nara.knockedOut)return input;
    if(distance>130)input[forward]=true;
    else if(distance<75 && this.aiCount%5===0)input.block=true;
    if(distance<160 && this.evi.attack && this.aiCount%4===0) input.block=true;
    this.aiCooldown-=dt;
    if(this.aiCooldown<=0){
      this.aiCount++;
      this.aiCooldown=.52+((this.aiCount*17)%9)*.09;
      if(distance<210 && this.nara.energy>=40 && this.aiCount%5===0)input.special=true;
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
    const dx=this.nara.x-this.evi.x;
    if(Math.abs(dx)>=51)return;
    const sign=dx>=0?1:-1;
    const middle=(this.evi.x+this.nara.x)/2;
    this.evi.x=Phaser.Math.Clamp(middle-sign*26,62,898);
    this.nara.x=Phaser.Math.Clamp(middle+sign*26,62,898);
  }

  private resolveStrike(attacker: Fighter, target: Fighter): void {
    const strike=attacker.getActiveStrike();
    if(!strike||target.knockedOut)return;
    const box=attacker.strikeBox();
    if(!box||!overlap(box,target.bodyBox()))return;
    strike.connected=true;
    const hit=target.receiveHit(strike.spec,attacker.face);
    attacker.rewardHit(strike.spec);
    this.spawnSparks(target.x,GROUND_Y+target.yOffset-85,hit.blocked);
    if(!hit.blocked)this.cameras.main.shake(75,.003);
    this.onStatus(hit.blocked?'Блок!':attacker.id==='evi'
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
    this.roundOver=true;
    const winner=this.evi.hp===this.nara.hp?'DRAW!'
      :this.evi.hp>this.nara.hp?'EVI WINS!':'NARA WINS!';
    this.centerLabel.setText(winner).setColor('#ffe5a4').setVisible(true);
    this.onStatus(winner+' Натисни «Новий раунд» або R для повтору.');
  }

  private paintHud(): void {
    if(!this.hud)return;
    this.hud.clear();
    this.drawHealth(39,55,this.evi.hp,0xe78fb9,false);
    this.drawHealth(571,55,this.nara.hp,0x69d6d2,true);
    this.drawEnergy(39,82,this.evi.energy,0xa18afa);
    this.drawEnergy(571,82,this.nara.energy,0xa18afa);
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
    for(const fighter of [this.evi,this.nara]){
      const rect=fighter.bodyBox();
      this.debugDraw.lineStyle(2,0x56f3a4,.9).strokeRect(rect.x,rect.y,rect.w,rect.h);
      const strike=fighter.strikeBox();
      if(strike)this.debugDraw.lineStyle(2,0xff5575,.95).strokeRect(strike.x,strike.y,strike.w,strike.h);
    }
  }
}
