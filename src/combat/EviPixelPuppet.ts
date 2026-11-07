import Phaser from 'phaser';
import {
  type EviMotionInput,type EviPose,
  neutralEviPose,eviPoseFor,blendEviPose,
} from './EviRigMotion.ts';
import {groundedEviTumble} from './EviGroundedTumble.ts';
import {
  eviFanLocalRotation,eviFanTip,eviSlashGlow,isEviFanSlash,
  EVI_FAN_TRAIL_LIFETIME,type Point,
} from './EviFanSlash.ts';

/** A modular pixel-art fighter rendered from individually drawn textures.
 * Parents use joints (shoulder→elbow→wrist, hip→knee→ankle), not an atlas
 * full of incompatible poses. Art is created once per Phaser TextureManager.
 * No imported image or remote resource is required.
 */
const PREFIX='evi-rig-v1-';
type Paint=(p:PixelPainter)=>void;
type PixelPainter={
  rect:(x:number,y:number,w:number,h:number,color:string)=>void;
  dot:(x:number,y:number,color:string)=>void;
  line:(x1:number,y1:number,x2:number,y2:number,color:string,width?:number)=>void;
  triangle:(a:[number,number],b:[number,number],c:[number,number],color:string)=>void;
};
const C={
  line:'#3e3652',lineSoft:'#716581',white:'#fff9ed',
  whiteShadow:'#e5dbe9',gray:'#acafc6',gold:'#edc98b',
  goldDeep:'#b88960',rose:'#dd8ea4',roseLight:'#ffcad7',
  hair:'#f6d89f',hairShade:'#cba975',hairLight:'#fff0c0',
  skin:'#e4ad88',skinLight:'#ffd0a9',skinShade:'#c78771',
  blue:'#86d9ee',blueDark:'#487ea8',mint:'#befff0',
  boot:'#f0f0fa',bootShade:'#9a97b9',black:'#29324b',
};

