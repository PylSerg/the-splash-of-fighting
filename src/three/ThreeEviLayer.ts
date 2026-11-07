import * as THREE from 'three';
import {eviPoseFor,blendEviPose,neutralEviPose,type EviPose,type EviMotionInput} from '../combat/EviRigMotion.ts';
import {eviSlashGlow,isEviFanSlash} from '../combat/EviFanSlash.ts';
import {threeGroundedRoll,screenToThree,threeViewDimensions,THREE_ROLL_PIVOT} from './ThreeFighterRules.ts';
import {threeEviStance} from './ThreeEviStance.ts';
import {
  eviHandTargets,blendEviHands,solveEviArm,eviFanSwingAngles,
  type HandTargets,
} from './EviArmMotion.ts';
import {
  eviGroundedFootTargets,shouldPlantEviFeet,solveTwoBoneLeg,
  type Vec3,
} from './EviAnatomy.ts';
import type {FighterId} from '../combat/Fighter.ts';

export interface ThreeFighterFrame {
  id:FighterId;
  x:number;
  face:1|-1;
  yOffset:number;
  motion:EviMotionInput;
  hitFlash:boolean;
}
export interface ThreeBattleFrame {
  fighters:readonly [ThreeFighterFrame,ThreeFighterFrame];
  logicalWidth:number;
  frozen?:boolean;
}
const skin=0xe5ad89,skinLight=0xffd1ad;
const cream=0xfff4e6,white=0xffffff,lace=0xf4e6f1;
const gold=0xdab668,goldLight=0xffdc88,pink=0xf4a5bc;
const blonde=0xf6d28f,blondeShade=0xc99b59;
const ink=0x323149,iris=0x408cc9;

function material(color:number,metalness=0,roughness=.65):THREE.MeshStandardMaterial{
  return new THREE.MeshStandardMaterial({color,metalness,roughness,side:THREE.DoubleSide});
}
function obj(mesh:THREE.Object3D,parent:THREE.Group,x=0,y=0,z=0):void{
  mesh.position.set(x,y,z);parent.add(mesh);
}
function ellipsoid(parent:THREE.Group,color:number,
  x:number,y:number,z:number,
  sx:number,sy:number,sz:number,
  matte?:THREE.Material):THREE.Mesh{
  const geometry=new THREE.SphereGeometry(1,20,14);
  const mesh=new THREE.Mesh(geometry,matte??material(color));
  mesh.scale.set(sx,sy,sz);obj(mesh,parent,x,y,z);
  return mesh;
}
function taper(parent:THREE.Group,color:number,
  x:number,y:number,z:number,
  top:number,bottom:number,length:number,segments=14,
  mat?:THREE.Material):THREE.Mesh{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,length,segments),
    mat??material(color));
  obj(mesh,parent,x,y,z);return mesh;
}
function tube(parent:THREE.Group,color:number,
  points:THREE.Vector3[],radius=.013):THREE.Mesh{
  const path=new THREE.CatmullRomCurve3(points);
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,Math.max(8,points.length*4),radius,5,false),
    material(color,.25,.4));
  parent.add(mesh);return mesh;
}
function ring(parent:THREE.Group,color:number,x:number,y:number,z:number,r:number,t=.009):THREE.Mesh{
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,t,5,26),material(color,.28,.38));
  obj(mesh,parent,x,y,z);return mesh;
}

/** This first Evi is a REAL 3D model assembled from shaded meshes with a
 * parent/child joint hierarchy. Not a rotated 2D sprite or CSS illustration.
 * Her meshes can later be replaced one-for-one by a skinned GLB model.
 */
