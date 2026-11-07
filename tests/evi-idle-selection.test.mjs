import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {
  EVI_IDLE_FRAMES,EVI_IDLE_WIDTH,EVI_IDLE_HEIGHT,EVI_IDLE_FRAME_MS,
  parseEviIdleFiles,packEviIdleFrames,bundledEviIdleUrls,
  advanceEviIdleFrame,
} from '../src/ui/EviIdleAnimation.ts';

assert.equal(EVI_IDLE_FRAMES,6);
assert.equal(EVI_IDLE_WIDTH,512);
assert.equal(EVI_IDLE_HEIGHT,768);
assert.ok(EVI_IDLE_FRAME_MS>=120 && EVI_IDLE_FRAME_MS<=250);

// Playback must never jump last → first: 1..6..1 is ten distinct
// intervals in a seamless loop, without a duplicated frame at either end.
let playback={frame:0,direction:1};
const played=[playback.frame];
for(let i=0;i<30;i++){
  playback=advanceEviIdleFrame(playback.frame,playback.direction);
  played.push(playback.frame);
}
assert.deepEqual(played.slice(0,11),[0,1,2,3,4,5,4,3,2,1,0],
  'six PNG frames ping-pong up and down, with no last-to-first jump');
assert.deepEqual(played.slice(10,21),[0,1,2,3,4,5,4,3,2,1,0],
  'repeated ping-pong cycles must be identical');
assert.ok(played.slice(1).every((frame,i)=>Math.abs(frame-played[i])===1),
  'each rendered transition advances by only one adjacent frame');
assert.deepEqual(advanceEviIdleFrame(0,1,1),{frame:0,direction:1},
  'a single-frame fallback must stay stable');
assert.deepEqual(advanceEviIdleFrame(0,1,2),{frame:1,direction:-1},
  'two-frame animation turns around at the last frame');
assert.deepEqual(advanceEviIdleFrame(1,-1,2),{frame:0,direction:1},
  'two-frame animation turns around at the first frame');

// These assets MUST be real committed RGBA PNGs, not Git LFS stubs,
// a former sprite atlas, or temporary chat-only links.
const pathPrefix='/the-splash-of-fighting/';
const urls=Array.from({length:6},(_,i)=>
  pathPrefix+'assets/evi/idle/idle_'+String(i+1).padStart(3,'0')+'.png');
assert.deepEqual(bundledEviIdleUrls(pathPrefix),urls,
  'GitHub Pages must resolve six PNGs under Vite BASE_URL');
assert.deepEqual(bundledEviIdleUrls('/the-splash-of-fighting'),urls);
const expectedHashes=[
  'c2d364d64b57bb0f1f315c1ee7f3c4e2f05f1e9780bed5f086aba031d4c7befe',
  'fe557ec291303704649e8a79e97608d4bac4488cf80a11e25b832f3c621a13e7',
  '946f0b11d07246052fa2629d2f5e0756c211965f4992b48b7004dc0a4c041eee',
  'e75507ec64fb70aaba1ca429c500b68675eb8b8604d4bfb404914b5424865797',
  'a9b6e30c6c61a2d49f26b83385ac1f0eb61a43264bac7ff21e2f6f8c1fc757a0',
  '879a83b4e2a558b5e0ae5e2e1c98675d9e629d7983e9a91c444813cebfa4b19b',
];
for(let i=0;i<EVI_IDLE_FRAMES;i++){
  const name='idle_'+String(i+1).padStart(3,'0')+'.png';
  const png=readFileSync(new URL('../public/assets/evi/idle/'+name,import.meta.url));
  assert.ok(png.length>250_000,name+' is full-resolution sprite data');
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),EVI_IDLE_WIDTH,name+' width');
  assert.equal(png.readUInt32BE(20),EVI_IDLE_HEIGHT,name+' height');
  assert.equal(png[25],6,name+' must have real RGBA transparency');
  assert.equal(createHash('sha256').update(png).digest('hex'),
    expectedHashes[i],name+' exactly matches the source PNG');
}

function testPng(width=512,height=768,rgba=true){
  // Only the 33-byte PNG IHDR matters to the import validator.
  const a=new Uint8Array(33);
  a.set([137,80,78,71,13,10,26,10],0);
  a.set([0,0,0,13,73,72,68,82],8);
  const view=new DataView(a.buffer);
  view.setUint32(16,width);view.setUint32(20,height);
  a[24]=8;a[25]=rgba?6:2;
  return a;
}
const files=Array.from({length:6},(_,i)=>
  new File([testPng()],'idle_'+String(i+1).padStart(3,'0')+'.png',
    {type:'image/png'}));
const frames=await parseEviIdleFiles(files);
assert.equal(frames.length,6);
for(const frame of frames)assert.equal(frame.type,'image/png');
await assert.rejects(
  parseEviIdleFiles(files.slice(0,5)),/рівно 6 PNG/);
await assert.rejects(
  parseEviIdleFiles([...files.slice(0,3),
    new File([testPng(400)],'idle_004.png',{type:'image/png'}),
    ...files.slice(4)]),/512 × 768/);
await assert.rejects(
  parseEviIdleFiles([...files.slice(0,4),
    new File([testPng(512,768,false)],'idle_005.png',{type:'image/png'}),
    files[5]]),/RGBA/);

const packed=await packEviIdleFrames(frames);
const imported=await parseEviIdleFiles([new File([packed],'evi_idle.zip',
  {type:'application/zip'})]);
assert.equal(imported.length,6,'roundtrip ZIP contains six ordered frames');
const zip=await JSZip.loadAsync(await packed.arrayBuffer());
assert.deepEqual(Object.keys(zip.files).sort(),files.map(f=>f.name).sort(),
  'ZIP stores each individually editable frame by its stable filename');

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const selector=read('src/ui/CharacterSelector.ts');
const app=read('src/main.ts');
const html=read('index.html');
const styles=read('src/ui/selection.css');
assert.match(selector,/setInterval\(/,'idle animation must advance frames');
assert.match(selector,/advanceEviIdleFrame\(this\.idleFrame,this\.idleDirection,this\.idleUrls\.length\)/,
  'selector drives PNG frames through the shared tested ping-pong stepper');
assert.doesNotMatch(selector,/this\.idleFrame=\(this\.idleFrame\+1\)%/,
  'old looping last-to-first jump must be removed');
assert.ok((selector.match(/this\.idleDirection=1;/g)||[]).length>=3,
  'showing selector, reimporting and clearing artwork reset to forward frame 1');
assert.match(selector,/this\.stopIdle\(\)/,'close selection must stop idle timer');
assert.match(selector,/URL\.revokeObjectURL/,'old frame URLs are disposed');
assert.match(selector,/has-idle-animation/,'native PNG art replaces SVG fallback');
assert.match(app,/storeEviSheet\('idle-selection',zip\)/);
assert.match(app,/readEviSheet\('idle-selection'\)/);
assert.match(app,/loadBundledEviIdleFrames\(import\.meta\.env\.BASE_URL\)/,
  'new visitors automatically load the six game-bundled PNGs');
assert.match(app,/await installBundledIdle\(version\)/,
  'clearing user imports restores the original bundled artwork');
assert.match(html,/id="input-evi-idle"/,'ZIP upload in character select');
assert.match(html,/multiple/,'individual PNG imports also supported');
assert.match(styles,/image-rendering:pixelated/,'retain crisp pixel art');
console.log('✓ Six committed 512×768 RGBA idle PNGs: original hashes, Vite paths, local overrides and seamless 1→6→1 ping-pong animation.');