function pixelCanvas(scene:Phaser.Scene,name:string,w:number,h:number,paint:Paint):void{
  const key=PREFIX+name;
  if(scene.textures.exists(key))return;
  const canvas=document.createElement('canvas');
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Pixel art needs a canvas 2D context');
  ctx.imageSmoothingEnabled=false;
  const rect=(x:number,y:number,a:number,b:number,color:string)=>{
    ctx.fillStyle=color;ctx.fillRect(x,y,a,b);
  };
  const p:PixelPainter={
    rect,
    dot:(x,y,color)=>rect(x,y,1,1,color),
    line:(x1,y1,x2,y2,color,width=1)=>{
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='square';
      ctx.beginPath();ctx.moveTo(x1+.5,y1+.5);ctx.lineTo(x2+.5,y2+.5);
      ctx.stroke();
    },
    triangle:(a,b,c,color)=>{
      ctx.fillStyle=color;ctx.beginPath();
      ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);
      ctx.closePath();ctx.fill();
    },
  };
  paint(p);
  const texture=scene.textures.addCanvas(key,canvas);
  if(!texture)throw new Error('Cannot construct pixel texture: '+key);
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function ensurePixelTextures(scene:Phaser.Scene):void{
  pixelCanvas(scene,'torso',26,30,p=>{
    p.rect(3,1,20,27,C.line);
    p.rect(5,2,16,23,C.whiteShadow);
    p.rect(3,3,5,12,C.white);
    p.rect(18,3,5,12,C.white);
    p.rect(7,3,12,17,C.white);
    p.rect(10,2,6,5,C.skinLight);
    p.rect(8,7,10,11,C.roseLight);
    p.triangle([8,8],[13,15],[18,8],C.white);
    p.rect(11,10,4,7,C.gold);
    p.rect(5,18,16,5,C.goldDeep);
    p.rect(6,19,14,2,C.gold);
    p.rect(9,23,8,5,C.white);
    p.rect(3,25,20,4,C.lineSoft);
    p.rect(5,25,16,2,C.whiteShadow);
  });
  pixelCanvas(scene,'head',22,25,p=>{
    p.rect(5,1,12,3,C.line);
    p.rect(3,4,16,17,C.line);
    p.rect(5,3,12,18,C.skin);
    p.rect(7,3,9,14,C.skinLight);
    p.rect(4,15,2,5,C.skinShade);
    p.rect(18,13,2,5,C.skinShade);
    p.rect(5,21,11,2,C.lineSoft);
    // Dark framed glasses, visible blue eyes, nose and a small smile.
    p.rect(4,9,7,6,C.black);p.rect(12,9,7,6,C.black);
    p.rect(6,10,4,4,C.skinLight);p.rect(13,10,4,4,C.skinLight);
    p.rect(7,11,2,2,C.blueDark);p.dot(8,11,C.mint);
    p.rect(14,11,2,2,C.blueDark);p.dot(15,11,C.mint);
    p.rect(11,10,1,2,C.black);
    p.rect(15,16,2,1,C.skinShade);
    p.rect(12,19,5,1,C.rose);
    p.rect(13,20,3,1,C.lineSoft);
  });
  pixelCanvas(scene,'hairBack',29,29,p=>{
    p.rect(4,3,21,22,C.line);
    p.rect(5,1,19,26,C.hairShade);
    p.rect(7,3,16,19,C.hair);
    p.rect(8,2,11,9,C.hairLight);
    p.rect(3,9,6,17,C.hair);
    p.rect(21,8,5,18,C.hairShade);
    p.rect(3,24,7,4,C.hairShade);
    p.rect(20,23,7,4,C.hairShade);
    p.rect(7,23,4,3,C.hairLight);
  });
  pixelCanvas(scene,'hairFront',27,19,p=>{
    p.rect(3,3,21,11,C.line);
    p.rect(3,2,20,10,C.hairShade);
    p.rect(5,2,17,8,C.hair);
    p.rect(8,1,11,4,C.hairLight);
    p.rect(3,9,6,9,C.hairShade);
    p.rect(4,9,3,6,C.hairLight);
    p.rect(20,7,5,10,C.hair);
    p.rect(20,12,4,5,C.hairShade);
    p.rect(10,9,10,3,C.hairLight);
    p.rect(17,10,5,2,C.hairShade);
  });
  pixelCanvas(scene,'upperArm',10,19,p=>{
    p.rect(1,0,8,17,C.line);
    p.rect(2,1,6,11,C.white);
    p.rect(2,6,2,6,C.whiteShadow);
    p.rect(3,12,5,6,C.skin);
    p.rect(4,13,3,4,C.skinLight);
    p.rect(1,2,8,3,C.gold);
    p.rect(2,5,6,1,C.whiteShadow);
    p.rect(3,16,5,2,C.skinShade);
  });
  pixelCanvas(scene,'forearm',10,17,p=>{
    p.rect(1,0,8,16,C.line);
    p.rect(2,1,6,13,C.skin);
    p.rect(4,2,3,10,C.skinLight);
    p.rect(1,11,8,4,C.white);
    p.rect(2,12,6,2,C.gold);
    p.rect(2,15,6,2,C.lineSoft);
  });
  pixelCanvas(scene,'hand',8,9,p=>{
    p.rect(1,1,6,7,C.line);
    p.rect(2,1,5,6,C.skin);
    p.rect(3,2,3,4,C.skinLight);
    p.rect(1,5,2,3,C.skinShade);
  });
  pixelCanvas(scene,'thigh',12,20,p=>{
    p.rect(1,0,10,19,C.line);
    p.rect(2,1,8,17,C.whiteShadow);
    p.rect(3,1,5,14,C.white);
    p.rect(3,14,7,4,C.bootShade);
    p.rect(3,17,6,2,C.gold);
    p.rect(2,3,2,3,C.roseLight);
  });
  pixelCanvas(scene,'shin',12,21,p=>{
    p.rect(1,1,10,18,C.line);
    p.rect(2,1,8,17,C.bootShade);
    p.rect(3,2,6,16,C.boot);
    p.rect(3,3,2,10,C.white);
    p.rect(7,5,1,9,C.gold);
    p.rect(2,17,8,3,C.goldDeep);
    p.rect(3,18,6,1,C.gold);
  });
  pixelCanvas(scene,'shoe',17,9,p=>{
    p.rect(1,2,15,6,C.line);
    p.rect(1,3,14,4,C.bootShade);
    p.rect(3,1,9,6,C.boot);
    p.rect(6,2,6,2,C.white);
    p.rect(1,7,15,2,C.line);
    p.rect(11,5,4,1,C.gold);
  });
  pixelCanvas(scene,'skirtBack',31,18,p=>{
    p.triangle([7,0],[0,16],[16,18],C.lineSoft);
    p.triangle([24,0],[15,18],[30,16],C.line);
    p.triangle([7,2],[2,15],[17,15],C.whiteShadow);
    p.triangle([23,2],[15,15],[28,14],C.roseLight);
    p.rect(4,13,6,2,C.gold);
    p.rect(22,13,5,2,C.gold);
  });
  pixelCanvas(scene,'skirtFront',30,18,p=>{
    p.triangle([7,0],[1,15],[14,17],C.line);
    p.triangle([21,0],[12,17],[29,15],C.lineSoft);
    p.triangle([8,1],[3,14],[14,15],C.white);
    p.triangle([21,1],[14,15],[27,13],C.whiteShadow);
    p.triangle([14,1],[10,16],[21,16],C.roseLight);
    p.rect(3,13,8,2,C.gold);
    p.rect(20,13,7,2,C.gold);
    p.rect(13,13,5,2,C.goldDeep);
    p.rect(8,1,14,2,C.gold);
  });
  pixelCanvas(scene,'cape',28,34,p=>{
    p.triangle([18,1],[1,31],[25,25],C.lineSoft);
    p.triangle([17,2],[3,30],[22,25],C.whiteShadow);
    p.triangle([16,5],[9,30],[21,22],C.white);
    p.rect(7,27,7,2,C.roseLight);
    p.rect(14,24,7,2,C.gold);
    p.rect(13,3,6,3,C.gold);
  });
  pixelCanvas(scene,'fan',32,30,p=>{
    const origin:[number,number]=[4,27];
    p.triangle(origin,[3,4],[13,1],C.line);
    p.triangle(origin,[13,1],[23,3],C.line);
    p.triangle(origin,[23,3],[30,10],C.line);
    p.triangle(origin,[5,5],[13,3],C.white);
    p.triangle(origin,[13,3],[22,5],C.whiteShadow);
    p.triangle(origin,[22,5],[28,11],C.white);
    p.triangle(origin,[9,12],[20,12],C.roseLight);
    p.line(4,27,5,4,C.goldDeep);
    p.line(4,27,13,2,C.goldDeep);
    p.line(4,27,22,4,C.goldDeep);
    p.line(4,27,29,10,C.goldDeep);
    p.rect(2,24,5,5,C.goldDeep);
    p.rect(3,25,3,3,C.gold);
    p.dot(4,26,C.white);
    p.rect(12,8,4,2,C.mint);
    p.rect(21,10,2,2,C.mint);
    p.rect(24,12,2,2,C.gold);
  });
}

