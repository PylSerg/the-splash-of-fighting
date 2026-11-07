import assert from 'node:assert/strict';
import {
  EVI_COMBAT_COLUMNS,EVI_COMBAT_ROWS,
  EVI_CINEMATIC_COLUMNS,EVI_CINEMATIC_ROWS,
  EVI_CINEMATIC_SECONDS,
  frameForEvi,atlasRects,EVI_MISSING_ANIMATIONS,
} from '../src/combat/EviSpriteStates.ts';
import { readFileSync } from 'node:fs';

assert.equal(EVI_COMBAT_COLUMNS*EVI_COMBAT_ROWS,21);
assert.equal(EVI_CINEMATIC_COLUMNS*EVI_CINEMATIC_ROWS,10);
assert.equal(EVI_CINEMATIC_SECONDS,2);
const grid=atlasRects(1448,1086,7,3);
assert.equal(grid.length,21);
assert.equal(grid[0].x,0);
assert.equal(grid[6].x+grid[6].width,1448);
assert.equal(grid[20].y+grid[20].height,1086);
assert.ok(grid.every(rect=>rect.width>0&&rect.height>0));
assert.equal(new Set(grid.map(rect=>rect.name)).size,21);
assert.equal(atlasRects(1448,1086,5,2).length,10);
assert.throws(()=>atlasRects(0,1086,7,3));
assert.throws(()=>atlasRects(1448,1086,0,3));

for(const phase of ['intro','victory']){
  const offset=phase==='victory'?5:0;
  for(let i=0;i<5;i++){
    const elapsed=i*.4+.01;
    assert.deepEqual(frameForEvi({cinematic:{kind:phase,elapsed}}),
      {sheet:'cinematic',frame:offset+i},
      phase+' five distinct frames for 2s');
  }
  assert.deepEqual(frameForEvi({cinematic:{kind:phase,elapsed:2.6}}),
    {sheet:'cinematic',frame:offset+4},
    'final pose holds after 2 seconds');
}
for(const [name,frame] of [
  ['light',10],['heavy',9],['kick',11],['crouchMid',12],
  ['sweep',13],['duel',9],
]){
  assert.deepEqual(frameForEvi({attack:{name,elapsed:.2,startup:.4}}),
    {sheet:'combat',frame},name+' uses the correct representative pose');
}
assert.deepEqual(frameForEvi({attack:{name:'special',elapsed:.01,startup:.82}}),
  {sheet:'combat',frame:17});
assert.deepEqual(frameForEvi({attack:{name:'special',elapsed:.7,startup:.82}}),
  {sheet:'combat',frame:18});
assert.deepEqual(frameForEvi({splash:'startup'}),{sheet:'combat',frame:19});
assert.deepEqual(frameForEvi({splash:'attack'}),{sheet:'combat',frame:20});
assert.deepEqual(frameForEvi({splash:'victim'}),{sheet:'combat',frame:15});
assert.deepEqual(frameForEvi({splash:'guard'}),{sheet:'combat',frame:6});
assert.deepEqual(frameForEvi({grab:'reach'}),{sheet:'combat',frame:14});
assert.deepEqual(frameForEvi({grab:'held'}),{sheet:'combat',frame:15});
assert.deepEqual(frameForEvi({knockdown:'prone'}),{sheet:'combat',frame:16});
assert.deepEqual(frameForEvi({blocking:true,crouching:true}),
  {sheet:'combat',frame:6});
assert.deepEqual(frameForEvi({walking:true,movingForward:false}),
  {sheet:'combat',frame:3});
assert.deepEqual(frameForEvi({walking:true,movingForward:true}),
  {sheet:'combat',frame:2});
assert.ok(EVI_MISSING_ANIMATIONS.length>=8,
  'frame gap report explicitly records motions to illustrate later');

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const id of ['input-evi-combat','input-evi-cinematic','btn-evi-reset-art',
  'evi-sprite-status']){
  assert.ok(html.includes('id="'+id+'"'),id+' is available in Graphics menu');
}
console.log('✓ 21 combat sprites, 10 intro/victory frames, 2s timing, animation gaps: passed.');
