import assert from 'node:assert/strict';
import { stopsHit, strikeBand, fighterHurtboxBand, FIGHTER_HURTBOX, isBackStrike, strikeDamage, canAutoTurn, BACK_STRIKE_MULTIPLIER, STANDING_ATTACK_LANES } from '../src/combat/HitRules.ts';

const expected = {
  standing: { high: true, mid: true, low: false },
  crouching: { high: false, mid: true, low: true },
  none: { high: false, mid: false, low: false },
};
for (const [stance, levels] of Object.entries(expected)) {
  for (const [level, blocked] of Object.entries(levels)) {
    assert.equal(stopsHit(stance, level), blocked,
      `${stance} guard vs ${level}: expected ${blocked}`);
  }
}
// Each playable fighter has an independently calibrated torso/head box.
// Cosmetic hair, flowing fabric, fans and extended feet need not be hittable.
const profiles={
  evi:{standing:{halfWidth:33,top:-210,bottom:-2},
       low:{halfWidth:28,top:-81,bottom:-1}},
  runa:{standing:{halfWidth:29,top:-184,bottom:-2},
        low:{halfWidth:27,top:-79,bottom:-1}},
  lyra:{standing:{halfWidth:28,top:-190,bottom:-2},
        low:{halfWidth:26,top:-78,bottom:-1}},
  kai:{standing:{halfWidth:26,top:-179,bottom:-2},
       low:{halfWidth:24,top:-76,bottom:-1}},
};
assert.deepEqual(FIGHTER_HURTBOX,profiles);
assert.equal(Object.keys(profiles).length,4);
assert.equal(new Set(Object.values(profiles).map(p=>
  p.standing.top+':'+p.standing.halfWidth)).size,4,
  'no shared one-size-fits-all standing hurtbox');
for(const [fighter,poses] of Object.entries(profiles)){
  for(const [pose,low] of [['standing',false],['low',true]]){
    const expected=poses[pose];
    assert.deepEqual(fighterHurtboxBand(fighter,low),{
      halfWidth:expected.halfWidth,
      top:expected.top,
      height:expected.bottom-expected.top,
    },fighter+' '+pose+' uses its own geometry');
  }
  const standing=fighterHurtboxBand(fighter,false);
  const crouching=fighterHurtboxBand(fighter,true);
  const overlaps=(level,hurt)=>{
    const band=strikeBand(level);
    return band.top<hurt.top+hurt.height &&
      band.top+band.height>hurt.top;
  };
  assert.ok(standing.top< -170 && standing.top>=-210,
    fighter+' box includes the actual head, but does not float above it');
  assert.ok(standing.halfWidth>crouching.halfWidth,
    fighter+' becomes narrower while crouching');
  assert.ok(standing.height>crouching.height*2,
    fighter+' visibly shrinks the vulnerable area when low');
  assert.equal(overlaps('high',standing),true,
    fighter+' head can be hit by a high Y strike');
  assert.equal(overlaps('high',crouching),false,
    fighter+' ducks cleanly below a high Y strike');
  assert.ok(strikeBand('high').top+strikeBand('high').height<crouching.top,
    fighter+' has clearance between high Y and its low hurtbox');
  for(const level of ['mid','low']){
    assert.equal(overlaps(level,standing),true,
      fighter+' standing body can be struck at '+level);
    assert.equal(overlaps(level,crouching),true,
      fighter+' crouched body can be struck at '+level);
  }
}
assert.equal(FIGHTER_HURTBOX.evi.standing.top,-210,
  'Evi upright top follows the actual visible hairline, not the old -222');
assert.deepEqual(strikeBand('high'),{top:-232,height:140},
  'existing high strike height/duck timing is unchanged');
assert.deepEqual(strikeBand('mid'),{top:-127,height:100});
assert.deepEqual(strikeBand('low'),{top:-67,height:65});
for (const level of ['high','mid','low']) {
  assert.ok(strikeBand(level).height > 0,
    `${level} hitbox must have positive height`);
}
const guardInputs={block:true,left:false,right:false,up:false};
assert.equal(canAutoTurn(1,guardInputs,false,0,false),false,
  'standing guard may not auto-turn to a rolling attacker behind');
assert.equal(canAutoTurn(-1,{...guardInputs,up:false},false,0,false),false);
assert.equal(canAutoTurn(1,{...guardInputs,right:false,left:true},false,0,false),false,
  'retreating guard also keeps its direction');
assert.equal(canAutoTurn(1,{...guardInputs,block:false},false,0,false),true,
  'releasing the guard permits an immediate turn');
assert.equal(canAutoTurn(1,{...guardInputs,right:true},false,0,false),true,
  'a forward-moving input is not an active defensive stance');
assert.deepEqual(STANDING_ATTACK_LANES,{heavy:'high',light:'mid',kick:'low'},
  'Y high, X mid, B low for all fighters');
assert.equal(stopsHit('standing',STANDING_ATTACK_LANES.kick),false,
  'standing block cannot guard B');
assert.equal(stopsHit('crouching',STANDING_ATTACK_LANES.kick),true,
  'crouching block guards B');
assert.equal(stopsHit('crouching',STANDING_ATTACK_LANES.light),true,
  'crouching block guards X');
assert.equal(stopsHit('crouching',STANDING_ATTACK_LANES.heavy),false,
  'high Y clears crouching targets');
assert.equal(BACK_STRIKE_MULTIPLIER,1.5);
assert.equal(isBackStrike(90,100,1),true,'left side of a right-facing guard is exposed');
assert.equal(isBackStrike(110,100,1),false,'right side is the guarded front');
assert.equal(isBackStrike(110,100,-1),true,'right side of a left-facing guard is exposed');
assert.equal(isBackStrike(90,100,-1),false,'left side is the guarded front');
assert.equal(strikeDamage(11,false,false),11);
assert.equal(strikeDamage(11,true,false),17,'11 damage becomes 17 behind');
assert.equal(strikeDamage(20,false,true),10,'blocked special deals half damage');
assert.equal(strikeDamage(23,false,true),12,'odd special damage rounds up');
assert.equal(strikeDamage(20,true,false),30,'special behind deals full boosted damage');
console.log('✓ Guard directions, 1.5x back-hit bonus and half-damage guard break: passed.');
console.log('✓ Hit-level guard matrix and hitbox geometry: all assertions passed.');