export class EviPixelPuppet {
  readonly root:Phaser.GameObjects.Container;
  private readonly hip:Phaser.GameObjects.Container;
  private readonly torso:Phaser.GameObjects.Container;
  private readonly head:Phaser.GameObjects.Container;
  private readonly upperL:Phaser.GameObjects.Container;
  private readonly upperR:Phaser.GameObjects.Container;
  private readonly forearmL:Phaser.GameObjects.Container;
  private readonly forearmR:Phaser.GameObjects.Container;
  private readonly legL:Phaser.GameObjects.Container;
  private readonly legR:Phaser.GameObjects.Container;
  private readonly shinL:Phaser.GameObjects.Container;
  private readonly shinR:Phaser.GameObjects.Container;
  private readonly footL:Phaser.GameObjects.Image;
  private readonly footR:Phaser.GameObjects.Image;
  private readonly fan:Phaser.GameObjects.Image;
  private readonly slashFx:Phaser.GameObjects.Graphics;
  private slashTrail:{point:Point;age:number;strength:number}[]=[];
  private previousSlashElapsed=0;
  private readonly frontHair:Phaser.GameObjects.Image;
  private readonly backHair:Phaser.GameObjects.Image;
  private readonly skirt:Phaser.GameObjects.Image;
  private readonly cape:Phaser.GameObjects.Image;
  private pose:EviPose=neutralEviPose();
  private lastName:EviMotionInput['name']='idle';