class EviThreeCharacter{
  readonly root=new THREE.Group();
  private readonly pivot=new THREE.Group();
  private readonly sculpture=new THREE.Group();
  private readonly pelvis=new THREE.Group();
  private readonly chest=new THREE.Group();
  private readonly head=new THREE.Group();
  private readonly leftShoulder=new THREE.Group();
  private readonly rightShoulder=new THREE.Group();
  private readonly leftElbow=new THREE.Group();
  private readonly rightElbow=new THREE.Group();
  private readonly leftWrist=new THREE.Group();
  private readonly rightWrist=new THREE.Group();
  private readonly leftHip=new THREE.Group();
  private readonly rightHip=new THREE.Group();
  private readonly leftKnee=new THREE.Group();
  private readonly rightKnee=new THREE.Group();
  private readonly leftFoot=new THREE.Group();
  private readonly rightFoot=new THREE.Group();
  private readonly fan=new THREE.Group();
  private readonly hem:THREE.Group[]=[];
  private readonly irises:THREE.Mesh[]=[];
  private readonly trailLine:THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>;
  private readonly trail:{position:THREE.Vector3;age:number;brightness:number}[]=[];
  private readonly pearl:THREE.Mesh;
  private pose:EviPose=neutralEviPose();
  private lastAction='idle';
  private lastElapsed=0;
  private handTargets:HandTargets=eviHandTargets(
    {name:'idle',time:0},neutralEviPose());

