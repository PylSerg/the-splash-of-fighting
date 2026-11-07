import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  EVI_COMBAT_IDLE_COUNT,EVI_COMBAT_IDLE_FRAME_MS,
  EVI_COMBAT_IDLE_SOURCE_WIDTH,EVI_COMBAT_IDLE_SOURCE_HEIGHT,
  EVI_COMBAT_IDLE_FOOT_ORIGIN_Y,
  EVI_COMBAT_IDLE_DISPLAY_HEIGHT,EVI_COMBAT_IDLE_DISPLAY_WIDTH,
  eviCombatIdleKey,eviCombatIdleAssetUrl,eviCombatIdleFrame,
} from '../src/combat/EviCombatIdle.ts';

assert.equal(EVI_COMBAT_IDLE_COUNT,6);
assert.equal(EVI_COMBAT_IDLE_SOURCE_WIDTH,512);
assert.equal(EVI_COMBAT_IDLE_SOURCE_HEIGHT,768);
assert.equal(EVI_COMBAT_IDLE_FRAME_MS,185);
assert.equal(EVI_COMBAT_IDLE_FOOT_ORIGIN_Y,741/768);
assert.ok(EVI_COMBAT_IDLE_DISPLAY_HEIGHT>295);
assert.equal(EVI_COMBAT_IDLE_DISPLAY_WIDTH,
  EVI_COMBAT_IDLE_DISPLAY_HEIGHT*(512/768));

const expectedHashes=[
  '1d1849e9a4180ffec349c8ba7d495c7fe55a548e5d145683ca9f5938a5ca9d8a',
  'd6fe5b01603a422069b5e2509f052c6e9e90d0aac9e53f27f641051f97f850ac',
  '3ad0e40f4872854a999831372cd7695de58467afea6edccc75b3f9f4530cb96b',
  'dec42bf0999c8c0c6898fdf7fee343b8023567f716c538ab95d60d1f7c3b95a7',
  '534de16c1e3402138d52346d90d57da4e504846ef67471f8e5e5a9f67aa8f1cf',
  'd54bdac17c289bf39f769ce4ae7998ec8c338e96f0ca45eb8b8fabd0b282c7bc',
];
const urls=[];
for(let i=0;i<EVI_COMBAT_IDLE_COUNT;i++){
  const num=String(i+1).padStart(3,'0');
  const url='/the-splash-of-fighting/assets/evi/combat-idle/fight_idle_'+num+'.png';
  assert.equal(eviCombatIdleAssetUrl(i,'/the-splash-of-fighting/'),url);
  assert.equal(eviCombatIdleAssetUrl(i,'/the-splash-of-fighting'),url);
  urls.push(url);
  assert.equal(eviCombatIdleKey(i),'evi-battle-idle-'+i);
  const png=readFileSync(new URL('../public/assets/evi/combat-idle/fight_idle_'+num+'.png',import.meta.url));
  assert.ok(png.byteLength>180_000,num+' must contain full sprite detail');
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),512,num+' width');
  assert.equal(png.readUInt32BE(20),768,num+' height');
  assert.equal(png[25],6,num+' must preserve PNG RGBA alpha');
  assert.equal(createHash('sha256').update(png).digest('hex'),
    expectedHashes[i],num+' must not be recompressed or replaced');
}
assert.equal(new Set(urls).size,6,'each frame gets its own URL');
assert.throws(()=>eviCombatIdleKey(-1),/Invalid/);
assert.throws(()=>eviCombatIdleKey(6),/Invalid/);

const period=EVI_COMBAT_IDLE_FRAME_MS/1000;
const frames=Array.from({length:31},(_,i)=>eviCombatIdleFrame((i+.25)*period));
assert.deepEqual(frames.slice(0,11),[0,1,2,3,4,5,4,3,2,1,0],
  'combat animation ping-pongs from 1 to 6 to 1');
assert.deepEqual(frames.slice(10,21),frames.slice(0,11),
  'combat idle loops without duplicating either endpoint');
assert.ok(frames.slice(1).every((f,i)=>Math.abs(f-frames[i])===1),
  'each consecutive frame is adjacent; never jump last-to-first');
assert.equal(eviCombatIdleFrame(-1),0);
assert.equal(eviCombatIdleFrame(Number.NaN),0);
assert.equal(eviCombatIdleFrame(.99,1),0);

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const arena=read('src/scenes/ArenaScene.ts');
const fighter=read('src/combat/Fighter.ts');
const selector=read('src/ui/CharacterSelector.ts');
assert.match(arena,/preload\(\):void\{/,
  'Phaser must preload all assets before the Fighter constructor');
assert.match(arena,/this\.load\.image\(eviCombatIdleKey\(i\)/,
  'six unique standalone textures must load through Phaser');
assert.match(fighter,/this\.rig\.add\(this\.combatIdleSprite\)/,
  'battle sprite is parented to the physics-anchored fighter rig');
assert.match(fighter,/this\.eviVisualMode==='puppet' && motion\.name==='idle'/,
  'new sprite replaces ONLY Evi standing idle, never attacks/guard/roll');
assert.match(fighter,/this\.pixelPuppet\?\.setVisible\(puppetMode&&!showIdle\)/,
  'old puppet must hide during sprite Idle, return for other moves');
assert.match(fighter,/this\.combatIdleElapsed=showIdle/,
  'idle sequence restarts from its first frame after other moves');
assert.match(fighter,/\.setOrigin\(\.5,EVI_COMBAT_IDLE_FOOT_ORIGIN_Y\)/,
  'feet share one stable floor origin');
assert.match(fighter,/this\.rig\.setScale\(this\.face,/,
  'frame is mirrored to face the real opponent without duplicating PNGs');
assert.match(selector,/advanceEviIdleFrame\(/,
  'character selection animation remains unchanged');
console.log('✓ Six true RGBA combat PNGs, floor alignment, mirrored neutral-only animation, seamless ping-pong, unchanged 2D fight states.');
