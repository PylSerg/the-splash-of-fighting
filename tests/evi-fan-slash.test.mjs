import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eviPoseFor,neutralEviPose} from '../src/combat/EviRigMotion.ts';
import {
  isEviFanSlash,sideSlashBlend,eviFanWorldDirection,
  eviFanLocalRotation,eviFanTip,eviSlashGlow,EVI_FAN_TRAIL_LIFETIME,
} from '../src/combat/EviFanSlash.ts';

assert.equal(EVI_FAN_TRAIL_LIFETIME,.17,
  'slash afterimages fade in under one fifth of a second');
for(const name of ['heavy','duel','special','light','crouchMid'])
  assert.equal(isEviFanSlash(name),true,name+' uses the bladed fan');
for(const name of ['idle','guard','guardLow','kick','sweep','roll',
  'jump','splashStart','splashAttack','victory'])
  assert.equal(isEviFanSlash(name),false,name+' must not draw a hand-held slash');
assert.equal(eviSlashGlow({name:'kick',elapsed:.42,startup:.4}),0);
assert.equal(eviSlashGlow({name:'heavy',elapsed:0,startup:.4}),0);
assert.equal(eviSlashGlow({name:'heavy',elapsed:.10,startup:.4}),0);
assert.ok(eviSlashGlow({name:'heavy',elapsed:.35,startup:.4})>.3);
assert.equal(eviSlashGlow({name:'heavy',elapsed:.4,startup:.4}),1,
  'fan trail peaks at the actual attack contact, not during early windup');
assert.equal(eviSlashGlow({name:'heavy',elapsed:.55,startup:.4}),0,
  'trail stops long before fighter recovers from the attack');
const phases=sideSlashBlend(.4,.4,.8);
assert.equal(phases.windup,1);
assert.equal(phases.release,1);
assert.equal(phases.recovery,0);
assert.equal(sideSlashBlend(0,.4,.8).release,0);
assert.equal(sideSlashBlend(.9,.4,.8).recovery,1);

const base=neutralEviPose();
for(const name of ['heavy','duel','special','light','crouchMid']){
  const make=(elapsed)=>eviPoseFor({
    name,time:elapsed,elapsed,startup:.4,duration:.8,
  });
  const back=make(.28),strike=make(.4),finish=make(.8);
  assert.ok(back.armR>strike.armR+.7,
    name+' must first draw the weapon arm BACK then cut forward');
  assert.ok(strike.armR<base.armR-.60,
    name+' must reach forward with elbow below shoulder, not chop overhead');
  const start=eviFanTip(back),end=eviFanTip(strike);
  const dx=end.x-start.x,dy=end.y-start.y;
  assert.ok(dx>38,
    name+' fan must sweep toward opponent, not into own body: dx='+dx.toFixed(1));
  assert.ok(Math.abs(dy)<Math.abs(dx)*.55,
    name+' attack must be nearly horizontal: dx='+dx.toFixed(1)+
    ', dy='+dy.toFixed(1));
  for(const pose of [base,back,strike,finish]){
    const aim=eviFanWorldDirection(pose);
    assert.ok(aim.x>.97,
      name+' fan blade must point to the opponent even during windup');
    assert.ok(Math.abs(aim.y)<.23);
    assert.ok(Number.isFinite(eviFanLocalRotation(pose)));
    const blade=eviFanTip(pose);
    assert.ok(Number.isFinite(blade.x)&&Number.isFinite(blade.y));
  }
  assert.ok(Math.abs(finish.armR-base.armR)<.001,
    name+' ends at original ready pose after complete recovery');
}
const runa=readFileSync(new URL('../src/combat/Fighter.ts',import.meta.url),'utf8');
assert.match(runa,/getActiveStrike\(\): ActiveAttack \| null/,
  'do not modify collision/hitbox code');
const puppet=readFileSync(new URL('../src/combat/EviPixelPuppet.ts',import.meta.url),'utf8');
assert.match(puppet,/this\.fan\.setRotation\(eviFanLocalRotation\(p\)\)/,
  'blades follow rival-facing pose, not the old inward angles');
assert.match(puppet,/this\.root\.add\(this\.slashFx\)/,
  'trail shares fighter mirroring and camera position');
assert.match(puppet,/eviFanTip\(this\.pose\)/,
  'trail follows animated fan TIP, not detached fixed screen coordinates');
assert.match(puppet,/this\.slashTrail=this\.slashTrail\.filter/,
  'old trail segments expire and never persist during idle');
assert.doesNotMatch(puppet,/this\.scene\.add\.graphics\(\).*updateSlashTrail/,
  'avoid allocating independent graphics particles every frame');
console.log('✓ Fan side-slash: real startup/contact, forward blade, horizontal travel and fading trail: passed.');
