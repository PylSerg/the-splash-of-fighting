import assert from 'node:assert/strict';
import { getMoveGuide } from '../src/ui/MoveGuide.ts';
import { COMBO_ROUTES } from '../src/combat/ComboRules.ts';
import { SPLASH_MOVES } from '../src/combat/SplashRules.ts';
import { FIGHTER_STYLES } from '../src/combat/CombatRhythm.ts';

const labels={light:'X',heavy:'Y',kick:'B'};
for(const fighter of ['evi','runa','lyra','kai']){
  const guide=getMoveGuide(fighter);
  assert.ok(guide.name && guide.subtitle && guide.notes);
  assert.ok(guide.notes.includes(String(FIGHTER_STYLES[fighter].comboWindow).replace('.',',')));
  const basic=guide.sections.find(section=>section.title.includes('Основні'));
  const commands=guide.sections.find(section=>section.title.includes('Спеціальні'));
  const combos=guide.sections.find(section=>section.title.includes('Шість'));
  assert.ok(basic && commands && combos);
  assert.ok(basic.moves.some(move=>move.buttons==='Y' && move.description.includes('Висока')));
  assert.ok(basic.moves.some(move=>move.buttons==='X' && move.description.includes('Середня')));
  assert.ok(basic.moves.some(move=>move.buttons==='B' && move.description.includes('Нижня')));
  assert.equal(combos.moves.length,6,'the selected fighter sees all six routes');
  assert.deepEqual(combos.moves.map(m=>m.buttons),
    COMBO_ROUTES.map(route=>route.map(x=>labels[x]).join(' → ')));
  assert.ok(commands.moves.some(m=>m.buttons.includes('A + B')));
  assert.ok(commands.moves.some(m=>m.buttons.includes('B + Y')));
  assert.ok(commands.moves.some(m=>m.buttons.includes('SPLASH') &&
    m.description.includes('сенсорна')));
  assert.ok(commands.moves.some(m=>m.description.includes(SPLASH_MOVES[fighter].name)));
  assert.ok(commands.moves.some(m=>m.buttons.includes('X + A')));
}
assert.notEqual(getMoveGuide('evi').name,getMoveGuide('runa').name);
assert.notEqual(getMoveGuide('evi').notes,getMoveGuide('runa').notes);
assert.notEqual(
  getMoveGuide('evi').sections[1].moves.find(x=>x.buttons==='↑ + X + Y')?.description,
  getMoveGuide('runa').sections[1].moves.find(x=>x.buttons==='↑ + X + Y')?.description,
  'unique SPLASH move belongs to the selected fighter');
console.log('✓ Full per-character move guides, all six combo routes and corrected heights: passed.');
