import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  groundedEviTumble,legacyFallVisual,
} from '../src/combat/EviGroundedTumble.ts';

assert.deepEqual(groundedEviTumble(0),
  {angle:0,x:0,y:0,contactY:8,progress:0});
assert.deepEqual(groundedEviTumble(1),
  {angle:2*Math.PI,x:0,y:0,contactY:8,progress:1});
assert.deepEqual(groundedEviTumble(-10),groundedEviTumble(0));
assert.deepEqual(groundedEviTumble(1.1),groundedEviTumble(1));
assert.deepEqual(groundedEviTumble(NaN),groundedEviTumble(0));
assert.equal(groundedEviTumble(.5).angle,Math.PI,
  'middle of roll turns the entire character upside-down once');
assert.ok(groundedEviTumble(.25).angle>0);
assert.ok(groundedEviTumble(.25,true).angle<0);
assert.equal(groundedEviTumble(.5,true).angle,-Math.PI);
for(let i=0;i<=240;i++){
  const p=i/240;
  for(const backwards of [false,true]){
    const t=groundedEviTumble(p,backwards);
    assert.equal(t.progress,p);
    assert.ok(Math.abs(t.contactY-8)<1e-8,
      'the rotating model must retain floor contact at every 1.9ms step');
    assert.ok(Math.abs(t.x)<=70,'art pivot cannot wander far from combat hitbox');
    assert.ok(t.y>-175&&t.y<20,'only silhouette contact adjustment, never a flying arc');
    assert.ok(Math.abs(t.angle)<=2*Math.PI+.00001);
    assert.ok(Number.isFinite(t.x)&&Number.isFinite(t.y));
    const opposite=groundedEviTumble(p,!backwards);
    assert.ok(Math.abs(t.angle+opposite.angle)<1e-8,
      'backwards roll reverses rotation');
    assert.ok(Math.abs(t.y-opposite.y)<1e-8,
      'contact height must be symmetrical in both directions');
  }
}
for(const n of [0,.1,.5,.9,1]){
  const legacy=legacyFallVisual(n);
  assert.ok(legacy.rotationRatio>0 && legacy.rotationRatio<.50,
    'legacy fighters must never rotate into a full sideways headstand');
  assert.ok(legacy.scaleY>=.57 && legacy.scaleY<=1);
}
assert.equal(legacyFallVisual(0).scaleY,1);
assert.ok(Math.abs(legacyFallVisual(1).scaleY-.57)<1e-9);

const fighter=readFileSync(new URL('../src/combat/Fighter.ts',import.meta.url),'utf8');
const puppet=readFileSync(new URL('../src/combat/EviPixelPuppet.ts',import.meta.url),'utf8');
assert.match(fighter,/!preserveFacing && !this\.isRolling/,
  'facing must remain locked while the roll crosses behind an opponent');
assert.match(fighter,/this\.face\*fallAngle\*legacy\.rotationRatio/,
  'legacy knockdown uses safe compact fall instead of 90° headstand');
assert.match(fighter,/puppetVisible\?0:visual\.lift/,
  'the puppet uses silhouette correction, not the old vertical lift');
assert.match(puppet,/groundedEviTumble\(input\.progress\?\?0,input\.backwards\)/,
  'Evi uses ground contact calculation with matching roll direction');
assert.match(puppet,/this\.root\.setRotation\(tumble\.angle\)/,
  'only the puppet geometry turns; physics, hitbox and Fighter rig do not');
assert.match(puppet,/this\.root\.setRotation\(0\)/,
  'ordinary moves must restore the zero rotation state');
console.log('✓ Grounded 360° Evi tumble, floor contact, facing lock and safe legacy falls: passed.');
