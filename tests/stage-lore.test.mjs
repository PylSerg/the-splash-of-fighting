import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STAGES,getStage } from '../src/stages/Stages.ts';

assert.equal(STAGES.length,2,'both launch arenas must have a story');
assert.deepEqual(new Set(STAGES.map(s=>s.id)).size,STAGES.length,
  'arena identifiers must stay unique');
for(const stage of STAGES){
  assert.equal(getStage(stage.id),stage,'story lookup matches the selected stage');
  assert.ok(stage.name.length>=5);
  assert.ok(stage.description.length>=30);
  assert.ok(stage.story.length>=300,
    'arena '+stage.id+' must have a meaningful multi-sentence origin story');
  assert.ok(stage.atmosphere.length>=20,'atmosphere is shown in lore facts');
  assert.ok(stage.landmark.length>=20,'arena landmark is shown in lore facts');
  assert.ok(stage.theme.length>0,'lore preview reuses the arena illustration');
}
assert.notEqual(getStage('city').story,getStage('lagoon').story);
assert.throws(()=>getStage('missing'),'invalid stage must not show the wrong story');

// The HTML wiring is part of the selectable arena surface: the central
// card and a clearly labeled control both access the same modal.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const id of [
  'btn-stage-lore','stage-lore-dialog','stage-lore-close','stage-lore-return',
  'stage-lore-art','stage-lore-name','stage-lore-title','stage-lore-story',
  'stage-lore-atmosphere','stage-lore-landmark',
]){
  assert.ok(html.includes('id="'+id+'"'),'missing stage-lore UI element: '+id);
}
assert.match(html,/id="stage-lore-dialog"[^>]*role="dialog"/,
  'stage lore must be an accessible dialog');
assert.ok(html.includes('aria-labelledby="stage-lore-name"'));
assert.ok(html.includes('aria-describedby="stage-lore-story"'));
console.log('✓ Arena lore: original stories, visual facts, modal and controls: passed.');
