import assert from 'node:assert/strict';
import { deriveCommandChords, visualChords, resolveXYTouch } from '../src/input/CommandRules.ts';
import { splashChord } from '../src/combat/SplashRules.ts';
const b={block:false,kick:false,heavy:false,r1Solo:false,
  r1AndR2:false,duelSwipe:false,specialSwipe:false};
const d=change=>deriveCommandChords({...b,...change});
assert.deepEqual(d({}),{duel:false,special:false});
assert.deepEqual(d({kick:true,heavy:true}),{duel:true,special:false},
  'B+Y is the duel chord, not special');
assert.deepEqual(d({kick:true,block:true}),{duel:false,special:true},
  'A+B is the special chord, not duel');
assert.deepEqual(d({r1Solo:true}),{duel:true,special:false},
  'single R1 is the duel shoulder shortcut');
assert.deepEqual(d({r1AndR2:true}),{duel:false,special:true},
  'R1+R2 is the special shoulder chord');
assert.deepEqual(d({duelSwipe:true}),{duel:true,special:false},
  'one finger B-Y swipe activates duel');
assert.deepEqual(d({specialSwipe:true}),{duel:false,special:true},
  'one finger A-B swipe activates special');
assert.deepEqual(d({kick:true,heavy:true,block:true}),{duel:false,special:true},
  'special wins when A+B+Y is pressed');
assert.deepEqual(d({r1Solo:true,r1AndR2:true}),{duel:false,special:true},
  'R1+R2 overrides standalone R1');
assert.deepEqual(d({duelSwipe:true,specialSwipe:true}),{duel:false,special:true},
  'special swipe overrides duel swipe');
const visual={light:false,heavy:false,kick:false,block:false,
  duelSwipe:false,specialSwipe:false,grabSwipe:false};
const v=patch=>visualChords({...visual,...patch});
assert.deepEqual(v({block:true,kick:true}),
  {duel:false,special:true,grab:false},
  'A+B highlights special only: NEVER Y/duel');
assert.deepEqual(v({block:true,kick:true,heavy:true}),
  {duel:false,special:true,grab:false},
  'special has priority even when nearby Y receives stray input');
assert.deepEqual(v({kick:true,heavy:true}),
  {duel:true,special:false,grab:false},
  'B+Y highlights duel only');
assert.deepEqual(v({light:true,block:true}),
  {duel:false,special:false,grab:true},
  'X+A highlights grab only');
assert.deepEqual(v({specialSwipe:true,duelSwipe:true}),
  {duel:false,special:true,grab:false},
  'A+B swipe overrides lingering B+Y swipe');
const fingers=new Map([[101,'light'],[202,'heavy']]);
assert.deepEqual(resolveXYTouch(fingers,false),
  {light:true,heavy:true},'different physical pointer IDs hold X and Y at once');
assert.deepEqual(resolveXYTouch(new Map([[202,'heavy'],[101,'light']]),false),
  {light:true,heavy:true},'press order cannot affect X+Y combination');
assert.deepEqual(resolveXYTouch(new Map([[101,'light']]),false),
  {light:true,heavy:false},'only X alone is not a SPLASH chord');
assert.deepEqual(resolveXYTouch(new Map([[202,'heavy']]),false),
  {light:false,heavy:true},'only Y alone is not a SPLASH chord');
assert.deepEqual(resolveXYTouch(new Map([[101,'light']]),true),
  {light:true,heavy:true},'X→Y swipe holds both virtual buttons');
assert.deepEqual(resolveXYTouch(new Map([[202,'heavy']]),true),
  {light:true,heavy:true},'Y→X swipe holds both virtual buttons');
assert.deepEqual(resolveXYTouch(new Map([[101,'block'],[202,'kick']]),false),
  {light:false,heavy:false},'A+B never impersonates X+Y');
const swipeXY=resolveXYTouch(new Map([[101,'light']]),true);
assert.equal(splashChord({up:true,...swipeXY,l1:false,r1:false}),true,
  'joystick ↑ + X→Y one-finger swipe really activates SPLASH');
assert.equal(splashChord({up:false,...swipeXY,l1:false,r1:false}),false,
  'X/Y swipe alone never launches a SPLASH without ↑');
const holdXY=resolveXYTouch(new Map([[101,'light'],[202,'heavy']]),false);
assert.equal(splashChord({up:true,...holdXY,l1:false,r1:false}),true,
  'two simultaneous X/Y fingers plus ↑ really activate SPLASH');
console.log('✓ Independent X+Y multi-touch, two swipe directions, A+B and duel precedence: passed.');
