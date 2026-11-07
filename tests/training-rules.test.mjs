import assert from 'node:assert/strict';
import {
  TRAINING_BEHAVIORS,shouldRestoreTrainingHealth,trainingAttacks,
  trainingGuards,trainingCrouchGuard,trainingDuelPick,
} from '../src/combat/TrainingRules.ts';

const ids=TRAINING_BEHAVIORS.map(item=>item.id);
assert.deepEqual(ids,['passive','guard','attack','both'],
  'practice menu exposes exactly four behaviors in the requested order');
assert.equal(new Set(ids).size,4);
for(const behavior of TRAINING_BEHAVIORS){
  assert.ok(behavior.label && behavior.description);
}
assert.equal(shouldRestoreTrainingHealth(true,0),true);
assert.equal(shouldRestoreTrainingHealth(true,-10),true);
assert.equal(shouldRestoreTrainingHealth(true,1),false,
  'fighters retain damage until the last HP is lost');
assert.equal(shouldRestoreTrainingHealth(false,0),false,
  'regular arcade fighters still get knocked out normally');
assert.equal(shouldRestoreTrainingHealth(false,-10),false);

assert.equal(trainingAttacks('passive'),false);
assert.equal(trainingGuards('passive'),false);
assert.equal(trainingAttacks('guard'),false);
assert.equal(trainingGuards('guard'),true);
assert.equal(trainingAttacks('attack'),true);
assert.equal(trainingGuards('attack'),false);
assert.equal(trainingAttacks('both'),true);
assert.equal(trainingGuards('both'),true);
assert.equal(trainingCrouchGuard('low'),true);
assert.equal(trainingCrouchGuard('mid'),false);
assert.equal(trainingCrouchGuard('high'),false);
assert.equal(trainingCrouchGuard(null),false);

for(const defender of [true,false]){
  assert.equal(trainingDuelPick('passive',defender,0),null,
    'passive dummy never secretly participates in a duel');
}
assert.equal(trainingDuelPick('guard',true,0),'block');
assert.equal(trainingDuelPick('guard',false,0),null);
for(const i of [0,1,2,3,4,5,6,7]){
  assert.notEqual(trainingDuelPick('attack',true,i),'block',
    'attack-only dummy never picks guard');
}
assert.equal(trainingDuelPick('both',true,3),'block',
  'full CPU can choose a defensive duel block');
assert.equal(trainingDuelPick('both',false,3),'light',
  'duel attacker is never allowed to choose defensive block');
console.log('✓ Endless training HP, four CPU behaviors and duel policies: passed.');
