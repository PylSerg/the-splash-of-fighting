import Phaser from 'phaser';
import type { InputState } from '../input/Controls';

export type FighterId = 'evi' | 'nara';
export type AttackName = 'light' | 'heavy' | 'kick' | 'special';
export interface AttackSpec {
  duration: number;
  startup: number;
  activeEnd: number;
  reach: number;
  damage: number;
  stun: number;
  push: number;
  gain: number;
}
export interface ActiveAttack { name: AttackName; spec: AttackSpec; elapsed: number; connected: boolean; }
export const GROUND_Y = 443;
export const STAGE_MIN_X = 60;
export const STAGE_MAX_X = 900;

export const ATTACKS: Record<AttackName, AttackSpec> = {
  light: { duration: .27, startup: .065, activeEnd: .145, reach: 92, damage: 5, stun: .18, push: 110, gain: 7 },
  heavy: { duration: .48, startup: .17, activeEnd: .26, reach: 116, damage: 11, stun: .32, push: 185, gain: 12 },
  kick: { duration: .40, startup: .13, activeEnd: .23, reach: 135, damage: 9, stun: .27, push: 150, gain: 10 },
  special: { duration: .82, startup: .24, activeEnd: .44, reach: 205, damage: 20, stun: .40, push: 290, gain: 0 },
};

export class Fighter {
  readonly id: FighterId;
  x: number;
  yOffset = 0;
  vy = 0;
  face: 1 | -1;
  hp = 100;
  energy = 50;
  stunned = 0;
  blocking = false;
  crouching = false;
  walking = false;
  attack: ActiveAttack | null = null;
  hitFlash = 0;
  private impactVelocity = 0;
  // A short chord window prevents B and Y being mistaken for separate
  // kick/heavy attacks when the player presses them nearly together.
  private queuedSolo: { name: 'kick' | 'heavy'; remaining: number } | null = null;
  private queuedSpecial = 0;
  private time = 0;