  constructor(scene:Phaser.Scene){
    ensurePixelTextures(scene);
    const image=(key:string,x:number,y:number,ox=.5,oy=.5)=>{
      const sprite=scene.add.image(x,y,PREFIX+key)
        .setOrigin(ox,oy).setScale(2);
      return sprite;
    };
    const joint=(x:number,y:number)=>scene.add.container(x,y);
    this.root=joint(0,0);
    this.hip=joint(0,-65);
    this.root.add(this.hip);
    this.cape=image('cape',-10,-34,.63,.14);
    this.hip.add(this.cape);
    this.hip.add(image('skirtBack',0,-8,.5,0));

    this.legL=joint(-11,-1);
    this.legR=joint(11,-1);
    this.hip.add([this.legL,this.legR]);
    for(const leg of [this.legL,this.legR]){
      leg.add(image('thigh',0,0,.5,.08));
    }
    this.shinL=joint(0,33);
    this.shinR=joint(0,33);
    this.legL.add(this.shinL);this.legR.add(this.shinR);
    this.shinL.add(image('shin',0,0,.5,.07));
    this.shinR.add(image('shin',0,0,.5,.07));
    this.footL=image('shoe',-4,32,.20,.45);
    this.footR=image('shoe',-4,32,.20,.45);
    this.shinL.add(this.footL);this.shinR.add(this.footR);

    this.torso=joint(0,0);
    this.hip.add(this.torso);
    this.torso.add(image('torso',0,1,.5,.99));
    this.skirt=image('skirtFront',0,-9,.5,0);
    this.torso.add(this.skirt);
    this.upperL=joint(-19,-53);
    this.upperR=joint(19,-53);
    this.torso.add(this.upperL);
    this.upperL.add(image('upperArm',0,0,.5,.07));
    this.forearmL=joint(0,29);
    this.upperL.add(this.forearmL);
    this.forearmL.add(image('forearm',0,0,.5,.07));
    this.forearmL.add(image('hand',0,29,.5,.2));

    this.upperR.add(image('upperArm',0,0,.5,.07));
    this.torso.add(this.upperR);
    this.forearmR=joint(0,29);
    this.upperR.add(this.forearmR);
    this.forearmR.add(image('forearm',0,0,.5,.07));
    this.forearmR.add(image('hand',0,29,.5,.2));
    this.fan=image('fan',0,29,.13,.90);
    this.forearmR.add(this.fan);

    this.head=joint(0,-69);
    this.torso.add(this.head);
    this.backHair=image('hairBack',-3,-5,.5,.51);
    this.head.add(this.backHair);
    this.head.add(image('head',0,1,.5,.50));
    this.frontHair=image('hairFront',-1,-12,.5,.42);
    this.head.add(this.frontHair);
    // Overlay is parented to the same mirrorable 2D skeleton as the fan.
    // One reused Graphics object draws a short-lived ribbon, never
    // allocates a new particle per frame or changes a gameplay hitbox.
    this.slashFx=scene.add.graphics();
    this.root.add(this.slashFx);
    this.applyPose(this.pose);
  }

  setVisible(visible:boolean):void{
    this.root.setVisible(visible);
    if(!visible){
      this.slashTrail.length=0;
      this.slashFx.clear();
    }
  }

  update(input:EviMotionInput,dt:number,hitFlash=false):void {
    const next=eviPoseFor(input);
    const newAttack=input.name!==this.lastName ||
      (isEviFanSlash(input.name) &&
       (input.elapsed??0)<this.previousSlashElapsed-.02);
    if(newAttack)this.slashTrail.length=0;
    this.lastName=input.name;
    this.previousSlashElapsed=input.elapsed??0;
    this.pose=blendEviPose(this.pose,next,dt);
    this.applyPose(this.pose);
    this.updateSlashTrail(input,dt);
    if(input.name==='roll'){
      // Genuine tucked somersault with recalculated ground contact every
      // frame. Parent Fighter remains anchored to x / GROUND_Y.
      const tumble=groundedEviTumble(input.progress??0,input.backwards);
      this.root.setPosition(tumble.x,tumble.y);
      this.root.setRotation(tumble.angle);
    }else{
      // Restore neutral transform after dodging, including interrupted rolls.
      this.root.setPosition(0,0);
      this.root.setRotation(0);
    }
    // Tint the whole puppet on contact; no additional GPU textures.
    this.root.setAlpha(hitFlash ? 0.81 : 1);
  }

