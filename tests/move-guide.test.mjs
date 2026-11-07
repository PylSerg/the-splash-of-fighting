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
  assert.ok(commands.moves.some(m=>m.buttons.includes('↑ + X + Y') &&
    m.description.includes('X↔Y')),'guide explains physical hold and swipe');
  assert.ok(commands.moves.some(m=>m.description.includes(SPLASH_MOVES[fighter].name)));
  assert.ok(commands.moves.some(m=>m.buttons.includes('X + A')));
  const bands=guide.sections.find(section=>section.title.includes('Чотири секції'));
  assert.ok(bands,'move guide must describe the four normal special-meter stages');
  assert.deepEqual(bands.moves.map(move=>move.buttons),
    ['0–15%','16–35%','36–60%','61–100%']);
  assert.ok(bands.moves[0].description.includes('15%'),
    'first tier explains the minimum valid charge');
  assert.ok(bands.moves[3].description.includes(String(SPLASH_MOVES[fighter].damage)),
    'the full-charge tier displays double-strength SPLASH damage');
  assert.ok(commands.moves.some(move=>move.buttons.includes('A + B') &&
    move.description.includes('від 15%')),
    'the command text shows the new 15% minimum, not old 40-cost attack');
}
assert.notEqual(getMoveGuide('evi').name,getMoveGuide('runa').name);
assert.notEqual(getMoveGuide('evi').notes,getMoveGuide('runa').notes);
assert.notEqual(
  getMoveGuide('evi').sections[1].moves.find(x=>x.buttons==='↑ + X + Y')?.description,
  getMoveGuide('runa').sections[1].moves.find(x=>x.buttons==='↑ + X + Y')?.description,
  'unique SPLASH move belongs to the selected fighter');
console.log('✓ Full per-character move guides, all six combo routes and corrected heights: passed.');
