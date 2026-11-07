import assert from 'node:assert/strict';
import {
  SPECIAL_CHARGE_MARKS,SPECIAL_MIN_CHARGE,SPECIAL_METER_MAX,
  specialChargeTier,specialDamageAt,fullSpecialDamage,canLaunchSpecial,
  spendSpecialCharge,
} from '../src/combat/SpecialRules.ts';
import { SPLASH_MOVES } from '../src/combat/SplashRules.ts';
import { ATTACKS } from '../src/combat/Fighter.ts';

assert.deepEqual(SPECIAL_CHARGE_MARKS,[0,15,35,60,100],
  'HUD subdivisions exactly at 15%,35%,60%');
assert.equal(SPECIAL_MIN_CHARGE,15);
assert.equal(SPECIAL_METER_MAX,100);
for(const [charge,tier] of [
  [0,0],[1,0],[14.99,0],[15,1],[16,2],[35,2],
  [36,3],[60,3],[61,4],[100,4],
]){
  assert.equal(specialChargeTier(charge),tier,charge+' falls into correct band');
}
assert.equal(specialChargeTier(Number.NaN),0);
assert.equal(canLaunchSpecial(14.9),false);
assert.equal(canLaunchSpecial(15),true);
assert.equal(spendSpecialCharge(14.9),14.9,'failed cast does not spend');
assert.equal(spendSpecialCharge(15),0,'valid low charge spends all');
assert.equal(spendSpecialCharge(67),0,'high charge also spends all');
assert.equal(spendSpecialCharge(100),0);
assert.equal(specialDamageAt('evi',14.9),0);
assert.equal(specialDamageAt('evi',15),13);
assert.equal(specialDamageAt('runa',15),16);
assert.equal(specialDamageAt('evi',100),26);
assert.equal(specialDamageAt('runa',100),30);
assert.equal(specialDamageAt('lyra',100),27);
assert.equal(specialDamageAt('kai',100),24);
assert.equal(specialDamageAt('evi',150),26,'overcharge cannot exceed 100% damage');
for(const fighter of ['evi','runa','lyra','kai']){
  const strongest= fighter==='runa'?14:11;
  assert.ok(specialDamageAt(fighter,15)>strongest,
    fighter+' lowest special is stronger than their heavy Y');
  let last=0;
  for(let charge=15;charge<=100;charge++){
    const now=specialDamageAt(fighter,charge);
    assert.ok(now>=last,'damage increases monotonically: '+fighter+' '+charge);
    last=now;
  }
  assert.equal(SPLASH_MOVES[fighter].damage,fullSpecialDamage(fighter)*2,
    fighter+' SPLASH is EXACTLY 2x their 100% special');
  assert.equal(ATTACKS.special.level,'mid',
    'normal special retains mid hit level for guard-break system');
}
console.log('✓ Four charge bands, activation at 15%, progressive specials and 2× SPLASH: passed.');
