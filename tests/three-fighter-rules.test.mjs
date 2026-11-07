import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PHASER_VIEW_HEIGHT,PHASER_WORLD_CENTRE_X,THREE_PIXELS_PER_UNIT,
  screenToThree,threeViewDimensions,threeGroundedRoll,THREE_ROLL_PIVOT,
} from '../src/three/ThreeFighterRules.ts';
assert.equal(PHASER_VIEW_HEIGHT,540);
assert.equal(PHASER_WORLD_CENTRE_X,480);
assert.equal(THREE_PIXELS_PER_UNIT,100);
assert.deepEqual(screenToThree(480,270),{x:0,y:0});
assert.deepEqual(screenToThree(250,443),{x:-2.3,y:-1.73});
assert.deepEqual(screenToThree(710,443),{x:2.3,y:-1.73});
assert.deepEqual(threeViewDimensions(960),
  {left:-4.8,right:4.8,top:2.7,bottom:-2.7});
assert.deepEqual(threeViewDimensions(1440),
  {left:-7.2,right:7.2,top:2.7,bottom:-2.7});
const initial=threeGroundedRoll(0);
const final=threeGroundedRoll(1);
assert.ok(Math.abs(initial.angle)<1e-12 && Math.abs(initial.lift)<1e-10);
assert.ok(Math.abs(final.angle-Math.PI*2)<1e-10);
assert.ok(Math.abs(final.lift)<1e-10);
assert.ok(THREE_ROLL_PIVOT>.5 && THREE_ROLL_PIVOT<1.2);
for(let i=0;i<=120;i++){
  const p=i/120;
  for(const backward of [false,true]){
    const data=threeGroundedRoll(p,backward);
    assert.ok(Number.isFinite(data.angle)&&Number.isFinite(data.lift),
      '3D roll cannot create invalid graphics offsets');
    assert.ok(Math.abs(data.angle)<=Math.PI*2+1e-9,
      'turn remains one revolution within the dodge window');
    assert.ok(data.lift>-1.5&&data.lift<2,
      'model only offsets about its silhouette, not a flying pivot');
    const reverse=threeGroundedRoll(p,!backward);
    assert.ok(Math.abs(reverse.angle+data.angle)<1e-8,
      'backwards roll must reverse angular direction');
  }
}
assert.deepEqual(threeGroundedRoll(-9),initial);
assert.deepEqual(threeGroundedRoll(NaN),initial);
assert.deepEqual(threeGroundedRoll(5),final);

const layer=readFileSync(new URL('../src/three/ThreeEviLayer.ts',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const fighter=readFileSync(new URL('../src/combat/Fighter.ts',import.meta.url),'utf8');
const arena=readFileSync(new URL('../src/scenes/ArenaScene.ts',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(layer,/new THREE\.WebGLRenderer\(/,
  'new implementation must use real hardware-accelerated Three.js 3D');
assert.match(layer,/new THREE\.OrthographicCamera\(/,
  '2.5D fixed side camera preserves Phaser x positions');
assert.match(layer,/new THREE\.SphereGeometry\(/,
  'actual shaded volumetric surfaces, not sprite impostors');
assert.match(layer,/new THREE\.ExtrudeGeometry\(/,
  'fighting fan must have real 3D depth');
assert.match(layer,/new THREE\.HemisphereLight\(/);
assert.match(layer,/new THREE\.DirectionalLight\(/);
assert.match(layer,/this\.fan\.position\.set\(/);
assert.match(layer,/this\.rightElbow\.add\(this\.fan\)/,
  'fan follows skeletal right wrist');
assert.match(layer,/this\.root\.scale\.set\(frame\.face,1,1\)/,
  '3D fighter faces the original gameplay direction');
assert.match(layer,/eviPoseFor\(input\)/,
  'reuse existing authoritative movement states');
assert.match(layer,/eviSlashGlow\(input\)/,
  'light trail is synced to the real strike startup');
assert.match(layer,/this\.renderer\.render\(this\.scene,this\.camera\)/,
  '3D renders in its own WebGL canvas');
assert.match(main,/new ThreeEviLayer\(frame\)/);
assert.match(main,/arena\.getThreeBattleFrame\(\)/);
assert.match(main,/screen==='battle'&&!frameData\.frozen\?dt:0/,
  'rendered animation must freeze during real hitstop');
assert.match(main,/threeLayer\?\.resize\(width\)/,
  'wide and narrow viewports are synchronized with Phaser');
assert.match(arena,/getThreeBattleFrame\(\)/);
assert.match(fighter,/getThreeSnapshot\(\)/);
assert.match(html,/data-evi-mode="three"/);
assert.match(html,/data-evi-mode="puppet"/);
assert.match(html,/data-evi-mode="sheet"/);
assert.match(html,/data-evi-mode="legacy"/);
console.log('✓ Three.js fighter: real 3D mesh, overlay, battle sync, grounded roll and graceful graphics modes.');
