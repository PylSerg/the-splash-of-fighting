import Phaser from 'phaser';
import type { InputState } from '../input/Controls';
import { stopsHit, strikeBand, strikeDamage, canAutoTurn, STANDING_ATTACK_LANES, type HitLevel, type GuardStance } from './HitRules';
import { crouchMoveForPress } from './CrouchRules';
import { blockedGrabRecoil } from './GrabRules';
import { earnSpecialMeter, MAX_HEALTH } from './CombatFeedback';
import { scaleDamage } from './CombatScale.ts';
import { canLaunchSpecial, specialDamageAt, spendSpecialCharge } from './SpecialRules.ts';
import {
  frameForEvi,eviFrameTextureKey,EVI_CINEMATIC_SECONDS,
  EVI_RENDER_WIDTH,EVI_RENDER_HEIGHT,EVI_FEET_ORIGIN_Y,
} from './EviSpriteStates.ts';
import { type EviMotionInput } from './EviRigMotion.ts';
import { EviPixelPuppet } from './EviPixelPuppet.ts';
import { earnSplashEnergy, SPLASH_METER_MAX, SPLASH_INPUT_GRACE, splashFacing } from './SplashRules';
import {
  FIGHTER_STYLES, ATTACK_ACTIVE, WAKEUP_PROTECTION,
  attackRecovery, phaseOfAttack, styledAttack, blockstunSeconds,
} from './CombatRhythm';
import {
  DUEL_WHIFF_RECOVERY, DUEL_RESULT_ANIMATION, forwardHeld,
  canDuelCatchTarget, type DuelStrike,
} from './DuelRules';
import {
  COMBO_FINISH_RECOVERY, comboAllows,
  comboFinisherUnblockable, comboIsCleanHit, type ComboMove,
} from './ComboRules';

export type FighterId = 'evi' | 'runa' | 'lyra' | 'kai';
export type AttackName = 'light' | 'heavy' | 'kick' | 'special' | 'sweep' | 'crouchMid' | 'duel';
export interface AttackSpec {
  /** End of startup, before a short ACTIVE hitbox window and RECOVERY. */
  duration: number;
  reach: number;
  damage: number;
  /** The vertical lane this strike actually occupies. */
  level: HitLevel;
  stun: number;
  push: number;
  gain: number;
}
export interface ActiveAttack {
  name: AttackName;
  spec: AttackSpec;
  elapsed: number;
  connected: boolean;
  /** 1=opening, 2=linked strike, 3=finisher; 0=non-combo attack. */
  comboStage: number;
}
export const GROUND_Y = 443;
export let STAGE_MIN_X = 60;
export let STAGE_MAX_X = 900;
/** Keep the arena center unchanged while opening up space on wide screens. */
export function setStageViewportWidth(width: number): void {
  const extraHalf = Math.max(0, width - 960) / 2;
  STAGE_MIN_X = 60 - extraHalf;
  STAGE_MAX_X = 900 + extraHalf;
}

// A roll travels at floor level. Only its middle frames evade attacks;
// the beginning and end can be punished by a well-timed strike.
const ROLL_DURATION = .46;
const ROLL_DISTANCE = 178;
const ROLL_COOLDOWN = .88;
const ROLL_IFRAME_START = .095;
const ROLL_IFRAME_END = .31;
export const ATTACKS: Record<AttackName, AttackSpec> = {
  light: { duration: .27, reach: 92, damage: scaleDamage(5), level: STANDING_ATTACK_LANES.light, stun: .18, push: 110, gain: 7 },
  heavy: { duration: .48, reach: 116, damage: scaleDamage(11), level: STANDING_ATTACK_LANES.heavy, stun: .32, push: 185, gain: 12 },
  kick: { duration: .40, reach: 135, damage: scaleDamage(9), level: STANDING_ATTACK_LANES.kick, stun: .27, push: 150, gain: 10 },
  // Supers keep their own damage but behave as a mid-level strike defensively.
  special: { duration: .82, reach: 205, damage: scaleDamage(13), level: 'mid', stun: .40, push: 290, gain: 0 },
  // Crouching B: low trip. Knockdown triggers ONLY on an unblocked hit.
  sweep: { duration: .47, reach: 114, damage: scaleDamage(5), level: 'low', stun: .12, push: 78, gain: 8 },
  // Crouching X: short-range, weak mid jab. Strong high Y is unavailable.
  crouchMid: { duration: .30, reach: 99, damage: scaleDamage(4), level: 'mid', stun: .15, push: 78, gain: 6 },
  // A Y-shaped, zero-damage, unblockable challenge swing.
  duel: { duration: .43, reach: 116, damage: 0, level: 'high', stun: 0, push: 0, gain: 0 },
};

/** Runa: slower and stronger, but her attacks can still be interrupted. */
const RUNA_ATTACKS: Record<AttackName,AttackSpec> = {
  light: ATTACKS.light,
  heavy: { ...ATTACKS.heavy, duration: .56, reach: 114, damage: scaleDamage(14), stun: .36, push: 225 },
  kick: ATTACKS.kick,
  special: { ...ATTACKS.special, duration: .94, reach: 195, damage: scaleDamage(16), stun: .44, push: 335 },
  sweep: { ...ATTACKS.sweep, duration: .52, reach: 121, damage: scaleDamage(6) },
  crouchMid: { ...ATTACKS.crouchMid, duration: .34, damage: scaleDamage(5) },
  duel: { ...ATTACKS.duel, duration: .50, reach: 114 },
};

export class Fighter {
  readonly id: FighterId;
  x: number;
  yOffset = 0;
  vy = 0;
  face: 1 | -1;
  hp = MAX_HEALTH;
  energy = 0;
  /** Separate, slow splash meter persists between rounds in one match. */
  splashEnergy = 0;
  stunned = 0;
  /** Guard remains committed briefly after absorbing a normal attack. */
  blockstun = 0;
  /** Short invulnerability once a fallen fighter finishes standing up. */
  private wakeupGrace = 0;
  blocking = false;
  crouching = false;
  walking = false;
  private movingForward = true;
  /** The 2s opening/closing display is purely visual and never changes hitboxes. */
  private cinematic: {kind:'intro'|'victory';elapsed:number}|null=null;
  private pixelSprite?: Phaser.GameObjects.Image;
  private pixelPuppet?:EviPixelPuppet;
  private eviVisualMode:'puppet'|'sheet'|'legacy'='puppet';
  attack: ActiveAttack | null = null;
  // Two-stage throw animations are controlled by the arena's grapple state.
  grabPose: 'reach' | 'hold' | 'held' | 'throw' | null = null;
  grabRecovery = 0;
  private rollElapsed = -1;
  private rollDirection: 1 | -1 = 1;
  private rollCooldown = 0;
  // Throws have 0.5 s prone + 0.5 s recovery. A defeated fighter
  // instead lands in 'ko' and stays on the ground until a new round.
  knockdownPhase: 'flying' | 'prone' | 'rising' | 'ko' | null = null;
  private knockoutForever = false;
  private knockdownTimer = 0;
  private knockdownFlightAge = 0;
  hitFlash = 0;
  private blockFlash = 0;
  private impactVelocity = 0;
  // Give Up+X and Up+Y a short chance to become a real SPLASH chord before
  // either component triggers a solo hit. Normal X stays immediate.
  private queuedSolo: { name: 'light' | 'kick' | 'heavy'; remaining: number } | null = null;
  private queuedSpecial = 0;
  private comboHistory: ComboMove[] = [];
  private comboClean = true;
  private comboLinkRemaining = 0;
  private comboRecovery = 0;
  private duelWhiffRecovery = 0;
  /** True only AFTER the entire Y challenge animation has finished. */
  private duelStarterFinished = false;
  private splashPose: 'startup' | 'attack' | 'victim' | 'guard' | null = null;
  private splashProgress = 0;
  private time = 0;

