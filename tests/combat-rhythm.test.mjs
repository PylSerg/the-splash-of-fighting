import assert from 'node:assert/strict';
import {
  FIGHTER_STYLES,ATTACK_ACTIVE,WAKEUP_PROTECTION,phaseOfAttack,
  attackRecovery,styledAttack,hitstopSeconds,blockstunSeconds,
} from '../src/combat/CombatRhythm.ts';

assert.equal(Object.keys(FIGHTER_STYLES).length,4);
for(const [name,style] of Object.entries(FIGHTER_STYLES)){
  assert.ok(style.movement>0 && style.attackingMovement>0,
    name+' keeps valid walking and attacking movement');
  assert.ok(style.rollDistance>0 && style.rollCooldown>0,
    name+' keeps a valid roll');
  assert.ok(style.comboWindow>=.75 && style.comboWindow<=1,
    name+' preserves reasonably timed three-hit combos');
  assert.ok(style.recovery>=.06 && style.recovery<.25,
    name+' has a visible punishable recovery');
}
assert.ok(FIGHTER_STYLES.evi.comboWindow>FIGHTER_STYLES.runa.comboWindow,
  'Evi has a more forgiving quick-combo rhythm');
assert.ok(FIGHTER_STYLES.evi.recovery<FIGHTER_STYLES.runa.recovery,
  'Evi returns to neutral sooner than Runa');
assert.ok(FIGHTER_STYLES.kai.movement>FIGHTER_STYLES.evi.movement,
  'Kai is the fastest runner');
assert.ok(FIGHTER_STYLES.kai.rollDistance>FIGHTER_STYLES.runa.rollDistance,
  'Kai can cross behind the rival more readily');
const base={duration:.40,reach:120,damage:9,level:'mid',stun:.2};
const evi=styledAttack('evi','kick',base);
const lyra=styledAttack('lyra','kick',base);
const kai=styledAttack('kai','kick',base);
assert.ok(evi.duration<base.duration && kai.duration<base.duration);
assert.ok(lyra.reach>evi.reach && lyra.reach>kai.reach,
  'Lyra controls the longest melee range');
assert.equal(lyra.damage,base.damage,'style only reshapes attack timing and reach');
assert.notEqual(attackRecovery('runa','heavy'),attackRecovery('evi','heavy'));
assert.equal(attackRecovery('kai','duel'),.12,
  'duel starter preserves the same full follow-through for everyone');

for(const [move,active] of Object.entries(ATTACK_ACTIVE)){
  assert.ok(active>0 && active<=.12,move+' has a real, limited active window');
  const startup=.4,recovery=.12;
  assert.equal(phaseOfAttack(move,0,startup,recovery),'startup');
  assert.equal(phaseOfAttack(move,startup,startup,recovery),'active');
  assert.equal(phaseOfAttack(move,startup+active/2,startup,recovery),'active');
  assert.equal(phaseOfAttack(move,startup+active,startup,recovery),'recovery');
  assert.equal(phaseOfAttack(move,startup+active+recovery,startup,recovery),'finished');
}
assert.ok(ATTACK_ACTIVE.heavy>1/60,'heavy attacks remain active across frames');
assert.ok(hitstopSeconds('heavy')>hitstopSeconds('light'));
assert.ok(hitstopSeconds('special')>hitstopSeconds('heavy'));
assert.ok(hitstopSeconds('heavy',true)<hitstopSeconds('heavy',false),
  'blocked impacts have a shorter freeze than clean heavy hits');
assert.ok(hitstopSeconds('heavy',false,true)>0,'two colliding attacks visibly freeze');
assert.ok(blockstunSeconds('heavy')>blockstunSeconds('light'));
assert.ok(blockstunSeconds('heavy')<.3,'ordinary guardstun remains brief');
assert.ok(WAKEUP_PROTECTION>=.12 && WAKEUP_PROTECTION<=.25,
  'wakeup briefly prevents strike/throw loops without prolonged immunity');
console.log('✓ Combat phases, hitstop, guardstun, wakeup and distinct fighter styles: passed.');
