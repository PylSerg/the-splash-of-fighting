import assert from 'node:assert/strict';
import { deriveCommandChords, visualChords } from '../src/input/CommandRules.ts';
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
console.log('✓ Touch A+B highlight and priority, keyboard/gamepad special/duel: passed.');
