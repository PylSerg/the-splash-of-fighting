import assert from 'node:assert/strict';
import {
  SPECIAL_CHARGE_MARKS,SPECIAL_MIN_CHARGE,SPECIAL_METER_MAX,
  specialChargeTier,specialDamageAt,fullSpecialDamage,canLaunchSpecial,
  spendSpecialCharge,
} from '../src/combat/SpecialRules.ts';
import { SPLASH_MOVES, specialSplashBonus } from '../src/combat/SplashRules.ts';
import {
  MAX_HEALTH,BALANCE_REFERENCE_HP,scaleDamage,damagePercent,
  earnedMeterFromDamage,
} from '../src/combat/CombatScale.ts';

assert.equal(MAX_HEALTH,500);
assert.equal(BALANCE_REFERENCE_HP,200);
assert.equal(scaleDamage(5),13);
assert.equal(scaleDamage(9),23);
assert.equal(scaleDamage(11),28);
assert.equal(scaleDamage(14),35);
assert.equal(scaleDamage(24),60);
assert.equal(scaleDamage(28),70);
assert.ok(Math.abs(damagePercent(scaleDamage(10))-5)<.001);
assert.equal(earnedMeterFromDamage(0),0);
assert.equal(earnedMeterFromDamage(25),6);
assert.equal(earnedMeterFromDamage(62.5),15,
  'meter economy remains 15% charge per 12.5% max health damage');
assert.equal(specialSplashBonus(0),0);
assert.equal(specialSplashBonus(65),13,
  'special hits give ONLY separate splash energy as 1 point per 1% HP removed');
assert.equal(specialSplashBonus(33),6.6);
assert.deepEqual(SPECIAL_CHARGE_MARKS,[0,15,35,60,100],
  'HUD subdivisions exactly at 15%,35%,60%');
assert.equal(SPECIAL_MIN_CHARGE,15);
assert.equal(SPECIAL_METER_MAX,100);
for(const [charge,tier] of [
  [0,0],[14.99,0],[15,1],[16,1],[34.999,1],
  [35,2],[36,2],[59.999,2],[60,3],[61,3],[99.999,3],
  [100,4],[101,4],
]){
  assert.equal(specialChargeTier(charge),tier,
    charge+' only counts the highest COMPLETELY filled section');
}
assert.equal(specialChargeTier(Number.NaN),0);
assert.equal(canLaunchSpecial(14.9),false);
assert.equal(canLaunchSpecial(15),true);
assert.equal(spendSpecialCharge(14.9),14.9,'failed cast does not spend');
assert.equal(spendSpecialCharge(15),0,'valid low charge spends all');
assert.equal(spendSpecialCharge(16),0,'unfinished second tier charge is also spent');
assert.equal(spendSpecialCharge(67),0,'unfinished fourth tier charge is also spent');
assert.equal(spendSpecialCharge(100),0);
assert.equal(specialDamageAt('evi',14.9),0);
assert.equal(specialDamageAt('evi',15),33);
assert.equal(specialDamageAt('runa',15),40);
assert.equal(specialDamageAt('evi',34.9),33);
assert.equal(specialDamageAt('evi',35),43);
assert.equal(specialDamageAt('evi',59),43);
assert.equal(specialDamageAt('evi',60),53);
assert.equal(specialDamageAt('evi',99),53);
assert.equal(specialDamageAt('evi',100),65);
assert.equal(specialDamageAt('runa',100),75);
assert.equal(specialDamageAt('lyra',100),68);
assert.equal(specialDamageAt('kai',100),60);
assert.equal(specialDamageAt('evi',150),65,'overcharge cannot exceed 100% damage');
for(const fighter of ['evi','runa','lyra','kai']){
  const strongest=scaleDamage(fighter==='runa'?14:11);
  assert.ok(specialDamageAt(fighter,15)>strongest,
    fighter+' lowest special is stronger than their scaled heavy Y');
  let last=0;
  for(let charge=15;charge<=100;charge++){
    const now=specialDamageAt(fighter,charge);
    assert.ok(now>=last,'damage increases only at completed stages: '+fighter);
    if(![35,60,100].includes(charge)){
      assert.equal(now,last || specialDamageAt(fighter,15),
        'unfinished stages cannot increase special damage');
    }
    last=now;
  }
  assert.equal(SPLASH_MOVES[fighter].damage,fullSpecialDamage(fighter)*2,
    fighter+' SPLASH is EXACTLY 2× their 100% special');
}
console.log('✓ 500 HP scaling, completed special sections, all-charge cost, SPLASH-only gain: passed.');