  constructor(private readonly scene:THREE.Scene){
    this.pivot.position.y=THREE_ROLL_PIVOT;
    this.sculpture.position.y=-THREE_ROLL_PIVOT;
    this.root.add(this.pivot);
    this.pivot.add(this.sculpture);
    this.sculpture.add(this.pelvis);
    this.buildGeometry();
    const geometry=new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),new THREE.Vector3()]);
    this.trailLine=new THREE.Line(geometry,new THREE.LineBasicMaterial({
      color:0xffd9f4,transparent:true,opacity:.85,depthTest:false,
    }));
    this.trailLine.renderOrder=100;
    this.trailLine.visible=false;
    this.scene.add(this.trailLine);
    this.pearl=ellipsoid(this.scene as unknown as THREE.Group,white,
      0,0,0,.043,.043,.043,new THREE.MeshBasicMaterial({color:0xfffaf5}));
    this.pearl.visible=false;
    this.pearl.renderOrder=101;
    this.scene.add(this.root);
  }

  private buildGeometry():void{
    // Anatomically continuous proportions, tapered limbs and a fitted
    // white-and-gold fantasy fighting costume. All parts have real depth.
    ellipsoid(this.pelvis,skin,0,.99,0,.205,.19,.14);
    const dress=material(cream,.07,.5);
    const satin=material(white,.1,.47);
    const trim=material(gold,.56,.33);
    // A continuous anatomical waist overlaps the upper pelvis and lower
    // corset. No gap opens when the hips turn separately from the chest.
    ellipsoid(this.pelvis,cream,0,1.13,0,.183,.195,.137,dress);
    this.chest.position.set(0,1.12,0);
    this.pelvis.add(this.chest);
    ellipsoid(this.chest,cream,0,.28,0,.245,.32,.162,dress);
    ellipsoid(this.chest,white,-.115,.39,.103,.125,.155,.09,satin);
    ellipsoid(this.chest,white,.115,.39,.103,.125,.155,.09,satin);
    // Cloth and corset have depth; a gold centrepiece and slender side trims.
    taper(this.chest,gold,0,.055,.125,.19,.155,.072,20,trim);
    ellipsoid(this.chest,goldLight,0,.43,.17,.043,.061,.026,trim);
    for(const side of [-1,1]){
      tube(this.chest,gold,[
        new THREE.Vector3(side*.135,.11,.135),
        new THREE.Vector3(side*.16,.30,.142),
        new THREE.Vector3(side*.13,.50,.10),
      ],.010);
      ellipsoid(this.chest,cream,side*.16,.56,-.012,.10,.055,.086);
      ellipsoid(this.chest,goldLight,side*.22,.54,.04,.026,.034,.021);
    }
    // Tiny criss-cross lace on centre bodice, at the front.
    for(let i=0;i<5;i++){
      const h=.14+i*.048;
      tube(this.chest,pink,[
        new THREE.Vector3(-.045,h,.162),new THREE.Vector3(.045,h+.035,.162)
      ],.005);
      tube(this.chest,pink,[
        new THREE.Vector3(.045,h,.162),new THREE.Vector3(-.045,h+.035,.162)
      ],.005);
    }
    // Six independently swaying silk/lace skirt panels, with open side
    // movement for leg readability in attacks and jumps.
    for(let n=0;n<8;n++){
      const angle=n*Math.PI*2/8;
      const sway=new THREE.Group();
      sway.position.set(Math.sin(angle)*.17,.99,Math.cos(angle)*.125);
      this.pelvis.add(sway);sway.rotation.y=angle;
      const shape=new THREE.Shape();
      shape.moveTo(-.08,0);shape.lineTo(.08,0);
      shape.lineTo(.15,-.49);shape.quadraticCurveTo(0,-.57,-.155,-.49);
      shape.closePath();
      const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape,6),
        new THREE.MeshStandardMaterial({
          color:n%2===0?cream:lace,side:THREE.DoubleSide,
          transparent:true,opacity:n%3===0?.82:.97,roughness:.48,
        }));
      mesh.position.z=.026;
      sway.add(mesh);
      tube(sway,gold,[
        new THREE.Vector3(-.155,-.49,.028),
        new THREE.Vector3(0,-.54,.028),
        new THREE.Vector3(.15,-.49,.028),
      ],.008);
      for(let j=0;j<3;j++){
        const y=-.17-j*.085;
        tube(sway,n%2?white:pink,[
          new THREE.Vector3(-.05,y,.031),
          new THREE.Vector3(0,y-.025,.031),
          new THREE.Vector3(.06,y,.031),
        ],.004);
      }
      this.hem.push(sway);
    }
    // Hips, knees, shin bones, boot cuffs and heeled footwear.
    for(const side of [-1,1]){
      const hip=side<0?this.leftHip:this.rightHip;
      const knee=side<0?this.leftKnee:this.rightKnee;
      hip.position.set(side*.142,.97,0);
      this.pelvis.add(hip);
      taper(hip,skin,0,-.28,0,.145,.108,.56);
      ellipsoid(hip,skin,0,-.02,0,.14,.10,.125);
      knee.position.y=-.53;
      hip.add(knee);
      ellipsoid(knee,skin,0,0,.006,.115,.13,.105);
      taper(knee,cream,0,-.29,0,.112,.093,.55,14,satin);
      // Decorative over-knee white lace boots.
      ring(knee,gold,0,-.08,.015,.107,.008);
      ellipsoid(knee,gold,0,-.49,.055,.034,.03,.025,trim);
      // The boots are individual toe/heel joints. Both feet can turn
      // along the fighting line instead of being glued to the camera plane.
      const foot=side<0?this.leftFoot:this.rightFoot;
      // The ankle pivot sits exactly at the end of the .57 lower leg.
      // This is essential for a mathematically planted two-bone IK solve.
      foot.position.set(0,-.57,0);
      knee.add(foot);
      ellipsoid(foot,white,side*.01,0,.045,.133,.07,.219,satin);
      ellipsoid(foot,cream,0,-.02,-.10,.105,.055,.17,satin);
      ellipsoid(foot,gold,0,-.047,.06,.120,.018,.15,trim);
      for(let j=0;j<3;j++){
        const py=-.14-j*.116;
        ellipsoid(knee,goldLight,.098,py,.028,.008,.019,.012,trim);
      }
    }
    // Anatomical RIGHT is -X for a character whose face points +Z.
    // Previously side>0 was called "right", which was actually the
    // character's LEFT arm in the camera-facing coordinate system.
    for(const side of [-1,1]){
      const anatomicalRight=side<0;
      const shoulder=anatomicalRight?this.rightShoulder:this.leftShoulder;
      const elbow=anatomicalRight?this.rightElbow:this.leftElbow;
      shoulder.position.set(side*.252,.55,anatomicalRight?.075:-.075);
      this.chest.add(shoulder);
      // Shoulder sockets overlap the upper chest, so the moving upper
      // arms have an anatomical join rather than a detached ball joint.
      ellipsoid(this.chest,skin,side*.226,.53,anatomicalRight?.060:-.055,
        .114,.111,.104);
      ellipsoid(shoulder,skin,0,-.045,0,.115,.113,.106);
      taper(shoulder,skin,0,-.205,0,.09,.066,.34);
      ring(shoulder,gold,0,-.06,.0,.095,.008);
      elbow.position.set(0,-.37,0);
      shoulder.add(elbow);
      ellipsoid(elbow,skin,0,0,0,.074,.081,.078);
      taper(elbow,skinLight,0,-.18,.0,.075,.055,.33);
      // Pale glove and lacy bell cuff, independent of arm rotation.
      taper(elbow,white,0,-.27,.009,.064,.065,.17,12,satin);
      ring(elbow,goldLight,0,-.22,.015,.071,.009);
      const wrist=anatomicalRight?this.rightWrist:this.leftWrist;
      wrist.position.set(0,-.38,.015);
      elbow.add(wrist);
      // The fingers and fan share a genuine wrist joint. The right
      // glove cannot switch to the left hand during a mirror or roll.
      ellipsoid(wrist,skin,0,0,0,.065,.089,.064);
      const cuff=new THREE.Mesh(new THREE.ConeGeometry(.13,.24,12,1,true),
        new THREE.MeshStandardMaterial({color:lace,transparent:true,
          opacity:.68,roughness:.8,side:THREE.DoubleSide}));
      cuff.rotation.z=Math.PI;
      obj(cuff,elbow,0,-.31,-.04);
    }
    // Only the ANATOMICAL RIGHT wrist owns the fan. The parent hierarchy
    // is never swapped during left-facing, rolls, grabs or 3D rotation.
    this.fan.position.set(.06,-.02,.07);
    this.rightWrist.add(this.fan);
    const shape=new THREE.Shape();
    shape.moveTo(0,0);
    const radius=.45;
    for(let i=0;i<=12;i++){
      const a=-.77+i*1.54/12;
      shape.lineTo(Math.cos(a)*radius,Math.sin(a)*radius);
    }
    shape.closePath();
    const leaf=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{
      depth:.022,bevelEnabled:false,steps:1,curveSegments:4,
    }),new THREE.MeshStandardMaterial({color:white,metalness:.13,roughness:.36,
      transparent:true,opacity:.96,side:THREE.DoubleSide}));
    leaf.position.z=.015;
    this.fan.add(leaf);
    for(let i=0;i<=7;i++){
      const a=-.77+i*1.54/7;
      const outer=new THREE.Vector3(Math.cos(a)*radius,Math.sin(a)*radius,.046);
      tube(this.fan,i===0||i===7?goldLight:gold,[
        new THREE.Vector3(0,0,.048),outer
      ],i===0||i===7?.011:.0065);
      ellipsoid(this.fan,goldLight,outer.x,outer.y,.046,.018,.018,.014,trim);
    }
    tube(this.fan,pink,Array.from({length:11},(_,i)=>{
      const a=-.72+i*1.44/10;
      return new THREE.Vector3(Math.cos(a)*.31,Math.sin(a)*.31,.055);
    }),.009);
    ellipsoid(this.fan,gold,0,0,.066,.042,.042,.02,trim);
    // Neck and a recognisable face with blue eyes, glasses, blonde bob.
    taper(this.chest,skin,0,.68,0,.085,.09,.16);
    this.head.position.set(0,.795,.02);
    this.chest.add(this.head);
    ellipsoid(this.head,blondeShade,0,.01,-.045,.264,.273,.223);
    ellipsoid(this.head,skin,0,0,.045,.217,.249,.184);
    ellipsoid(this.head,skinLight,0,-.065,.203,.079,.073,.055);
    ellipsoid(this.head,pink,0,-.153,.205,.061,.014,.009);
    // White of eyes, cyan iris, pupils & specular dots.
    for(const side of [-1,1]){
      ellipsoid(this.head,white,side*.092,.037,.214,.067,.037,.011);
      const eye=ellipsoid(this.head,iris,side*.092,.036,.228,.029,.032,.01);
      this.irises.push(eye);
      ellipsoid(this.head,ink,side*.093,.034,.236,.016,.025,.007);
      ellipsoid(this.head,white,side*.083,.051,.242,.009,.010,.006);
      tube(this.head,ink,[
        new THREE.Vector3(side*.033,.100,.214),
        new THREE.Vector3(side*.11,.103,.206),
        new THREE.Vector3(side*.151,.092,.176),
      ],.009);
      const glass=new THREE.Mesh(new THREE.TorusGeometry(.086,.011,7,28),
        material(ink,.22,.42));
      glass.scale.y=.82;
      obj(glass,this.head,side*.092,.035,.227);
    }
    tube(this.head,ink,[
      new THREE.Vector3(-.018,.050,.245),
      new THREE.Vector3(.018,.050,.245),
    ],.008);
    for(const side of [-1,1]){
      tube(this.head,ink,[
        new THREE.Vector3(side*.167,.051,.225),
        new THREE.Vector3(side*.21,.067,.135),
      ],.01);
      // Side-bob locks fall just below jaw.
      for(let i=0;i<3;i++){
        const strand=ellipsoid(this.head,i%2?blonde:blondeShade,
          side*(.211+i*.012),-.10-i*.024,-.035,
          .064,.165+i*.018,.082);
        strand.rotation.z=side*(.06+i*.06);
      }
      ellipsoid(this.head,goldLight,side*.22,-.11,.035,.022,.04,.018,trim);
    }
    ellipsoid(this.head,blonde,0,.185,-.006,.231,.125,.187);
    // Carefully shaped bangs sweep diagonally over the forehead.
    for(let i=0;i<6;i++){
      const strand=ellipsoid(this.head,i%2?blonde:blondeShade,
        -.16+i*.063,.17-i*.022,.125,
        .051,.11,.045);
      strand.rotation.z=-.28+i*.055;
    }
    ellipsoid(this.head,blonde,0,.265,-.04,.15,.060,.136);
  }

  /** Solves hip -> knee -> ankle in actual 3D and keeps boot soles upright.
   * Quaternions rotate the original tapered meshes, never the hitboxes.
   */
  private plantLeg(
    hip:THREE.Group,knee:THREE.Group,foot:THREE.Group,
    ankle:Vec3,footYaw:number,
  ):void {
    const solved=solveTwoBoneLeg({
      x:hip.position.x,y:hip.position.y,z:hip.position.z,
    },ankle);
    const down=new THREE.Vector3(0,-1,0);
    const upper=new THREE.Vector3(
      solved.upper.x,solved.upper.y,solved.upper.z);
    const lower=new THREE.Vector3(
      solved.lower.x,solved.lower.y,solved.lower.z);
    hip.quaternion.setFromUnitVectors(down,upper);
    const hipInverse=hip.quaternion.clone().invert();
    const kneeLocalDirection=lower.applyQuaternion(hipInverse);
    knee.quaternion.setFromUnitVectors(down,kneeLocalDirection);
    // The ankles inherit both bent bones. Undo those rotations before
    // applying the desired local toe orientation, so boots stay level.
    const jointRotation=hip.quaternion.clone().multiply(knee.quaternion);
    const bootRotation=new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0,1,0),footYaw);
    foot.quaternion.copy(jointRotation.invert().multiply(bootRotation));
  }

  /** Independent 3D shoulder -> elbow -> wrist IK, with a wrist that
   * cancels accumulated arm rotation so the fan always points forward.
   */
  private plantArm(
    shoulder:THREE.Group,elbow:THREE.Group,wrist:THREE.Group,
    goal:Vec3,right:boolean,
  ):void{
    const solved=solveEviArm(right,goal);
    const down=new THREE.Vector3(0,-1,0);
    const upper=new THREE.Vector3(
      solved.upper.x,solved.upper.y,solved.upper.z);
    const lower=new THREE.Vector3(
      solved.lower.x,solved.lower.y,solved.lower.z);
    shoulder.quaternion.setFromUnitVectors(down,upper);
    const elbowLocal=lower.applyQuaternion(shoulder.quaternion.clone().invert());
    elbow.quaternion.setFromUnitVectors(down,elbowLocal);
    // Keep wrist orientation steady while shoulder and elbow bend.
    wrist.quaternion.copy(
      shoulder.quaternion.clone().multiply(elbow.quaternion).invert());
  }

  private currentRollContacts():readonly (readonly [number,number])[]{
    // These are sampled from the REAL animated 3D skeleton, rather than
    // a rectangle pretending to be the fighter's body.
    this.sculpture.updateMatrixWorld(true);
    const inverse=this.sculpture.matrixWorld.clone().invert();
    const marks:readonly [THREE.Object3D,THREE.Vector3][]=[
      [this.head,new THREE.Vector3(0,.29,0)],
      [this.head,new THREE.Vector3(-.23,.05,0)],
      [this.head,new THREE.Vector3(.23,.05,0)],
      [this.leftShoulder,new THREE.Vector3()],
      [this.rightShoulder,new THREE.Vector3()],
      [this.leftElbow,new THREE.Vector3()],
      [this.rightElbow,new THREE.Vector3()],
      [this.leftWrist,new THREE.Vector3()],
      [this.rightWrist,new THREE.Vector3()],
      [this.pelvis,new THREE.Vector3(0,1.1,0)],
      [this.leftHip,new THREE.Vector3()],
      [this.rightHip,new THREE.Vector3()],
      [this.leftKnee,new THREE.Vector3()],
      [this.rightKnee,new THREE.Vector3()],
      [this.leftFoot,new THREE.Vector3(0,-.09,0)],
      [this.rightFoot,new THREE.Vector3(0,-.09,0)],
      [this.fan,new THREE.Vector3(.42,0,.06)],
    ];
    return marks.map(([node,offset])=>{
      const p=node.localToWorld(offset.clone()).applyMatrix4(inverse);
      return [p.x,p.y] as const;
    });
  }

  update(frame:ThreeFighterFrame,dt:number):void{
    const input=frame.motion;
    const newPose=eviPoseFor(input);
    this.pose=blendEviPose(this.pose,newPose,dt);
    const p=this.pose;
    // Camera is +Z; the opponent is ±X. Face the rival in a genuine 3/4
    // combat guard rather than presenting the costume straight at camera.
    // All values below are visual and never affect hitboxes, walk or damage.
    const stance=threeEviStance(frame.face,input);
    const blade=eviFanSwingAngles(input);
    const pos=screenToThree(frame.x,443+frame.yOffset);
    this.root.position.set(pos.x,pos.y,0);
    this.root.scale.set(frame.face,1,1);
    this.root.rotation.y=stance.rootYaw;
    this.pelvis.position.y=-p.hipY/100;
    this.pelvis.rotation.y=stance.pelvisYaw;
    this.chest.rotation.y=stance.chestYaw+blade.torsoYaw;
    this.chest.rotation.z=-p.torsoTilt*.8;
    this.chest.rotation.x=.06*Math.sin(input.time*2.3);
    this.head.rotation.y=stance.headYaw;
    this.head.rotation.z=-p.headTilt*.55;

    // Real two-bone IK replaces independent cardboard shoulder/elbow
    // rotations. The target wrist stays attached to the correct arm.
    const nextHands=eviHandTargets(input,p);
    // Do NOT low-pass the 3D attack wrist on the active frames.
    // The old 24 Hz smoothing delayed the almost-straight arm until AFTER
    // the Phaser hit had already happened, visually hiding the entire cut.
    // A windup has its own easing; normal guards retain joint smoothing.
    this.handTargets=isEviFanSlash(input.name)&&dt>0
      ?nextHands:blendEviHands(this.handTargets,nextHands,dt);
    this.plantArm(this.leftShoulder,this.leftElbow,this.leftWrist,
      this.handTargets.left,false);
    this.plantArm(this.rightShoulder,this.rightElbow,this.rightWrist,
      this.handTargets.right,true);

    // The front foot is closer to the enemy in 3D depth; the rear leg
    // carries the weight. Mirror the entire formation when face flips.
    this.leftHip.position.z=stance.rearHipDepth;
    this.rightHip.position.z=stance.leadHipDepth;
    if(shouldPlantEviFeet(input.name)){
      // Analytic 3D hip/knee/ankle positions. Crouching lowers the pelvis
      // but not the feet; the knees bend automatically to absorb it.
      const feet=eviGroundedFootTargets(p,input,stance);
      this.plantLeg(this.leftHip,this.leftKnee,this.leftFoot,
        feet.rear,stance.rearFootYaw);
      this.plantLeg(this.rightHip,this.rightKnee,this.rightFoot,
        feet.lead,stance.leadFootYaw);
    }else{
      // Airborne, tumbling and knockdown moves retain their existing
      // free leg animation. No artificial floor glue in midair.
      this.leftHip.rotation.set(stance.rearLegPitch,0,-p.legL*.8-.09);
      this.rightHip.rotation.set(stance.leadLegPitch,0,-p.legR*.8+.12);
      this.leftKnee.rotation.set(stance.rearKneePitch,0,-p.kneeL*.66);
      this.rightKnee.rotation.set(stance.leadKneePitch,0,-p.kneeR*.66);
      this.leftFoot.rotation.set(0,stance.rearFootYaw,0);
      this.rightFoot.rotation.set(0,stance.leadFootYaw,0);
    }

    // Preserve the anatomical right-hand attachment, but rotate the
    // OPEN blade through the cutting arc. Constant forward yaw made the
    // old motion look like repeated spear thrusts rather than fan slashes.
    this.fan.rotation.set(.16,stance.fanYaw+blade.yaw,.06+blade.roll,'XYZ');
    this.fan.scale.setScalar(.94+.1*p.fanScale);
    for(let i=0;i<this.hem.length;i++){
      const mesh=this.hem[i];
      mesh.rotation.z=p.skirtTilt*.7 + Math.sin(input.time*3+i*.68)*.028;
      mesh.rotation.x=Math.sin(input.time*3.5+i*.85)*.045;
    }
    const roll=input.name==='roll';
    const knocked=input.name==='fall'||input.name==='prone'||input.name==='rise';
    if(roll){
      // Recompute the floor contact from this frame's tucked 3D joints.
      // The fan stays parented to the right wrist throughout the turn.
      const r=threeGroundedRoll(input.progress??0,input.backwards,
        this.currentRollContacts());
      this.pivot.rotation.z=-r.angle;
      this.pivot.position.y=THREE_ROLL_PIVOT+r.lift;
    }else if(knocked){
      const target=input.name==='prone'?1:input.name==='rise'
        ?1-(input.progress??0):Math.min(1,input.progress??0);
      const r=threeGroundedRoll(target*.19);
      this.pivot.rotation.z=-r.angle;
      this.pivot.position.y=THREE_ROLL_PIVOT+r.lift;
    }else{
      this.pivot.rotation.z=0;
      this.pivot.position.y=THREE_ROLL_PIVOT;
    }
    // Ambient character flash from real hitstun; no damage applied here.
    this.root.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      const m=o.material;
      if(m instanceof THREE.MeshStandardMaterial && m.emissive){
        m.emissive.setHex(frame.hitFlash?0x7c1c40:0x000000);
        m.emissiveIntensity=frame.hitFlash?.3:0;
      }
    });
    this.root.updateMatrixWorld(true);
    const slash=eviSlashGlow(input);
    const isNew=input.name!==this.lastAction ||
      (input.elapsed??0)<this.lastElapsed-.02;
    if(isNew && slash>.05)this.trail.length=0;
    this.lastAction=input.name;this.lastElapsed=input.elapsed??0;
    if(dt>0){
      for(const point of this.trail)point.age+=dt;
      while(this.trail.length && this.trail[0].age>.19)this.trail.shift();
    }
    if(slash>.05 && dt>0){
      const point=this.fan.localToWorld(new THREE.Vector3(.46,0,.065));
      const last=this.trail[this.trail.length-1];
      if(!last||last.position.distanceTo(point)>.025){
        this.trail.push({position:point,age:0,brightness:slash});
        if(this.trail.length>16)this.trail.shift();
      }
    }
    this.trailLine.visible=this.trail.length>1;
    if(this.trailLine.visible){
      this.trailLine.geometry.setFromPoints(this.trail.map(t=>t.position));
      this.trailLine.material.opacity=
        Math.max(0,1-(this.trail[this.trail.length-1].age/.19))*.9;
      this.trailLine.material.color.setHex(input.name==='special'?0x98eaff:0xffd4f5);
      const tip=this.trail[this.trail.length-1].position;
      this.pearl.position.copy(tip);
      this.pearl.visible=slash>.4;
    }else this.pearl.visible=false;
  }
  dispose():void{
    this.trailLine.geometry.dispose();this.trailLine.material.dispose();
    this.scene.remove(this.trailLine);
    this.scene.remove(this.pearl);
    this.scene.remove(this.root);
    this.root.traverse(mesh=>{
      if(mesh instanceof THREE.Mesh){
        mesh.geometry.dispose();
        if(Array.isArray(mesh.material))for(const m of mesh.material)m.dispose();
        else mesh.material.dispose();
      }
    });
    this.pearl.geometry.dispose();
    (this.pearl.material as THREE.Material).dispose();
  }
}