  readonly rig: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Ellipse;
  private cape: Phaser.GameObjects.Graphics;
  private leftLeg: Phaser.GameObjects.Graphics;
  private rightLeg: Phaser.GameObjects.Graphics;
  private frontArm: Phaser.GameObjects.Graphics;
  private backArm: Phaser.GameObjects.Graphics;
  private body: Phaser.GameObjects.Graphics;
  private head: Phaser.GameObjects.Graphics;
  private hair: Phaser.GameObjects.Graphics;
  private weapon: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, id: FighterId, initialX: number, face: 1 | -1) {
    this.id = id;
    this.x = initialX;
    this.face = face;
    const evi = id === 'evi';
    const skin = evi ? 0xe1a77f : 0xdba3a0;
    const cloth = evi ? 0xf7f2eb : 0x282337;
    const edge = evi ? 0xdab875 : 0x8d5c95;

    this.rig = scene.add.container(initialX, GROUND_Y);
    this.shadow = scene.add.ellipse(0, 5, 90, 17, 0x060c1d, .50);
    this.cape = scene.add.graphics();
    this.backArm = scene.add.graphics();
    this.leftLeg = scene.add.graphics();
    this.rightLeg = scene.add.graphics();
    this.body = scene.add.graphics();
    this.weapon = scene.add.graphics();
    this.frontArm = scene.add.graphics();
    this.hair = scene.add.graphics();
    this.head = scene.add.graphics();

    if (evi) {
      this.cape.fillStyle(0xe5e0f0, .72).fillTriangle(-12,-92,-68,-8,16,-34);
      this.cape.lineStyle(2,0xc7a8c8,.9).lineBetween(-12,-92,-68,-8).lineBetween(-68,-8,16,-34);
    } else {
      this.cape.fillStyle(0x2ac9cf,.86);
      this.cape.fillEllipse(-60,-110,125,38);
      this.cape.fillEllipse(-97,-74,92,25);
      this.cape.fillStyle(0x9df7e8,.6).fillEllipse(-75,-116,103,14);
    }
    const drawLeg = (leg: Phaser.GameObjects.Graphics) => {
      leg.fillStyle(cloth).fillRoundedRect(-11,0,22,54,7);
      leg.fillStyle(evi?0xf7f0e4:0x191727).fillRoundedRect(-13,40,25,13,5);
      leg.lineStyle(2,edge).strokeRoundedRect(-11,0,22,54,7);
      if(evi) leg.lineStyle(3,0xe7b881).lineBetween(-7,42,8,48);
    };
    drawLeg(this.leftLeg);
    drawLeg(this.rightLeg);
    this.leftLeg.setPosition(-13,-49);
    this.rightLeg.setPosition(13,-49);

    this.backArm.fillStyle(skin).fillRoundedRect(-7,0,15,48,7);
    this.backArm.fillStyle(cloth).fillRoundedRect(-9,3,18,19,5);
    this.backArm.setPosition(-20,-99);
    this.body.fillStyle(cloth).fillRoundedRect(-24,-105,49,63,12);
    this.body.lineStyle(3,edge).strokeRoundedRect(-24,-105,49,63,12);
    this.body.fillStyle(evi?0xfef9f1:0x5d506d).fillEllipse(0,-89,32,24);
    this.body.fillStyle(evi?0xdab775:0xa6e6ae).fillRect(-15,-60,30,5);

    if (!evi) {
      this.weapon.fillStyle(0x4d3b42).fillRect(-5,-6,89,10);
      this.weapon.fillStyle(0xc0cbd4).fillRoundedRect(61,-33,93,45,8);
      this.weapon.fillStyle(0x8997a5).fillRect(65,-27,86,4);
      this.weapon.lineStyle(3,0x331c36).strokeRoundedRect(61,-33,93,45,8);
      this.weapon.fillStyle(0xa4db68).fillCircle(14,-1,9);
    } else {
      this.weapon.fillStyle(0xffe9a8,.8).fillEllipse(22,3,45,7);
      this.weapon.lineStyle(2,0xffffff,.9).lineBetween(4,4,48,-5);
    }
    this.weapon.setPosition(21,-69);
    this.frontArm.fillStyle(skin).fillRoundedRect(-7,0,15,49,7);
    this.frontArm.fillStyle(cloth).fillRoundedRect(-10,0,19,17,4);
    this.frontArm.fillStyle(evi?0xeac69b:0x201d2f).fillCircle(0,48,8);
    this.frontArm.setPosition(21,-99);

    this.hair.fillStyle(evi?0xe6c38f:0x6fe8e2);
    if (evi) {
      this.hair.fillEllipse(-3,-132,47,44);
      this.hair.fillStyle(0xf7dba8).fillEllipse(-16,-122,15,43);
    } else {
      this.hair.fillEllipse(-22,-154,44,70);
      this.hair.fillEllipse(1,-168,65,58);
      this.hair.fillStyle(0x3dc8d0).fillEllipse(-50,-147,66,22);
    }

    this.head.fillStyle(skin).fillEllipse(0,-125,37,43);
    this.head.fillStyle(0x181727).fillEllipse(10,-128,6,5);
    this.head.fillStyle(evi?0x74c2d4:0xaaff78).fillEllipse(11,-128,3,3);
    if (evi) {
      this.head.lineStyle(2,0x283344).strokeRoundedRect(-16,-136,30,17,5);
      this.head.lineStyle(2,0x283344).lineBetween(14,-128,21,-133);
      this.head.fillStyle(0xa95b62).fillEllipse(9,-115,9,3);
    } else {
      this.head.fillStyle(0xa63e60).fillRect(8,-143,4,11);
      this.head.fillStyle(0x321d2e).fillEllipse(12,-114,11,3);
    }

    this.rig.add([
      this.shadow,this.cape,this.backArm,this.leftLeg,this.rightLeg,
      this.body,this.weapon,this.frontArm,this.hair,this.head
    ]);
    this.draw(0);
  }

  get airborne(): boolean { return this.yOffset < -.1; }
  get knockedOut(): boolean { return this.hp <= 0; }

  reset(x: number, face: 1 | -1): void {
    this.x=x; this.face=face; this.hp=100; this.energy=50;
    this.yOffset=0; this.vy=0; this.stunned=0; this.blocking=false;
    this.crouching=false; this.walking=false; this.attack=null;
    this.hitFlash=0; this.impactVelocity=0; this.time=0;
    this.queuedSolo=null; this.queuedSpecial=0;
    this.draw(0);
  }

  step(dt: number, input: InputState, just: InputState, opponentX: number): void {
    this.time += dt;
    this.face = opponentX >= this.x ? 1 : -1;
    this.hitFlash = Math.max(0, this.hitFlash-dt);
    const knock = this.impactVelocity;
    this.x += knock*dt;
    this.impactVelocity *= Math.pow(.055,dt);
    if (Math.abs(this.impactVelocity)<1) this.impactVelocity=0;

    if (this.knockedOut) { this.draw(dt); return; }
    if (this.stunned>0) this.stunned=Math.max(0,this.stunned-dt);

    if (this.attack) {
      this.attack.elapsed += dt;
      if (this.attack.elapsed >= this.attack.spec.duration) this.attack=null;
    }

    this.crouching = Boolean(input.down && !this.airborne && !this.attack && this.stunned<=0);
    // Blocking is now a deliberate hold on A, not "back" on the joystick.
    // A + down gives a crouching guard. Guarding pauses locomotion.
    this.blocking = Boolean(input.block && !this.airborne && !this.attack && this.stunned<=0);
    let move = Number(input.right)-Number(input.left);
    if (this.crouching || this.stunned>0 || this.blocking) move=0;

    // A stick is a held direction, not a one-frame button press.
    // Reading only just.up loses jumps if the fighter was stunned or airborne
    // when the player first tilted the stick upward. Keep checking the live
    // direction every simulation step and jump as soon as landing/stun allows.
    // A held upward direction will naturally trigger the next jump on landing.
    // The optional keyboard/gamepad jump key still uses a press edge.
    const wantsJump = input.up || just.jump;
    if (this.stunned<=0 && wantsJump && !this.airborne && !this.crouching) {
      this.vy=-490;
      this.yOffset=-.2;
    }
    // A chord can arrive a few frames after the first button. Keep it
    // buffered briefly, with priority above both of its component attacks.
    this.queuedSpecial=Math.max(0,this.queuedSpecial-dt);
    if (just.special) {
      this.queuedSpecial=.22;
      this.queuedSolo=null;
    }
    const canAct=this.stunned<=0 && !this.crouching && !this.blocking;
    if (!canAct) this.queuedSolo=null;

    const canCancelForChord=Boolean(
      this.attack &&
      (this.attack.name==='kick' || this.attack.name==='heavy') &&
      this.attack.elapsed<.22
    );
    if (canAct && this.queuedSpecial>0 && this.energy>=40 &&
        (!this.attack || canCancelForChord)) {
      this.energy-=40;
      this.attack=null;
      this.queuedSolo=null;
      this.queuedSpecial=0;
      this.begin('special');
    } else if (canAct && !this.attack) {
      if (just.light) {
        this.queuedSolo=null;
        this.begin('light');
      } else {
        if (!input.special && !this.queuedSolo) {
          if (just.heavy) this.queuedSolo={name:'heavy',remaining:.075};
          else if (just.kick) this.queuedSolo={name:'kick',remaining:.075};
        }
        if (this.queuedSolo) {
          this.queuedSolo.remaining-=dt;
          if (this.queuedSolo.remaining<=0) {
            const name=this.queuedSolo.name;
            this.queuedSolo=null;
            if (!input.special && this.queuedSpecial<=0) this.begin(name);
          }
        }
      }
    }
    // Regular attacks slow locomotion, but do not disable the joystick.
    // Hitstun and crouching still prevent movement as combat states.
    const moveSpeed = this.blocking ? 90 : this.attack ? 115 : 185;
    this.walking = move!==0 && !this.airborne;
    this.x += move*moveSpeed*dt;
    this.x = Phaser.Math.Clamp(this.x,STAGE_MIN_X,STAGE_MAX_X);
    if(this.airborne || this.vy!==0) {
      this.vy += 1180*dt;
      this.yOffset += this.vy*dt;
      if (this.yOffset>=0) {this.yOffset=0;this.vy=0;}
    }
    this.draw(dt);
  }

  private begin(name: AttackName): void {
    this.attack={name,spec:ATTACKS[name],elapsed:0,connected:false};
  }

  getActiveStrike(): ActiveAttack | null {
    const a=this.attack;
    return a && !a.connected && a.elapsed>=a.spec.startup && a.elapsed<=a.spec.activeEnd?a:null;
  }

  strikeBox(): {x:number;y:number;w:number;h:number} | null {
    const a=this.getActiveStrike();
    if(!a) return null;
    const w=a.spec.reach;
    return {x:this.x+(this.face===1?12-w/8:-12-w*7/8), y:GROUND_Y+this.yOffset-117, w, h:86};
  }

  bodyBox(): {x:number;y:number;w:number;h:number} {
    return {x:this.x-25,y:GROUND_Y+this.yOffset-(this.crouching?73:145),w:50,h:this.crouching?72:142};
  }

  receiveHit(spec: AttackSpec, attackerFace: 1|-1): {damage:number;blocked:boolean} {
    const blocked=this.blocking;
    const damage=blocked?Math.max(1,Math.ceil(spec.damage*.16)):spec.damage;
    this.hp=Math.max(0,this.hp-damage);
    this.energy=Math.min(100,this.energy+(blocked?3:9));
    this.impactVelocity=attackerFace*spec.push*(blocked?.43:1);
    if(!blocked) {
      this.stunned=spec.stun;
      this.attack=null;
      this.queuedSolo=null;
      this.queuedSpecial=0;
      this.hitFlash=.15;
    } else {
      this.stunned=Math.min(.10,spec.stun*.25);
    }
    this.x=Phaser.Math.Clamp(this.x,STAGE_MIN_X,STAGE_MAX_X);
    return {damage,blocked};
  }

  rewardHit(spec: AttackSpec): void {
    this.energy=Math.min(100,this.energy+spec.gain);
  }

  private draw(_dt: number): void {
    const motion=this.walking?Math.sin(this.time*15):Math.sin(this.time*2.5)*.11;
    const swing=this.walking?Math.sin(this.time*15)*.30:0;
    this.leftLeg.rotation=swing;
    this.rightLeg.rotation=-swing;
    this.backArm.rotation=-swing*.5;
    this.frontArm.rotation=swing*.5;
    this.weapon.rotation=.15+motion*.2;
    this.cape.rotation=-motion*.08;
    this.hair.rotation=this.id==='nara'?-motion*.04:0;

    if(this.crouching) {
      this.leftLeg.rotation=.8;this.rightLeg.rotation=-.8;
      this.body.y=24;this.head.y=24;this.hair.y=24;
    } else {
      this.body.y=0;this.head.y=0;this.hair.y=0;
    }
    if(this.attack) {
      const a=this.attack;
      const ratio=a.elapsed/a.spec.duration;
      const recoil=Math.sin(Math.PI*Math.min(1,ratio));
      if(a.name==='kick') this.rightLeg.rotation=-recoil*1.5;
      else this.frontArm.rotation=-recoil*(a.name==='heavy'?2.1:1.25);
      if(a.name==='special') {
        this.frontArm.rotation=-recoil*2.8;
        this.weapon.rotation=-recoil*2.7;
      } else if(a.name==='heavy') this.weapon.rotation=-recoil*1.5;
    }
    if(this.stunned>0) this.frontArm.rotation=-.5;
    this.rig.setPosition(this.x,GROUND_Y+this.yOffset);
    this.rig.setScale(this.face,1);
    this.rig.alpha=this.knockedOut ? .65 : 1;
    if(this.hitFlash>0) this.body.setAlpha(.45);
    else this.body.setAlpha(1);
    this.shadow.setScale(this.airborne?Math.max(.45,1+this.yOffset/500):1,1);
  }
}