  readonly rig: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Ellipse;
  private guardAura: Phaser.GameObjects.Ellipse;
  private cape: Phaser.GameObjects.Graphics;
  private leftLeg: Phaser.GameObjects.Graphics;
  private rightLeg: Phaser.GameObjects.Graphics;
  private frontArm: Phaser.GameObjects.Graphics;
  private backArm: Phaser.GameObjects.Graphics;
  private body: Phaser.GameObjects.Graphics;
  private head: Phaser.GameObjects.Graphics;
  private hair: Phaser.GameObjects.Graphics;
  private weapon: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene, id: FighterId, initialX: number, face: 1 | -1) {
    this.id = id;
    this.x = initialX;
    this.face = face;
    const evi = id === 'evi';
    const lyra = id === 'lyra';
    const kai = id === 'kai';
    const skin = evi ? 0xe1a77f : lyra ? 0xf1bf9e : kai ? 0xd4ac96 : 0xdba3a0;
    const cloth = evi ? 0xf7f2eb : lyra ? 0x283953 : kai ? 0x19394e : 0x282337;
    const edge = evi ? 0xdab875 : lyra ? 0xeeb66b : kai ? 0x72f0ec : 0x8d5c95;

    this.rig = scene.add.container(initialX, GROUND_Y);
    // Keep the shadow in world coordinates while the fighter rotates and tumbles.
    this.shadow = scene.add.ellipse(initialX, GROUND_Y+5, 90, 17, 0x060c1d, .50);
    this.guardAura = scene.add.ellipse(4, -78, 83, 154, 0x66e1d2, .12)
      .setStrokeStyle(3, 0x8cf2f2, .85).setVisible(false);
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
    } else if (kai) {
      // Kai: two wind-swept cyan energy ribbons and a midnight jacket.
      this.cape.fillStyle(0x244c77,.90).fillTriangle(-9,-111,-82,-38,14,-37);
      this.cape.fillStyle(0x2ccedb,.66).fillTriangle(-16,-109,-100,-69,-25,-40);
      this.cape.lineStyle(3,0x9dfbfc,.90).lineBetween(-13,-110,-98,-67);
      this.cape.lineStyle(2,0x638dff,.70).lineBetween(-14,-98,-77,-30);
    } else if (lyra) {
      // Lyra: distinctive ember-orange split cape over navy and gold armor.
      this.cape.fillStyle(0xf4a04f,.87);
      this.cape.fillTriangle(-16,-109,-91,-22,4,-45);
      this.cape.fillStyle(0xf7d180,.73);
      this.cape.fillTriangle(-18,-102,-63,-11,12,-35);
      this.cape.lineStyle(3,0xf6e0af,.74).lineBetween(-90,-22,4,-45);
    } else {
      this.cape.fillStyle(0x2ac9cf,.86);
      this.cape.fillEllipse(-60,-110,125,38);
      this.cape.fillEllipse(-97,-74,92,25);
      this.cape.fillStyle(0x9df7e8,.6).fillEllipse(-75,-116,103,14);
    }
    const drawLeg = (leg: Phaser.GameObjects.Graphics) => {
      leg.fillStyle(cloth).fillRoundedRect(-11,0,22,54,7);
      leg.fillStyle(evi?0xf7f0e4:lyra?0xdb8d4d:kai?0x1a6681:0x191727).fillRoundedRect(-13,40,25,13,5);
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
    this.body.fillStyle(evi?0xfef9f1:lyra?0x6c8db7:kai?0x41728f:0x5d506d).fillEllipse(0,-89,32,24);
    this.body.fillStyle(evi?0xdab775:lyra?0xffb859:kai?0x7dfaff:0xa6e6ae).fillRect(-15,-60,30,5);
    if (kai) {
      // Small luminous lightning insignia on the armor.
      this.body.fillStyle(0xe2faff).fillTriangle(0,-103,-11,-83,7,-85);
      this.body.fillStyle(0x6de6f3).fillTriangle(-2,-91,12,-96,-6,-73);
      this.body.lineStyle(2,0x7bd7e8,.85).strokeRoundedRect(-24,-105,49,63,12);
    }
    if (lyra) {
      this.body.fillStyle(0xf2a15b).fillTriangle(-12,-92,0,-108,12,-92);
      this.body.lineStyle(3,0xffd39a).strokeCircle(0,-80,8);
    }

    if (kai) {
      // A pair of energized tonfa batons for a distinctive electric silhouette.
      this.weapon.fillStyle(0x182c45).fillRoundedRect(-3,-8,67,16,5);
      this.weapon.fillStyle(0x7beaf4,.95).fillRoundedRect(20,-5,73,10,4);
      this.weapon.fillStyle(0xd8ffff,.84).fillRoundedRect(46,-3,47,4,2);
      this.weapon.fillStyle(0x5b92fc,.90).fillRoundedRect(6,-13,11,29,4);
      this.weapon.lineStyle(3,0x66dcef,.70).lineBetween(23,-11,82,-26);
      this.weapon.lineStyle(2,0xc5ffff,.90).lineBetween(82,-26,95,-15);
    } else if (lyra) {
      // Twin-edged amber fan blade; Runa still has temporary placeholder art.
      this.weapon.fillStyle(0xffd093,.9).fillTriangle(7,-7,81,-33,72,12);
      this.weapon.fillStyle(0xff8b4d,.83).fillTriangle(22,-3,73,-35,54,6);
      this.weapon.lineStyle(3,0xffeed3).lineBetween(9,-6,81,-33);
      this.weapon.fillStyle(0x62465c).fillRoundedRect(-4,-5,34,9,4);
    } else if (!evi) {
      // Temporary stand-in weapon for Runa until her original pixel gauntlets.
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
    this.frontArm.fillStyle(evi?0xeac69b:lyra?0xffd08a:kai?0x9ff0ec:0x201d2f).fillCircle(0,48,8);
    this.frontArm.setPosition(21,-99);

    this.hair.fillStyle(evi?0xe6c38f:lyra?0xfa9c61:kai?0xdce9f7:0x6fe8e2);
    if (evi) {
      this.hair.fillEllipse(-3,-132,47,44);
      this.hair.fillStyle(0xf7dba8).fillEllipse(-16,-122,15,43);
    } else if (kai) {
      // Silver-white windswept spikes with a cool blue shadow.
      this.hair.fillEllipse(-4,-153,58,42);
      this.hair.fillStyle(0xb4c9ed).fillTriangle(-27,-151,-47,-172,-12,-160);
      this.hair.fillTriangle(-10,-166,4,-194,16,-168);
      this.hair.fillStyle(0xf3ffff).fillTriangle(6,-165,37,-184,29,-147);
      this.hair.fillTriangle(-25,-156,20,-165,-2,-138);
    } else if (lyra) {
      // Flame-shaped copper ponytail that stays readable at game scale.
      this.hair.fillEllipse(-3,-146,52,46);
      this.hair.fillStyle(0xffcb79).fillEllipse(-11,-158,39,30);
      this.hair.fillStyle(0xe26646).fillTriangle(-20,-146,-81,-109,-25,-117);
      this.hair.fillTriangle(-16,-140,-73,-98,-16,-117);
    } else {
      this.hair.fillEllipse(-22,-154,44,70);
      this.hair.fillEllipse(1,-168,65,58);
      this.hair.fillStyle(0x3dc8d0).fillEllipse(-50,-147,66,22);
    }

    this.head.fillStyle(skin).fillEllipse(0,-125,37,43);
    this.head.fillStyle(0x181727).fillEllipse(10,-128,6,5);
    this.head.fillStyle(evi?0x74c2d4:lyra?0xfccf7c:kai?0x8cfaff:0xaaff78).fillEllipse(11,-128,3,3);
    if (evi) {
      this.head.lineStyle(2,0x283344).strokeRoundedRect(-16,-136,30,17,5);
      this.head.lineStyle(2,0x283344).lineBetween(14,-128,21,-133);
      this.head.fillStyle(0xa95b62).fillEllipse(9,-115,9,3);
    } else if (kai) {
      this.head.lineStyle(2,0xa4ddeb).lineBetween(1,-138,17,-136);
      this.head.fillStyle(0x396d93).fillRect(8,-143,5,11);
      this.head.fillStyle(0x263044).fillEllipse(11,-114,10,3);
    } else {
      this.head.fillStyle(0xa63e60).fillRect(8,-143,4,11);
      this.head.fillStyle(0x321d2e).fillEllipse(12,-114,11,3);
    }

    this.rig.add([
      this.guardAura,this.cape,this.backArm,this.leftLeg,this.rightLeg,
      this.body,this.weapon,this.frontArm,this.hair,this.head
    ]);
    if(this.id==='evi'){
      this.pixelPuppet=new EviPixelPuppet(scene);
      this.rig.add(this.pixelPuppet.root);
    }
    this.refreshSpriteArt();
    this.draw(0);
  }

  /** Dynamic local sprite import can happen while the battle is paused.
   * Other fighters, or Evi before her art is supplied, retain vector rigs.
   */
  clearSpriteArt():void {
    this.pixelSprite?.destroy();this.pixelSprite=undefined;
    for(const element of [
      this.cape,this.backArm,this.leftLeg,this.rightLeg,this.body,
      this.weapon,this.frontArm,this.hair,this.head,
    ])element.setVisible(true);
  }
  setEviVisualMode(mode:'puppet'|'sheet'|'legacy'):void {
    this.eviVisualMode=mode;
    this.refreshSpriteArt();
  }

  refreshSpriteArt():void {
    this.clearSpriteArt();
    const graphics=[
      this.cape,this.backArm,this.leftLeg,this.rightLeg,this.body,
      this.weapon,this.frontArm,this.hair,this.head,
    ];
    const key=eviFrameTextureKey('combat',0);
    const imported=this.id==='evi'&&this.scene.textures.exists(key);
    const useSheet=imported&&this.eviVisualMode==='sheet';
    const usePuppet=this.id==='evi'&&(
      this.eviVisualMode==='puppet'||(this.eviVisualMode==='sheet'&&!imported));
    this.pixelPuppet?.setVisible(usePuppet);
    for(const visual of graphics)visual.setVisible(!useSheet&&!usePuppet);
    if(useSheet){
      this.pixelSprite=this.scene.add.image(0,0,key)
        .setOrigin(.5,EVI_FEET_ORIGIN_Y)
        .setDisplaySize(EVI_RENDER_WIDTH,EVI_RENDER_HEIGHT);
      this.rig.add(this.pixelSprite);
    }
    this.draw(0);
  }

  beginCinematic(kind:'intro'|'victory'):void {
    this.cinematic={kind,elapsed:0};
    this.attack=null;
    this.walking=false;this.blocking=false;this.crouching=false;
    this.draw(0);
  }
  advanceCinematic(dt:number):void {
    if(!this.cinematic)return;
    this.cinematic.elapsed=Math.min(EVI_CINEMATIC_SECONDS,
      this.cinematic.elapsed+Math.max(0,dt));
    this.draw(dt);
  }
  endCinematic():void {
    this.cinematic=null;
    this.draw(0);
  }

  /** Clean up both the model and its independent world-space shadow. */
  destroy(): void {
    this.rig.destroy();
    this.shadow.destroy();
  }

  get airborne(): boolean { return this.yOffset < -.1; }
  get knockedOut(): boolean { return this.hp <= 0; }
  get guardStance(): GuardStance {
    if (!this.blocking) return 'none';
    return this.crouching ? 'crouching' : 'standing';
  }
  get isRolling(): boolean { return this.rollElapsed >= 0; }
  get isRollInvulnerable(): boolean {
    return this.isRolling && this.rollElapsed >= ROLL_IFRAME_START &&
      this.rollElapsed < ROLL_IFRAME_END;
  }
  get knockedDown(): boolean { return this.knockdownPhase !== null; }
  get wakeupProtected():boolean { return this.wakeupGrace>0 && !this.knockedOut; }
  get knockoutSettled(): boolean { return this.knockedOut && this.knockdownPhase === 'ko'; }
  get isComboRecovering(): boolean { return this.comboRecovery > 0; }
  get isDuelRecovering(): boolean { return this.duelWhiffRecovery > 0; }
  get isDuelStarting(): boolean { return this.attack?.name==='duel'; }
  /** Only an idle, upright opponent or an ordinary walker can be challenged.
   * A high hitbox overlap by itself must never start a duel during any
   * attack, block, roll, crouch, jump, grapple, stun or knockback state.
   */
  get isDuelTargetEligible(): boolean {
    return !this.wakeupProtected && this.blockstun<=0 && canDuelCatchTarget({
      airborne:this.airborne, crouching:this.crouching, isRolling:this.isRolling,
      knockedDown:this.knockedDown, knockedOut:this.knockedOut,
      blocking:this.blocking, attackActive:this.attack!==null,
      grabActive:this.grabPose!==null, stunned:this.stunned,
      grabRecovery:this.grabRecovery,
      comboRecovering:this.isComboRecovering,
      duelRecovering:this.isDuelRecovering,
      recoiling:Math.abs(this.impactVelocity)>1,
      walking:this.walking,
    });
  }
  canStartDuel(): boolean {
    // Two fingers or a swipe may register B first, then Y about a tenth
    // of a second later. Cancel ONLY the pre-impact startup of that
    // component, never a landed attack or combo finisher.
    const earlyChordComponent=Boolean(this.attack &&
      (this.attack.name==='kick' || this.attack.name==='heavy') &&
      this.attack.comboStage===1 && !this.attack.connected &&
      this.attack.elapsed<.16);
    return !this.knockedOut && !this.knockedDown && !this.airborne &&
      !this.crouching && !this.isRolling && !this.grabPose &&
      !this.stunned && this.blockstun<=0 && (!this.attack || earlyChordComponent) &&
      !this.comboRecovery && !this.grabRecovery && !this.duelWhiffRecovery;
  }
  /** X+Y may arrive several frames apart on mobile touchscreens.
   * An unconnected X/Y can cancel into a charged SPLASH during startup.
   */
  tryStartSplash(): boolean {
    const earlyComponent=Boolean(this.attack &&
      (this.attack.name==='light' || this.attack.name==='heavy') &&
      this.attack.comboStage===1 && !this.attack.connected &&
      this.attack.elapsed<this.attack.spec.duration);
    if(this.splashEnergy<SPLASH_METER_MAX || this.knockedOut || this.knockedDown ||
       this.crouching || this.isRolling || this.grabPose ||
       this.stunned>0 || this.blockstun>0 || this.grabRecovery>0 || this.comboRecovery>0 ||
       this.duelWhiffRecovery>0 || (this.attack && !earlyComponent)) return false;
    this.splashEnergy=0;
    // Stick-up is also jump: the chord must still work when Up preceded X/Y.
    // Anchor the cinematic to the floor instead of leaving a floating rig.
    this.yOffset=0;this.vy=0;
    this.attack=null;
    this.queuedSolo=null;
    this.queuedSpecial=0;
    this.clearCombo();
    this.blocking=false;this.walking=false;
    this.splashPose='startup';this.splashProgress=0;
    return true;
  }
  gainSplash(amount:number):void {
    this.splashEnergy=earnSplashEnergy(this.splashEnergy,amount);
  }
  /** A cutscene pose is animated independently of ordinary attack hitboxes. */
  stepSplashPose(dt:number,phase:'startup'|'attack'|'victim'|'guard',progress:number,opponentX:number):void {
    this.time+=dt;
    // Only the caster can auto-face. Guarding or trapped defenders
    // retain their original orientation throughout the cinematic.
    const role=phase==='startup' || phase==='attack'?'attacker':'defender';
    this.face=splashFacing(this.x,opponentX,this.face,role);
    this.splashPose=phase;
    this.splashProgress=Phaser.Math.Clamp(progress,0,1);
    this.attack=null;
    this.blocking=phase==='guard';
    this.crouching=phase==='guard';
    this.walking=false;
    this.draw(dt);
  }
  endSplashPose():void {
    this.splashPose=null;this.splashProgress=0;
    this.blocking=false;this.crouching=false;
    this.draw(0);
  }

  /** The initial zero-damage swing cannot be blocked or shortened. */
  tryBeginDuel(input: InputState): boolean {
    if(!input.duel || input.special || !forwardHeld(this.face,input.left,input.right) ||
       !this.canStartDuel()) return false;
    this.duelStarterFinished=false;
    this.clearCombo();
    this.queuedSolo=null;this.queuedSpecial=0;
    this.begin('duel');
    this.blocking=false;this.walking=false;
    return true;
  }
  /** Consume completion only after the entire wind-up AND follow-through. */
  takeDuelStarterFinished(): boolean {
    const finished=this.duelStarterFinished;
    this.duelStarterFinished=false;
    return finished;
  }
  duelStarterMiss(): void {
    // Called after animation completion, not at the hitbox impact frame.
    this.duelStarterFinished=false;
    this.attack=null;
    this.duelWhiffRecovery=DUEL_WHIFF_RECOVERY;
    this.clearCombo();
    this.queuedSolo=null;this.queuedSpecial=0;
    this.blocking=false;this.walking=false;
  }
  duelStarterConnected(): void {
    // Called ONLY after the starter's full Y animation finishes.
    // The rival's pending attack cannot replay after the frozen selection.
    this.duelStarterFinished=false;
    this.attack=null;
    this.clearCombo();
    this.queuedSolo=null;this.queuedSpecial=0;
    this.blocking=false;this.walking=false;
  }
  /** Knockback from a tie/defensive A, measured away from the rival. */
  duelRecoil(rivalX: number, speed: number): void {
    const direction=this.x===rivalX ? -this.face : this.x<rivalX?-1:1;
    this.impactVelocity=direction*speed;
    this.blocking=false;
  }
  /** Preview each secret duel choice, including the losing fighter's attack.
   * These poses are VISUAL ONLY: never feed them to normal strike resolution.
   */
  showDuelResultStrike(move: DuelStrike): void {
    const spec=this.id==='runa'?RUNA_ATTACKS[move]:ATTACKS[move];
    this.clearCombo();
    this.attack={name:move,spec,elapsed:0,connected:true,comboStage:0};
    this.blocking=false;this.crouching=false;this.walking=false;
    this.draw(0);
  }
  showDuelResultGuard(): void {
    this.attack=null;
    this.clearCombo();
    this.blocking=true;this.crouching=false;this.walking=false;
    this.blockFlash=.3;
    this.draw(0);
  }
  /** The two characters animate simultaneously in a locked cinematic stage. */
  stepDuelResultPose(dt: number): void {
    this.time+=dt;
    if(this.attack) {
      this.attack.elapsed=Math.min(this.attack.spec.duration,
        this.attack.elapsed+dt*this.attack.spec.duration/DUEL_RESULT_ANIMATION);
    }
    this.draw(dt);
  }
  endDuelResultPose(): void {
    this.attack=null;
    this.blocking=false;
    this.walking=false;
    this.draw(0);
  }
  /** Defensive A punishes the attacker after the large knockback. */
  stunFromDuelGuard(duration: number): void {
    this.attack=null;
    this.clearCombo();
    this.queuedSolo=null;
    this.queuedSpecial=0;
    this.stunned=Math.max(this.stunned,duration);
    this.blocking=false;this.crouching=false;this.walking=false;
    this.hitFlash=Math.max(this.hitFlash,.18);
    this.draw(0);
  }
  /** Only valid next strikes are exposed to the CPU and training UI. */
  get comboOptions(): ComboMove[] {
    return this.comboLinkRemaining>0 && !this.comboRecovery && !this.blockstun
      ? (['light','kick','heavy'] as ComboMove[]).filter(
          move=>comboAllows(this.comboHistory,move))
      : [];
  }

  /** Drop the chain when the fighter rolls, grapples or gets interrupted. */
  clearCombo(): void {
    this.comboHistory=[];
    this.comboClean=true;
    this.comboLinkRemaining=0;
  }

  /** Guard cannot stop a properly prepared third strike, though real
   * spacing, crouching beneath a high hitbox, and rolling can still dodge.
   */
  isUnblockableFinisher(strike: ActiveAttack): boolean {
    return comboFinisherUnblockable(strike.comboStage,
      this.comboHistory.length===2 && this.comboClean);
  }

  /** Called exactly once at impact, including a MISS. All three steps
   * must be real contacts; only two clean hits guarantee the finisher.
   * Return a clean 1/2/3 hit counter for arcade feedback.
   */
  recordComboImpact(strike: ActiveAttack, contact: boolean, blocked: boolean, damage: number): number {
    if(strike.comboStage===0) return 0;
    if(!contact) {
      this.clearCombo();
      return 0;
    }
    const clean=comboIsCleanHit(blocked,damage);
    if(strike.comboStage===1) {
      this.comboHistory=[strike.name as ComboMove];
      this.comboClean=clean;
      this.comboLinkRemaining=FIGHTER_STYLES[this.id].comboWindow;
      return clean?1:0;
    }
    if(strike.comboStage===2 && this.comboHistory.length===1 &&
       comboAllows(this.comboHistory,strike.name as ComboMove)) {
      this.comboHistory.push(strike.name as ComboMove);
      this.comboClean &&= clean;
      this.comboLinkRemaining=FIGHTER_STYLES[this.id].comboWindow;
      return this.comboClean?2:0;
    }
    if(strike.comboStage===3 && this.comboHistory.length===2 &&
       comboAllows(this.comboHistory,strike.name as ComboMove)) {
      const fullCleanCombo=this.comboClean && clean;
      this.clearCombo();
      return fullCleanCombo?3:0;
    }
    this.clearCombo();
    return 0;
  }

  /** In endless practice a KO is immediately undone without resetting
   * position or energy. Clear all defeat/knockdown states too, since zero HP
   * normally initiates the permanent knockout animation on impact.
   */
  /** Clear any leftover CPU attack/guard from the previous training policy.
   * Does NOT reset HP, normal/SPLASH energy, position, or active grapple.
   */
  becomePassiveTrainingDummy():void {
    this.attack=null;
    this.queuedSolo=null;
    this.queuedSpecial=0;
    this.clearCombo();
    this.blocking=false;
    this.crouching=false;
    this.walking=false;
    this.stunned=0;
    this.blockstun=0;
    this.impactVelocity=0;
    this.draw(0);
  }

  restoreTrainingHealth():boolean {
    if(this.hp>0)return false;
    this.hp=MAX_HEALTH;
    this.knockoutForever=false;
    this.knockdownPhase=null;
    this.knockdownTimer=0;
    this.knockdownFlightAge=0;
    this.yOffset=0;this.vy=0;
    this.stunned=0;this.blockstun=0;
    this.attack=null;
    this.grabPose=null;this.grabRecovery=0;
    this.comboRecovery=0;this.duelWhiffRecovery=0;
    this.duelStarterFinished=false;
    this.rollElapsed=-1;
    this.queuedSolo=null;this.queuedSpecial=0;
    this.clearCombo();
    this.blocking=false;this.crouching=false;this.walking=false;
    this.impactVelocity=0;this.hitFlash=0;
    this.draw(0);
    return true;
  }

  reset(x: number, face: 1 | -1, preserveSplash=false): void {
    this.x=x; this.face=face; this.hp=MAX_HEALTH; this.energy=0;
    if(!preserveSplash) this.splashEnergy=0;
    this.yOffset=0; this.vy=0; this.stunned=0; this.blockstun=0;
    this.wakeupGrace=0; this.blocking=false;
    this.crouching=false; this.walking=false; this.attack=null;
    this.cinematic=null;
    this.hitFlash=0; this.blockFlash=0; this.impactVelocity=0; this.time=0;
    this.queuedSolo=null; this.queuedSpecial=0;
    this.clearCombo();this.comboRecovery=0;this.duelWhiffRecovery=0;
    this.duelStarterFinished=false;
    this.splashPose=null;this.splashProgress=0;
    this.grabPose=null; this.grabRecovery=0;
    this.rollElapsed=-1; this.rollDirection=1; this.rollCooldown=0;
    this.knockdownPhase=null;this.knockdownTimer=0;this.knockdownFlightAge=0;
    this.knockoutForever=false;
    this.rig.rotation=0;
    this.draw(0);
  }

  step(dt: number, input: InputState, just: InputState, opponentX: number,
    preserveFacing=false): void {
    this.time += dt;
    // Keep the original orientation while tumbling behind the thrower.
    // Facing follows the opponent normally. While guarding, lock the
    // orientation: a roll behind the fighter exposes their back.
    // Include the current held input so defense cannot auto-turn in
    // the same frame that the player first presses A.
    if (!preserveFacing && this.blockstun<=0 &&
        canAutoTurn(this.face,input,this.airborne,this.stunned,this.knockedDown))
      this.face = opponentX >= this.x ? 1 : -1;
    this.hitFlash = Math.max(0, this.hitFlash-dt);
    this.blockFlash = Math.max(0, this.blockFlash-dt);
    this.rollCooldown = Math.max(0, this.rollCooldown-dt);
    const knock = this.impactVelocity;
    this.x = Phaser.Math.Clamp(this.x + knock*dt,STAGE_MIN_X,STAGE_MAX_X);
    this.impactVelocity *= Math.pow(.055,dt);
    if (Math.abs(this.impactVelocity)<1) this.impactVelocity=0;

    if (this.knockedDown) {
      this.advanceKnockdown(dt);
      this.draw(dt);
      return;
    }
    if (this.knockedOut) { this.draw(dt); return; }
    this.wakeupGrace=Math.max(0,this.wakeupGrace-dt);
    if(this.blockstun>0){
      // Freeze attacks and movement without dropping the guarded stance.
      // Leaving A during this recovery does not cause an accidental gap.
      this.blockstun=Math.max(0,this.blockstun-dt);
      this.attack=null;
      this.blocking=true;
      this.walking=false;
      this.advanceGravity(dt);
      this.draw(dt);
      return;
    }
    if (this.stunned>0) this.stunned=Math.max(0,this.stunned-dt);
    if(this.duelWhiffRecovery>0) {
      this.duelWhiffRecovery=Math.max(0,this.duelWhiffRecovery-dt);
      this.attack=null;
      this.blocking=false;this.crouching=false;this.walking=false;
      this.advanceGravity(dt);this.draw(dt);
      return;
    }
    if(this.comboLinkRemaining>0) {
      this.comboLinkRemaining=Math.max(0,this.comboLinkRemaining-dt);
      if(this.comboLinkRemaining===0) this.clearCombo();
    }
    // The third strike has a deliberate punishable recovery window.
    // Ignore all movement, guard and attack inputs, including rolls.
    if(this.comboRecovery>0) {
      this.comboRecovery=Math.max(0,this.comboRecovery-dt);
      this.blocking=false;this.crouching=false;this.walking=false;
      this.advanceGravity(dt);
      this.draw(dt);
      return;
    }

    // The roll has priority over its X+A components, and occupies the whole
    // fighter until its recovery completes. It cannot cancel heavy/special.
    if (this.isRolling) {
      this.advanceRoll(dt);
      this.draw(dt);
      return;
    }
    const horizontal = Number(input.right) - Number(input.left);
    const canCancelEarlyLight = this.attack?.name === 'light' &&
      this.attack.elapsed < .13;
    if (just.roll && horizontal !== 0 && this.attack?.comboStage!==3 &&
        this.attack?.name!=='duel' && !this.airborne &&
        this.stunned <= 0 && this.grabRecovery <= 0 &&
        !this.grabPose && this.rollCooldown <= 0 &&
        (!this.attack || canCancelEarlyLight)) {
      this.startRoll(horizontal > 0 ? 1 : -1);
      this.advanceRoll(dt);
      this.draw(dt);
      return;
    }

    // A failed grab and a completed throw both have a short recovery.
    if (this.grabRecovery > 0) {
      this.grabRecovery = Math.max(0, this.grabRecovery-dt);
      if (this.grabRecovery===0) this.grabPose=null;
      this.blocking=false;this.walking=false;
      this.advanceGravity(dt);
      this.draw(dt);
      return;
    }

    if (this.attack) {
      this.attack.elapsed += dt;
      const phase=phaseOfAttack(this.attack.name,this.attack.elapsed,
        this.attack.spec.duration,attackRecovery(this.id,this.attack.name));
      // Missed active windows must expire before a combo is abandoned;
      // hitting late in active frames is valid, but never damages twice.
      if(phase==='recovery' && !this.attack.connected){
        this.attack.connected=true;
        if(this.attack.comboStage>0)this.clearCombo();
      }
      if (phase==='finished') {
        const justFinishedCombo=this.attack.comboStage===3;
        const justFinishedDuel=this.attack.name==='duel';
        this.attack=null;
        if(justFinishedDuel) {
          // Arena will only open the choice overlay AFTER this event.
          this.duelStarterFinished=true;
          this.blocking=false;this.walking=false;
          this.advanceGravity(dt);this.draw(dt);
          return;
        }
        if(justFinishedCombo) {
          this.comboRecovery=COMBO_FINISH_RECOVERY;
          this.clearCombo();
          this.blocking=false;this.crouching=false;this.walking=false;
          this.advanceGravity(dt);
          this.draw(dt);
          return;
        }
      }
    }

    // Standing A guards high/mid; crouching Down+A guards mid/low.
    // Both guard stances work at rest or while retreating, never advancing.
    const forward = this.face===1 ? input.right : input.left;
    const backward = this.face===1 ? input.left : input.right;
    const neutral = !input.left && !input.right && !input.up && !input.down;
    const validGuardStance = !this.airborne && !input.up && !forward &&
      (input.down || neutral || backward);
    const canRaiseGuard = input.block && validGuardStance && this.stunned<=0;
    // A valid guard cancels a normal attack, but not a committed special.
    // Finisher animation is committed, so guard cannot cancel away its
    // mandatory recovery (other normal strikes can still cancel to guard).
    if (canRaiseGuard && this.attack?.name !== 'special' &&
        this.attack?.name !== 'duel' && this.attack?.comboStage !== 3) {
      this.attack=null;
      this.queuedSolo=null;
      this.queuedSpecial=0;
    }
    // A crouching strike keeps the body low until its follow-through ends,
    // even if Down is released. This also keeps grapples from catching it.
    const crouchAttack = this.attack?.name==='sweep' || this.attack?.name==='crouchMid';
    this.crouching = Boolean(!this.airborne && this.stunned<=0 &&
      (crouchAttack || (input.down && !this.attack)));
    this.blocking = Boolean(canRaiseGuard && !this.attack);
    // Guarding or taking a different stance breaks a previously hit chain.
    if(this.blocking || (this.crouching && !crouchAttack)) this.clearCombo();
    let move = Number(input.right)-Number(input.left);
    // The challenge Y is a committed attack: neither moving nor jumping
    // can truncate the full animation before the duel starts.
    if (this.crouching || this.stunned>0 || this.attack?.name==='duel') move=0;

    // A stick is a held direction, not a one-frame button press.
    // Reading only just.up loses jumps if the fighter was stunned or airborne
    // when the player first tilted the stick upward. Keep checking the live
    // direction every simulation step and jump as soon as landing/stun allows.
    // A held upward direction will naturally trigger the next jump on landing.
    // The optional keyboard/gamepad jump key still uses a press edge.
    const wantsJump = input.up || just.jump;
    if (this.stunned<=0 && wantsJump && !this.airborne && !this.crouching &&
        this.attack?.name!=='duel') {
      this.vy=-490;
      this.yOffset=-.2;
    }
    // A chord can arrive a few frames after the first button. Keep it
    // buffered briefly, with priority above both of its component attacks.
    this.queuedSpecial=Math.max(0,this.queuedSpecial-dt);
    // Supers are standing-only. A B+Y chord held while crouching
    // must not secretly fire when the character stands up again.
    if (this.crouching) this.queuedSpecial=0;
    if (this.attack?.comboStage===3) this.queuedSpecial=0;
    if (just.special && forwardHeld(this.face,input.left,input.right) &&
        !this.crouching && this.attack?.comboStage!==3 &&
        this.attack?.name!=='duel') {
      this.queuedSpecial=.35;
      this.queuedSolo=null;
    }
    // The two dedicated crouch moves may begin while grounded and pressing
    // Down. They are not standing attacks and cannot be started while guarding.
    if (this.crouching && !this.attack && this.stunned<=0) {
      const crouchMove=crouchMoveForPress({
        down:input.down, grounded:!this.airborne, blocking:this.blocking,
        grabbing:input.grab, rolling:input.roll, special:input.special,
        light:just.light, kick:just.kick, heavy:input.heavy,
      });
      if(crouchMove) {
        this.queuedSolo=null;
        this.queuedSpecial=0;
        this.begin(crouchMove);
      }
    }
    const canAct=this.stunned<=0 && !this.crouching && !this.blocking;
    if (!canAct) this.queuedSolo=null;

    // Once the previous strike has CONNECTED, a fresh different button can
    // cancel its recovery into one of six explicitly allowed X/B/Y routes.
    // No automatic repeats, crouch strikes, grabs or B+Y shortcuts.
    const comboNext: ComboMove | null =
      just.light && !just.kick && !just.heavy ? 'light' :
      just.kick && !just.light && !just.heavy ? 'kick' :
      just.heavy && !just.light && !just.kick ? 'heavy' : null;
    const canLinkCombo=Boolean(canAct && !this.airborne &&
      !input.special && !input.grab && !input.roll &&
      !input.down && !input.up && !input.block &&
      this.queuedSpecial<=0 && this.comboLinkRemaining>0 &&
      comboNext && comboAllows(this.comboHistory,comboNext) &&
      (!this.attack || this.attack.connected));
    if(canLinkCombo && comboNext) {
      const stage=this.comboHistory.length+1;
      this.comboLinkRemaining=0;
      this.queuedSolo=null;
      this.begin(comboNext,stage);
    }

    const canCancelForChord=Boolean(
      this.attack && this.attack.comboStage!==3 &&
      (this.attack.name==='kick' || this.attack.name==='heavy')
    );
    if (!canLinkCombo && canAct && forwardHeld(this.face,input.left,input.right) &&
        this.queuedSpecial>0 && canLaunchSpecial(this.energy) &&
        (!this.attack || canCancelForChord)) {
      const strength=specialDamageAt(this.id,this.energy);
      this.energy=spendSpecialCharge(this.energy);
      this.attack=null;
      this.queuedSolo=null;
      this.queuedSpecial=0;
      this.begin('special',0,strength);
    } else if (!canLinkCombo && canAct && !this.attack) {
      // With a full SPLASH meter, pressing Up plus either X or Y gives
      // the second finger a short grace period. Otherwise X remains
      // immediate, and the original B/Y solo queue stays unchanged.
      const awaitingSplash=input.up && this.splashEnergy>=SPLASH_METER_MAX;
      if (just.light && !awaitingSplash) {
        this.queuedSolo=null;
        this.begin('light');
      } else {
        if (!input.special && !this.queuedSolo) {
          if(just.light && awaitingSplash)
            this.queuedSolo={name:'light',remaining:SPLASH_INPUT_GRACE};
          else if(just.heavy)
            this.queuedSolo={name:'heavy',remaining:awaitingSplash?SPLASH_INPUT_GRACE:.075};
          else if(just.kick)
            this.queuedSolo={name:'kick',remaining:.075};
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
    // Runa is the grounded powerhouse: 20% slower than the other fighters.
    const baseMoveSpeed = this.blocking ? 90 : this.attack ? 115 : 185;
    const style=FIGHTER_STYLES[this.id];
    const moveSpeed=baseMoveSpeed*(this.blocking?style.guardingMovement:
      this.attack?style.attackingMovement:style.movement);
    this.walking = move!==0 && !this.airborne;
    this.movingForward=move*this.face>=0;
    this.x += move*moveSpeed*dt;
    this.x = Phaser.Math.Clamp(this.x,STAGE_MIN_X,STAGE_MAX_X);
    this.advanceGravity(dt);
    this.draw(dt);
  }

  private startRoll(direction: 1 | -1): void {
    this.rollElapsed = 0;
    this.rollDirection = direction;
    this.rollCooldown = ROLL_COOLDOWN*FIGHTER_STYLES[this.id].rollCooldown;
    this.attack = null;
    this.queuedSolo = null;
    this.queuedSpecial = 0;
    this.clearCombo();
    this.blocking = false;
    this.crouching = false;
    this.walking = false;
    this.impactVelocity = 0;
  }

  private advanceRoll(dt: number): void {
    // Smooth-in/smooth-out horizontal travel (around 178 px normally).
    const before = Phaser.Math.Clamp(this.rollElapsed / ROLL_DURATION,0,1);
    this.rollElapsed = Math.min(ROLL_DURATION,this.rollElapsed + dt);
    const after = Phaser.Math.Clamp(this.rollElapsed / ROLL_DURATION,0,1);
    const ease = (t:number) => t*t*(3-2*t);
    const distance = ROLL_DISTANCE*FIGHTER_STYLES[this.id].rollDistance;
    this.x = Phaser.Math.Clamp(this.x +
      this.rollDirection * distance * (ease(after)-ease(before)),
      STAGE_MIN_X, STAGE_MAX_X);
    if (this.rollElapsed >= ROLL_DURATION) this.rollElapsed = -1;
    this.advanceGravity(dt);
  }

  private advanceKnockdown(dt: number): void {
    // A throw that removes the final HP is permanent, including edge cases
    // where its defeat state is detected after the launch.
    if (this.knockedOut) this.knockoutForever=true;
    if (this.knockoutForever &&
        (this.knockdownPhase==='prone' || this.knockdownPhase==='rising')) {
      this.knockdownPhase='ko';
      this.knockdownTimer=0;
    }
    this.blocking=false;
    this.crouching=false;
    this.walking=false;
    this.attack=null;
    this.grabPose=null;

    if (this.knockdownPhase==='flying') {
      this.knockdownFlightAge+=dt;
      this.advanceGravity(dt);
      if (!this.airborne && this.vy===0) {
        this.knockdownPhase=this.knockoutForever ? 'ko' : 'prone';
        this.knockdownTimer=this.knockoutForever ? 0 : .5;
        // Stop sliding once the thrown fighter hits the ground.
        this.impactVelocity=0;
      }
    } else if (this.knockdownPhase==='prone' || this.knockdownPhase==='rising') {
      this.knockdownTimer=Math.max(0,this.knockdownTimer-dt);
      if (this.knockdownTimer===0) {
        if (this.knockdownPhase==='prone') {
          this.knockdownPhase='rising';
          this.knockdownTimer=.5;
        } else {
          this.knockdownPhase=null;
          this.knockdownFlightAge=0;
          this.stunned=0;
          this.wakeupGrace=WAKEUP_PROTECTION;
        }
      }
    }
  }

  private advanceGravity(dt: number): void {
    if(this.airborne || this.vy!==0) {
      this.vy += 1180*dt;
      this.yOffset += this.vy*dt;
      if (this.yOffset>=0) {this.yOffset=0;this.vy=0;}
    }
  }

  /** Called while reaching or holding a target; regular attacks are suspended. */
  stepGrapple(dt: number, opponentX: number): void {
    this.time+=dt;
    this.face=opponentX>=this.x?1:-1;
    this.blocking=false;
    this.crouching=false;
    this.walking=false;
    this.attack=null;
    this.hitFlash=Math.max(0,this.hitFlash-dt);
    this.blockFlash=Math.max(0,this.blockFlash-dt);
    this.draw(dt);
  }

  /** A successful guard pushes the grappler back without damaging them. */
  repelBlockedGrab(defenderX: number): void {
    this.impactVelocity=blockedGrabRecoil(this.x,defenderX,this.face);
  }

  /** The defensive A or X command interrupts a grab before its throw phase. */
  breakGrab(counterPunch: boolean): number {
    this.clearCombo();
    const beforeHp=this.hp;
    this.grabPose=null;
    this.attack=null;
    this.queuedSolo=null;
    this.queuedSpecial=0;
    this.grabRecovery=counterPunch ? .46 : .34;
    this.stunned=Math.max(this.stunned, counterPunch ? .25 : .12);
    this.blocking=false;
    if(counterPunch) {
      this.hp=Math.max(0,this.hp-scaleDamage(3));
      this.hitFlash=.18;
      if(this.knockedOut) this.startKnockout(this.face===1 ? -1 : 1);
    }
    return beforeHp-this.hp;
  }

  /** A grounded, unguarded crouching B trips the rival without throwing
   *  them behind the attacker. Short fall, same prone/rise recovery as throws.
   */
  receiveSweep(attackerFace: 1 | -1): void {
    if (this.knockedDown || this.knockedOut) return;
    this.clearCombo();
    this.attack=null;
    this.queuedSolo=null;
    this.queuedSpecial=0;
    this.grabPose=null;
    this.grabRecovery=0;
    this.blocking=false;
    this.crouching=false;
    this.walking=false;
    this.rollElapsed=-1;
    this.stunned=0;
    this.blockstun=0;this.wakeupGrace=0;
    this.impactVelocity=attackerFace*170;
    this.vy=-160;
    this.yOffset=-1;
    this.knockdownPhase='flying';
    this.knockdownTimer=0;
    this.knockdownFlightAge=0;
    this.hitFlash=.18;
  }

  receiveThrow(damage: number, attackerFace: 1 | -1): number {
    this.clearCombo();
    const hpBefore=this.hp;
    this.grabPose=null;
    this.attack=null;
    this.blocking=false;
    this.rollElapsed=-1;
    this.queuedSolo=null;
    this.queuedSpecial=0;
    this.hp=Math.max(0,this.hp-damage);
    this.knockoutForever=this.knockoutForever || this.knockedOut;
    // Send the victim BEHIND the thrower, with much greater travel.
    // Facing is frozen throughout the tumble and restored on recovery.
    this.face=attackerFace;
    this.stunned=0;this.blockstun=0;this.wakeupGrace=0;
    this.impactVelocity=-attackerFace*1120;
    this.vy=-540;
    this.yOffset=-1;
    this.knockdownPhase='flying';
    this.knockdownTimer=0;
    this.knockdownFlightAge=0;
    this.grabRecovery=0;
    this.hitFlash=.18;
    this.draw(0);
    return hpBefore-this.hp;
  }

  /** Unique spec is selected at wind-up; the shared engine still resolves hits. */
  private begin(name: AttackName, linkedStage = 0, overrideDamage?:number): void {
    const base = this.id === 'runa' ? RUNA_ATTACKS[name] : ATTACKS[name];
    const spec=styledAttack(this.id,name,base);
    if(name==='special' && overrideDamage!==undefined)spec.damage=overrideDamage;
    const regular=name==='light'||name==='kick'||name==='heavy';
    if(linkedStage===0) this.clearCombo();
    this.attack={name,spec,elapsed:0,connected:false,
      comboStage:regular ? linkedStage || 1 : 0};
  }

  /** A successful grappler throw should be rewarding, but still escapable. */
  get throwDamage(): number { return scaleDamage(this.id === 'runa' ? 21 : 16); }

  getActiveStrike(): ActiveAttack | null {
    const a=this.attack;
    // Startup is harmless; collision stays active for several simulation
    // frames after full extension. One attack may hit only once.
    return a && !a.connected &&
      phaseOfAttack(a.name,a.elapsed,a.spec.duration,
        attackRecovery(this.id,a.name))==='active' ? a : null;
  }

  strikeBox(): {x:number;y:number;w:number;h:number} | null {
    const a=this.getActiveStrike();
    if(!a) return null;
    const w=a.spec.reach;
    const band=strikeBand(a.spec.level);
    return {
      x:this.x+(this.face===1?12-w/8:-12-w*7/8),
      y:GROUND_Y+this.yOffset+band.top, w, h:band.height,
    };
  }

  bodyBox(): {x:number;y:number;w:number;h:number} {
    const low = this.crouching || this.isRolling;
    return {x:this.x-25,y:GROUND_Y+this.yOffset-(low?73:145),w:50,h:low?72:142};
  }

  /** Both strikes landed in the SAME fixed frame. Apply guard impact to
   * both fighters without damage, stun, attack interruption or meter gain.
   * The active attack stays in its follow-through exactly as after a block.
   */
  deflectSimultaneousStrike(spec: AttackSpec, attackerFace: 1 | -1): void {
    this.impactVelocity=attackerFace*spec.push*.43;
    this.blockFlash=Math.max(this.blockFlash,.18);
    this.draw(0); // Show the guarded impact on the first frozen frame.
  }

  receiveHit(
    spec: AttackSpec, attackerFace: 1|-1, unblockable = false,
    context: {rear?:boolean;guardBreaker?:boolean;attackName?:AttackName} = {},
  ): {damage:number;blocked:boolean;interrupted:boolean;guardBroken:boolean} {
    const guardValid=!unblockable && !context.rear &&
      stopsHit(this.guardStance,spec.level);
    const guardBroken=guardValid && Boolean(context.guardBreaker);
    const blocked=guardValid && !guardBroken;
    const interrupted=!blocked && Boolean(this.attack && !this.attack.connected &&
      this.attack.elapsed < this.attack.spec.duration);
    // A correct guard negates the entire hit. A low attack beats standing A;
    // middle attacks are covered by both A and Down+A.
    const attemptedDamage=blocked ? 0 : strikeDamage(spec.damage,Boolean(context.rear),guardBroken);
    // Meter and damage notifications use HP actually removed, not overkill.
    const damage=Math.min(this.hp,attemptedDamage);
    this.hp=Math.max(0,this.hp-damage);
    this.impactVelocity=attackerFace*spec.push*(blocked?.43:1);
    if(!blocked) {
      this.clearCombo();
      // Startup/recovery hits interrupt the roll; invulnerable frames
      // are checked before receiveHit() in ArenaScene.resolveStrike().
      this.rollElapsed=-1;
      this.stunned=spec.stun;
      this.blockstun=0;
      this.wakeupGrace=0;
      if(guardBroken){this.blocking=false;this.crouching=false;}
      this.attack=null;
      this.queuedSolo=null;
      this.queuedSpecial=0;
      this.hitFlash=.15;
    } else {
      // Keep the guard up through successive hits; guard stun must not
      // create a tiny opening that lets the next hit bypass a held A.
      this.stunned=0;
      this.blockstun=Math.max(this.blockstun,
        blockstunSeconds(context.attackName??'kick'));
      this.blockFlash=.18;
    }
    if(this.knockedOut) this.startKnockout(attackerFace);
    this.x=Phaser.Math.Clamp(this.x,STAGE_MIN_X,STAGE_MAX_X);
    this.draw(0); // Hitstop must freeze the IMPACT pose, not the previous pose.
    return {damage,blocked,interrupted,guardBroken};
  }

  /** Mark a round loss with a visible fall that never automatically gets up. */
  startDefeatFall(impulseFace: 1 | -1): void {
    if (this.knockoutForever) return;
    this.startKnockout(impulseFace);
  }

  private startKnockout(impulseFace: 1 | -1): void {
    if (this.knockoutForever) return;
    this.knockoutForever=true;
    this.knockdownPhase='flying';
    this.knockdownTimer=0;
    this.knockdownFlightAge=0;
    this.attack=null;
    this.grabPose=null;
    this.grabRecovery=0;
    this.rollElapsed=-1;
    this.queuedSolo=null;
    this.queuedSpecial=0;
    this.clearCombo();
    this.comboRecovery=0;
    this.blocking=false;
    this.crouching=false;
    this.stunned=0;this.blockstun=0;this.wakeupGrace=0;
    this.impactVelocity=impulseFace*430;
    this.vy=-310;
    this.yOffset=-1;
    this.hitFlash=.23;
  }

  /** Only damaging, successfully landed attacks (including throws and
   * counters) earn meter. Receiving a hit or blocking never earns meter.
   */
  rewardDamage(actualDamage: number): void {
    this.energy=earnSpecialMeter(this.energy,actualDamage);
  }

  private eviMotionInput():EviMotionInput {
    const time=this.time;
    if(this.cinematic)return {
      name:this.cinematic.kind,time,elapsed:this.cinematic.elapsed,
      duration:EVI_CINEMATIC_SECONDS,
    };
    if(this.splashPose){
      const names={
        startup:'splashStart',attack:'splashAttack',
        victim:'splashVictim',guard:'splashGuard',
      } as const;
      return {name:names[this.splashPose],time,progress:this.splashProgress};
    }
    if(this.knockdownPhase){
      const phase=this.knockdownPhase;
      return {name:phase==='flying'?'fall':phase==='rising'?'rise':'prone',
        time,progress:phase==='flying'
          ?Math.min(1,this.knockdownFlightAge/.48)
          :phase==='rising'?1-this.knockdownTimer/.5:1};
    }
    if(this.grabPose){
      const moves={
        reach:'grabReach',hold:'grabHold',held:'grabHeld',throw:'throw',
      } as const;
      return {name:moves[this.grabPose],time};
    }
    if(this.isRolling)return {
      name:'roll',time,progress:this.rollElapsed/ROLL_DURATION,
    };
    if(this.attack){
      const a=this.attack;
      return {name:a.name,time,elapsed:a.elapsed,
        startup:a.spec.duration,
        duration:a.spec.duration+ATTACK_ACTIVE[a.name]+
          attackRecovery(this.id,a.name)};
    }
    if(this.stunned>0)return {name:'hit',time};
    if(this.blocking)return {name:this.crouching?'guardLow':'guard',time};
    if(this.crouching)return {name:'crouch',time};
    if(this.airborne)return {name:'jump',time};
    if(this.walking)return {name:'walk',time,backwards:!this.movingForward};
    return {name:'idle',time};
  }

  private draw(_dt: number): void {
    // Art has no influence on collisions, startup, active frames or recovery.
    this.pixelPuppet?.update(this.eviMotionInput(),_dt,this.hitFlash>0);
    if(this.pixelSprite){
      const chosen=frameForEvi({
        cinematic:this.cinematic,
        splash:this.splashPose,
        attack:this.attack&&{
          name:this.attack.name,elapsed:this.attack.elapsed,
          startup:this.attack.spec.duration,
        },
        grab:this.grabPose,
        knockdown:this.knockdownPhase,
        rolling:this.isRolling,airborne:this.airborne,
        blocking:this.blocking,crouching:this.crouching,
        stunned:this.stunned>0,walking:this.walking,
        movingForward:this.movingForward,time:this.time,
      });
      const hasCinematic=this.scene.textures.exists(eviFrameTextureKey('cinematic',0));
      const kind=chosen.sheet==='cinematic' && hasCinematic?'cinematic':'combat';
      const frame=kind==='combat' && chosen.sheet==='cinematic'
        ?(this.cinematic?.kind==='victory'?20:0):chosen.frame;
      const textureKey=eviFrameTextureKey(kind,frame);
      if(this.pixelSprite.texture.key!==textureKey){
        this.pixelSprite.setTexture(textureKey);
      }
      // setTexture may update origin/size. Reassert a stable foot pivot on
      // every frame, including jumps and wide horizontal attacks.
      this.pixelSprite.setOrigin(.5,EVI_FEET_ORIGIN_Y);
      this.pixelSprite.setDisplaySize(EVI_RENDER_WIDTH,EVI_RENDER_HEIGHT);
      this.pixelSprite.setPosition(0,0);
      this.pixelSprite.setTint(this.hitFlash>0?0xffcad8:0xffffff);
      this.pixelSprite.setAlpha(this.knockedOut?0.76:1);
    }
    const motion=this.walking?Math.sin(this.time*15):Math.sin(this.time*2.5)*.11;
    const swing=this.walking?Math.sin(this.time*15)*.30:0;
    this.leftLeg.rotation=swing;
    this.rightLeg.rotation=-swing;
    this.backArm.rotation=-swing*.5;
    this.frontArm.rotation=swing*.5;
    this.weapon.rotation=.15+motion*.2;
    this.cape.rotation=-motion*.08;
    this.hair.rotation=this.id==='runa'?-motion*.04:0;

    if(this.crouching) {
      this.leftLeg.rotation=.8;this.rightLeg.rotation=-.8;
      this.body.y=24;this.head.y=24;this.hair.y=24;
    } else {
      this.body.y=0;this.head.y=0;this.hair.y=0;
    }
    if(this.attack) {
      const a=this.attack;
      // Readable wind-up, final extension on the impact frame, and follow-through.
      // Damage does not occur until the extension reaches its endpoint.
      const ratio=Phaser.Math.Clamp(a.elapsed/a.spec.duration,0,1);
      const swing=ratio < .54 ? -.28*(ratio/.54) : -.28+1.28*((ratio-.54)/.46);
      const followThrough=Phaser.Math.Clamp(
        1-Math.max(0,a.elapsed-a.spec.duration-ATTACK_ACTIVE[a.name])/
        attackRecovery(this.id,a.name),0,1);
      const recoil=swing*followThrough;
      if(a.name==='duel') {
        // Readable, real high Y wind-up, but initiation itself deals ZERO HP.
        this.frontArm.rotation=-.62-recoil*2.1;
        this.weapon.rotation=-.36-recoil*1.5;
      } else if(a.name==='sweep') {
        // Ground-level leg sweep. Keep the torso and head crouched while
        // extending one leg almost horizontally toward the opponent.
        const extension=Math.sin(Math.PI*ratio)*followThrough;
        this.rightLeg.rotation=-1.42*extension;
        this.leftLeg.rotation=.62;
        this.frontArm.rotation=.9;
        this.weapon.rotation=.28;
        this.body.y=27;this.head.y=27;this.hair.y=27;
      } else if(a.name==='crouchMid') {
        // Short mid jab at waist height with arm/weapon, feet planted.
        this.frontArm.rotation=-recoil*1.35;
        this.weapon.rotation=-recoil*.85;
        this.leftLeg.rotation=.68;this.rightLeg.rotation=-.68;
        this.body.y=24;this.head.y=24;this.hair.y=24;
      } else if(a.name==='kick') {
        // Mid kick: straight through the torso lane.
        this.rightLeg.rotation=-recoil*1.5;
      } else if(a.name==='light') {
        // Low sweep/punch: keep the hit readable near the opponent's feet.
        this.frontArm.rotation=.58+Math.abs(recoil)*1.0;
        this.weapon.rotation=.38+Math.abs(recoil)*.8;
        this.body.y=8;this.head.y=8;this.hair.y=8;
        this.rightLeg.rotation=-.38;
      } else {
        this.frontArm.rotation=-recoil*(a.name==='heavy'?2.1:1.25);
      }
      if(a.name==='special') {
        this.frontArm.rotation=-recoil*2.8;
        this.weapon.rotation=-recoil*2.7;
      } else if(a.name==='heavy') {
        // High overhead swing, vulnerable to a crouched opponent.
        this.frontArm.rotation=-.6-recoil*2.1;
        this.weapon.rotation=-.35-recoil*1.5;
      }
    }
    if(this.splashPose){
      const p=this.splashProgress;
      if(this.splashPose==='victim'){
        this.frontArm.rotation=-.9-Math.sin(p*28)*.16;
        this.backArm.rotation=.55;
        this.body.y=Math.sin(p*28)*3;
        this.head.y=this.body.y;this.hair.y=this.body.y;
      } else if(this.splashPose==='guard'){
        this.frontArm.rotation=-1.25;
        this.backArm.rotation=-.95;
        this.leftLeg.rotation=.8;this.rightLeg.rotation=-.8;
        this.body.y=24;this.head.y=24;this.hair.y=24;
      } else {
        // Every fighter uses a different procedural choreography; sprite
        // sheets can later replace these poses without changing the rules.
        const wave=Math.sin(p*24*Math.PI);
        if(this.id==='evi'){
          this.frontArm.rotation=-1.7+wave*.55;
          this.backArm.rotation=-.5-wave*.4;
          this.weapon.rotation=-2.1+p*7*Math.PI;
          this.rightLeg.rotation=-.30-wave*.25;
        }else if(this.id==='runa'){
          this.frontArm.rotation=-.9-p*1.7;
          this.backArm.rotation=-.9-p*1.7;
          this.weapon.rotation=-.2;
          this.body.y=-14*Math.sin(p*Math.PI);
          this.head.y=this.body.y;this.hair.y=this.body.y;
        }else if(this.id==='lyra'){
          this.frontArm.rotation=-1.6+wave*.35;
          this.backArm.rotation=-1.1-wave*.6;
          this.weapon.rotation=-1.7+p*5*Math.PI;
          this.cape.rotation=wave*.22;
        }else{
          this.frontArm.rotation=-1.9+wave*.75;
          this.backArm.rotation=-1.9-wave*.75;
          this.weapon.rotation=wave*.6;
          this.rightLeg.rotation=wave*.32;
        }
      }
    }
    if(this.stunned>0 && !this.splashPose) this.frontArm.rotation=-.5;
    if(this.cinematic && !this.pixelSprite) {
      // Temporary entrance and victory movement for fighters with no
      // hand-drawn sprite art yet; this never modifies their hitboxes.
      const p=Math.min(1,this.cinematic.elapsed/EVI_CINEMATIC_SECONDS);
      const flourish=Math.sin(p*Math.PI);
      this.frontArm.rotation=-1.1-flourish*.7;
      this.backArm.rotation=-.35-flourish*.5;
      this.weapon.rotation=-1.1-flourish*2.3;
      this.body.y=-5*flourish;
      this.head.y=this.body.y;this.hair.y=this.body.y;
    }
    if (this.knockedDown) {
      this.leftLeg.rotation=-.45;
      this.rightLeg.rotation=.5;
      this.frontArm.rotation=-.75;
      this.backArm.rotation=.35;
      this.body.y=0;
      this.head.y=0;
      this.hair.y=0;
    }
    if (this.grabPose==='reach') {
      this.frontArm.rotation=-1.30;this.backArm.rotation=-.60;
      this.weapon.rotation=-.40;
    } else if (this.grabPose==='hold') {
      this.frontArm.rotation=-1.85;this.backArm.rotation=-1.25;
      this.weapon.rotation=-1.10;
    } else if (this.grabPose==='held') {
      this.frontArm.rotation=.90;this.backArm.rotation=.40;
      this.body.y=5;
    } else if (this.grabPose==='throw') {
      this.frontArm.rotation=-2.60;this.backArm.rotation=-2.10;
      this.body.y=-9;
    }
    if (this.isRolling) {
      // Temporary rolling pose: rotate the sprite sheet's sweep frame
      // until dedicated roll animation keyframes are drawn.
      // rotate the rig around the torso, not its feet. The adjusted pivot
      // keeps the fighter visually on the ground during a full turn.
      const progress = this.rollElapsed / ROLL_DURATION;
      const angle = this.rollDirection * Math.PI * 2 * progress;
      const squash = 1 - .36 * Math.sin(Math.PI * progress);
      const pivot = 80 * squash;
      const centerY = GROUND_Y - 80 + 20 * Math.sin(Math.PI * progress);
      this.rig.setPosition(
        this.x - pivot * Math.sin(angle),
        centerY + pivot * Math.cos(angle)
      );
      this.rig.setScale(this.face,squash);
      this.rig.setRotation(angle);
      this.shadow.setPosition(this.x,GROUND_Y+5);
      this.shadow.setScale(.76,1);
      this.rig.alpha=1;
      this.guardAura.setVisible(false);
      this.body.setAlpha(this.hitFlash>0?.45:1);
      return;
    }
    // Tilt the entire body in mid-air, stay horizontal for half a second
    // after landing, then smoothly rotate upright over another half second.
    let fallAngle=0;
    if (this.knockdownPhase==='flying') {
      fallAngle=Math.min(1,this.knockdownFlightAge/.48)*Math.PI*.47;
    } else if (this.knockdownPhase==='prone' || this.knockdownPhase==='ko') {
      fallAngle=Math.PI*.47;
    } else if (this.knockdownPhase==='rising') {
      const progress=1-this.knockdownTimer/.5;
      const smooth=progress*progress*(3-2*progress);
      fallAngle=Math.PI*.47*(1-smooth);
    }
    this.rig.setPosition(this.x,GROUND_Y+this.yOffset);
    this.rig.setScale(this.face,1);
    // Pixel-art fallen and prone poses are already horizontal. Rotating
    // them again would flip the sprite upright and corrupt the silhouette.
    this.rig.setRotation(this.pixelSprite?0:this.face*fallAngle);
    // A separate world-space shadow stays flat underneath the trajectory.
    this.shadow.setPosition(this.x,GROUND_Y+5);
    this.rig.alpha=this.knockedOut ? .65 : 1;
    // A clash briefly flashes both guard auras even when neither player
    // had pressed A: simultaneous attacks behave as two successful blocks.
    this.guardAura.setVisible(this.blocking || this.blockFlash>0);
    this.guardAura.setAlpha(this.blockFlash>0 ? .90 : .44);
    this.guardAura.setY(this.crouching ? -54 : -78);
    this.guardAura.setScale(this.crouching ? .9 : 1,this.crouching ? .65 : 1);
    if(this.hitFlash>0) this.body.setAlpha(.45);
    else this.body.setAlpha(1);
    this.shadow.setScale(this.airborne?Math.max(.45,1+this.yOffset/500):1,1);
  }
}
