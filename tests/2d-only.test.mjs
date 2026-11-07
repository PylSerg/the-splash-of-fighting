import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=(relative)=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const main=read('src/main.ts');
const arena=read('src/scenes/ArenaScene.ts');
const fighter=read('src/combat/Fighter.ts');
const html=read('index.html');
const css=read('src/styles.css');

assert.equal(existsSync(new URL('../src/three/',import.meta.url)),false,
  'there must be NO Three.js source folder');
assert.equal(pkg.dependencies?.three,undefined,
  'Three.js runtime dependency must be removed');
assert.equal(pkg.devDependencies?.['@types/three'],undefined,
  'Three.js type dependency must be removed');
assert.doesNotMatch(pkg.scripts['test:combat'],/three|evi-3d/i,
  'deleted 3D-only test files cannot stay in the build command');
assert.doesNotMatch(main,/ThreeEviLayer|threeLayer|animateThree|getThreeBattleFrame/i,
  'app must not create or animate a second WebGL context');
assert.doesNotMatch(arena,/getThreeBattleFrame|['"]three['"]/,
  'combat scene must have no 3D snapshot or render mode');
assert.doesNotMatch(fighter,/getThreeSnapshot|useThree|['"]three['"]/,
  'fighters must only use the preserved 2D drawing pipelines');
assert.doesNotMatch(html,/Three\.js|3D|data-evi-mode="three"/i,
  'graphics UI must not advertise removed 3D rendering');
assert.doesNotMatch(css,/\.three-evi-layer/,
  'second canvas CSS must be removed');

for(const mode of ['puppet','sheet','legacy']){
  assert.ok(html.includes('data-evi-mode="'+mode+'"'),
    mode+' remains selectable in graphics options');
}
assert.match(main,/let activeEviMode:EviDisplayMode='puppet'/,
  'default Evi is the existing 2D pixel puppet until sprite sheets arrive');
assert.match(main,/applyEviSheet\(kind,file,true\)/,
  'local PNG/WebP sprite-sheet import stays supported');
assert.match(main,/readEviSheet\(kind\)/,
  'imported sprite sheets remain stored in IndexedDB');

console.log('✓ Phaser-only release: no Three.js renderer, source, dependencies or UI; 2D sprite modes preserved.');