/** A transparent second 3D canvas sits above Phaser's arena and beneath
 * its HTML controls. All combat simulation runs in Phaser; this renderer
 * receives read-only snapshots and cannot alter a single hitbox.
 */
export class ThreeEviLayer{
  readonly canvas:HTMLCanvasElement;
  private readonly renderer:THREE.WebGLRenderer;
  private readonly scene=new THREE.Scene();
  private readonly camera=new THREE.OrthographicCamera(-4.8,4.8,2.7,-2.7,.1,100);
  private readonly evi:EviThreeCharacter;
  private logicalWidth=0;
  private enabled=true;
  constructor(parent:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({
      alpha:true,antialias:true,powerPreference:'default',
    });
    this.canvas=this.renderer.domElement;
    this.canvas.className='three-evi-layer';
    this.canvas.setAttribute('aria-hidden','true');
    this.canvas.style.pointerEvents='none';
    this.canvas.style.position='absolute';
    this.canvas.style.inset='0';
    this.canvas.style.width='100%';
    this.canvas.style.height='100%';
    this.canvas.style.zIndex='2';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    this.renderer.setClearColor(0x000000,0);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.34;
    this.scene.add(new THREE.HemisphereLight(0xeaf7ff,0x785b69,1.85));
    const key=new THREE.DirectionalLight(0xffe4bc,2.65);
    key.position.set(-3,5,7);this.scene.add(key);
    const rim=new THREE.DirectionalLight(0x9ec8ff,1.55);
    rim.position.set(5,3,-4);this.scene.add(rim);
    this.camera.position.set(0,0,20);
    this.camera.lookAt(0,0,0);
    this.evi=new EviThreeCharacter(this.scene);
    parent.appendChild(this.canvas);
    this.resize(960);
    this.setVisible(false);
  }
  resize(width:number):void{
    const w=Math.max(960,Math.round(width));
    if(w===this.logicalWidth)return;
    this.logicalWidth=w;
    const v=threeViewDimensions(w);
    this.camera.left=v.left;this.camera.right=v.right;
    this.camera.top=v.top;this.camera.bottom=v.bottom;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w,540,false);
  }
  setVisible(visible:boolean):void{
    this.enabled=visible;
    this.canvas.style.visibility=visible?'visible':'hidden';
  }
  render(frame:ThreeBattleFrame|null,dt:number):void{
    if(!this.enabled||!frame)return;
    const evi=frame.fighters.find(f=>f.id==='evi');
    if(!evi){this.canvas.style.visibility='hidden';return;}
    this.canvas.style.visibility='visible';
    this.resize(frame.logicalWidth);
    this.evi.update(evi,Math.max(0,Math.min(.05,dt)));
    this.renderer.render(this.scene,this.camera);
  }
  destroy():void{
    this.evi.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
