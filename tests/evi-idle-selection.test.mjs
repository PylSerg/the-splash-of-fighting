import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import JSZip from 'jszip';
import {
  EVI_IDLE_FRAMES,EVI_IDLE_WIDTH,EVI_IDLE_HEIGHT,EVI_IDLE_FRAME_MS,
  parseEviIdleFiles,packEviIdleFrames,
} from '../src/ui/EviIdleAnimation.ts';

assert.equal(EVI_IDLE_FRAMES,6);
assert.equal(EVI_IDLE_WIDTH,512);
assert.equal(EVI_IDLE_HEIGHT,768);
assert.ok(EVI_IDLE_FRAME_MS>=120 && EVI_IDLE_FRAME_MS<=250);

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
assert.match(selector,/this\.stopIdle\(\)/,'close selection must stop idle timer');
assert.match(selector,/URL\.revokeObjectURL/,'old frame URLs are disposed');
assert.match(selector,/has-idle-animation/,'native PNG art replaces SVG fallback');
assert.match(app,/storeEviSheet\('idle-selection',zip\)/);
assert.match(app,/readEviSheet\('idle-selection'\)/);
assert.match(html,/id="input-evi-idle"/,'ZIP upload in character select');
assert.match(html,/multiple/,'individual PNG imports also supported');
assert.match(styles,/image-rendering:pixelated/,'retain crisp pixel art');
console.log('✓ Six 512×768 RGBA idle PNGs: ZIP roundtrip, validation, local persistence, selection animation and clean fallback.');