  /** Three narrow, fading pixel ribbons follow the REAL bladed-fan tip
   * through the near-horizontal strike. FX exist only for the outgoing
   * fan moves, so guarding, kicking and idling never paint ghost trails.
   */
  private updateSlashTrail(input:EviMotionInput,dt:number):void{
    if(dt>0){
      for(const point of this.slashTrail)point.age+=dt;
      this.slashTrail=this.slashTrail.filter(
        point=>point.age<EVI_FAN_TRAIL_LIFETIME);
    }
    const glow=eviSlashGlow(input);
    if(glow>.045 && dt>0 && this.root.visible){
      const tip=eviFanTip(this.pose);
      const last=this.slashTrail[this.slashTrail.length-1];
      if(!last || Math.hypot(tip.x-last.point.x,tip.y-last.point.y)>1.5){
        this.slashTrail.push({point:tip,age:0,strength:glow});
        if(this.slashTrail.length>15)this.slashTrail.shift();
      }
    }
    this.slashFx.clear();
    const color=input.name==='special'?0x9cfaff:
      input.name==='duel'?0xeac0ff:0xffc8ee;
    for(let i=1;i<this.slashTrail.length;i++){
      const from=this.slashTrail[i-1],to=this.slashTrail[i];
      const life=1-to.age/EVI_FAN_TRAIL_LIFETIME;
      const alpha=Math.max(0,life*life*to.strength);
      if(alpha<.025)continue;
      const x1=from.point.x,y1=from.point.y;
      const x2=to.point.x,y2=to.point.y;
      this.slashFx.lineStyle(9,color,alpha*.20);
      this.slashFx.lineBetween(x1,y1,x2,y2);
      this.slashFx.lineStyle(5,0xfff1da,alpha*.53);
      this.slashFx.lineBetween(x1,y1,x2,y2);
      this.slashFx.lineStyle(2,0xffffff,alpha*.98);
      this.slashFx.lineBetween(x1,y1,x2,y2);
    }
    if(glow>.55 && this.slashTrail.length>1){
      const tip=this.slashTrail[this.slashTrail.length-1].point;
      this.slashFx.fillStyle(0xffffff,.45*glow);
      this.slashFx.fillTriangle(tip.x+6,tip.y,
        tip.x-3,tip.y-3,tip.x-3,tip.y+3);
    }
  }

  private applyPose(p:EviPose):void {
    const px=(n:number)=>Math.round(n*2)/2;
    this.hip.setPosition(0,px(-65+p.hipY));
    this.hip.setRotation(p.hipTilt);
    this.torso.setRotation(p.torsoTilt);
    this.torso.setScale(1,p.bodySquash);
    this.head.setRotation(p.headTilt);
    this.upperL.setRotation(p.armL);
    this.upperR.setRotation(p.armR);
    this.forearmL.setRotation(p.elbowL);
    this.forearmR.setRotation(p.elbowR);
    this.legL.setRotation(p.legL);
    this.legR.setRotation(p.legR);
    this.shinL.setRotation(p.kneeL);
    this.shinR.setRotation(p.kneeR);
    this.footL.setRotation(p.footL);
    this.footR.setRotation(p.footR);
    // The broad fan faces the rival (+X local, mirrored by Fighter.face).
    // Cancel shoulder/elbow angles rather than letting them aim its blades
    // backward into Evi's face during her horizontal swing.
    this.fan.setRotation(eviFanLocalRotation(p));
    this.fan.setScale(2*p.fanScale);
    this.skirt.setRotation(p.skirtTilt);
    this.frontHair.setRotation(p.hairSwing*.35);
    this.backHair.setRotation(p.hairSwing);
    this.cape.setRotation(-p.torsoTilt*.32-p.hairSwing*.28);
  }

  destroy():void {
    this.root.destroy(true);
    // Textures are shared by both fighters and remain cached in the scene.
  }
}
