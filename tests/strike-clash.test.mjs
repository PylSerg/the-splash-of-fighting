import assert from 'node:assert/strict';
import { isSimultaneousClash, strikeTouchesRival } from '../src/combat/StrikeClashRules.ts';

const body={x:170,y:300,w:45,h:142};
const make = (name='light', box={x:150,y:310,w:125,h:55}) => ({
  name,strikeBox:box,rivalBody:body,rivalKnockedOut:false,
  rivalKnockedDown:false,rivalRollInvulnerable:false,rivalAirborne:false,
});
const a=make('light');
const b=make('heavy');
assert.equal(strikeTouchesRival(a),true);
assert.equal(strikeTouchesRival(b),true);
assert.equal(isSimultaneousClash(a,b),true,
  'two attacks land on the same simulation frame -> both count as blocks');
assert.equal(isSimultaneousClash(b,a),true,
  'collision is independent of which player is evaluated first');

assert.equal(isSimultaneousClash(a,null),false,
  'one incoming attack is ordinary damage, not clash');
assert.equal(isSimultaneousClash(null,a),false);
assert.equal(isSimultaneousClash(null,null),false);
assert.equal(isSimultaneousClash(a,{...b,strikeBox:null}),false,
  'an attack without an active impact frame does not clash');
assert.equal(isSimultaneousClash(a,make('heavy',{x:275,y:310,w:80,h:55})),false,
  'one fighter missing the opposing hurtbox cannot block the rival attack');
assert.equal(isSimultaneousClash(a,make('heavy',{x:150,y:210,w:125,h:65})),false,
  'high attack whiff above a crouching hurtbox is not an attack collision');
assert.equal(isSimultaneousClash({...a,rivalRollInvulnerable:true},b),false,
  'rolling away from one strike prevents the mutual clash');
assert.equal(isSimultaneousClash(a,{...b,rivalKnockedDown:true}),false,
  'a grounded knockdown is not a valid target for a new strike');
assert.equal(isSimultaneousClash(a,{...b,rivalKnockedOut:true}),false,
  'a KO is never counted as a mutual attack clash');
assert.equal(isSimultaneousClash(make('sweep'),{...b,rivalAirborne:true}),true,
  'an opponent jumping affects the incoming SWEEP, not the other strike');
assert.equal(isSimultaneousClash({...a,name:'sweep',rivalAirborne:true},b),false,
  'a low sweep that misses an airborne rival does not cause a clash');
assert.equal(isSimultaneousClash(make('duel'),b),false,
  'zero-damage duel challenge remains a separate mechanism');
assert.equal(isSimultaneousClash(a,make('duel')),false,
  'the initial duel Y never becomes a regular simultaneous hit');

// Every attack pair is symmetric, regardless of damage or block stance.
for(const left of ['light','kick','heavy','special','sweep','crouchMid']){
  for(const right of ['light','kick','heavy','special','sweep','crouchMid']){
    assert.equal(isSimultaneousClash(make(left),make(right)),true,
      `both colliding ${left} versus ${right} must be forced blocks`);
  }
}
assert.equal(strikeTouchesRival(make('heavy',{x:170,y:442,w:45,h:0})),false,
  'zero-height strike cannot collide');
console.log('✓ Parallel hit snapshots: symmetric two-hit clash, whiffs, rolls and duel exemption.');
