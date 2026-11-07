import assert from 'node:assert/strict';
import {SPLASH_METER_MAX,SPLASH_WINDUP,SPLASH_MOVES,
  earnSplashEnergy,comboSplashBonus,splashChord,canSplashGuard,
  SPLASH_DUEL_WIN_GAIN,guidedSplashPosition,splashWindupActive,splashFacing} from '../src/combat/SplashRules.ts';
assert.equal(SPLASH_WINDUP,0.5);
assert.equal(splashFacing(300,400,-1),1,'turn right toward an opponent during splash');
assert.equal(splashFacing(400,300,1),-1,'turn left toward an opponent during splash');
assert.equal(splashFacing(300,300,-1),-1,'overlapping fighters retain previous facing');
assert.equal(splashFacing(300,300,1),1,'overlapping fighters retain prior right facing');
assert.equal(splashWindupActive(0),true);
assert.equal(splashWindupActive(.49),true,'counter can interrupt until last windup frame');
assert.equal(splashWindupActive(.5),false,'no interruption after the first half-second');
assert.equal(splashWindupActive(.8),false);
for(const targetX of [70,180,500,970,1600]){
  assert.deepEqual(guidedSplashPosition({x:90,y:280},{x:targetX,y:355},1),
    {x:targetX,y:355},'guided splash arrives at any target distance');
}
assert.deepEqual(guidedSplashPosition({x:90,y:280},{x:600,y:355},0),
  {x:90,y:280},'splash ability starts at its caster');
assert.equal(Object.keys(SPLASH_MOVES).length,4);
assert.equal(new Set(Object.values(SPLASH_MOVES).map(x=>x.name)).size,4);
for(const move of Object.values(SPLASH_MOVES)){
  assert.ok(move.duration>SPLASH_WINDUP);
  assert.ok(move.pulses>3 && move.damage>30);
}
assert.equal(earnSplashEnergy(90,30),SPLASH_METER_MAX);
assert.equal(earnSplashEnergy(25,0),25);
assert.equal(earnSplashEnergy(25,-10),25);
assert.equal(earnSplashEnergy(74,SPLASH_DUEL_WIN_GAIN),100);
assert.equal(comboSplashBonus(1),0);
assert.equal(comboSplashBonus(2),0,'two connected strikes are not a complete combo');
assert.equal(comboSplashBonus(3),24,'only the third clean hit grants splash charge');
assert.equal(splashChord({up:true,light:true,heavy:true,l1:false,r1:false}),true);
assert.equal(splashChord({up:true,light:false,heavy:false,l1:true,r1:true}),true);
assert.equal(splashChord({up:false,light:true,heavy:true,l1:false,r1:false}),false);
const guard={down:true,block:true,airborne:false,knockedDown:false,
  knockedOut:false,stunned:0,guarding:true};
assert.equal(canSplashGuard(guard),true);
assert.equal(canSplashGuard({...guard,down:false}),false);
assert.equal(canSplashGuard({...guard,block:false}),false);
assert.equal(canSplashGuard({...guard,guarding:false}),false);
assert.equal(canSplashGuard({...guard,stunned:0.2}),false);
assert.equal(canSplashGuard({...guard,airborne:true}),false);
console.log('Splash rules: OK');
