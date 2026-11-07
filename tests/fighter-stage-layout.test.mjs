import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  STAGE_FLOOR_BACK_EDGE_Y,FIGHTER_GROUND_Y,
  FIGHTER_VISUAL_SCALE,FIGHTER_FLOOR_DEPTH,
} from '../src/combat/FighterStageLayout.ts';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fighter=read('src/combat/Fighter.ts');
const arena=read('src/scenes/ArenaScene.ts');
const idle=read('src/combat/EviCombatIdle.ts');

assert.equal(STAGE_FLOOR_BACK_EDGE_Y,443,
  'keep the back edge of the stage anchored to its existing background art');
assert.equal(FIGHTER_GROUND_Y,470,
  'the fighters stand inside the floor rather than on its rear lip');
assert.equal(FIGHTER_FLOOR_DEPTH,27);
assert.equal(FIGHTER_GROUND_Y-STAGE_FLOOR_BACK_EDGE_Y,FIGHTER_FLOOR_DEPTH);
assert.equal(FIGHTER_VISUAL_SCALE,1.12,
  'both fighters grow evenly by 12 percent rather than only Evi');
assert.ok(FIGHTER_GROUND_Y<540-30,'feet stay inside the arena display');
const previousHead=443-190;
const adjustedHead=FIGHTER_GROUND_Y-190*FIGHTER_VISUAL_SCALE;
assert.ok(Math.abs(adjustedHead-previousHead)<6,
  'size increase compensates for moving feet down, keeping heads visually aligned');

assert.match(fighter,/export const GROUND_Y = FIGHTER_GROUND_Y;/,
  'shadows, sprites AND combat hitboxes share the same forward feet line');
assert.match(fighter,/y:GROUND_Y\+this\.yOffset\+band\.top/,
  'attack hitbox continues to follow the fighter baseline');
assert.match(fighter,/y:GROUND_Y\+this\.yOffset-\(low\?73:145\)/,
  'body hurtbox follows the same baseline');
assert.match(fighter,/this\.rig\.setScale\(this\.face\*FIGHTER_VISUAL_SCALE,/,
  'both ordinary and roll-facing graphics receive the scale from foot origin');
assert.ok((fighter.match(/this\.face\*FIGHTER_VISUAL_SCALE/g)||[]).length===2,
  'both regular and rolling fighters must keep identical horizontal scale');
assert.ok((fighter.match(/\*FIGHTER_VISUAL_SCALE/g)||[]).length>=6,
  'vertical scale and shadows grow with the fighter in all states');
assert.match(fighter,/this\.rig\.setPosition\(this\.x,GROUND_Y\+this\.yOffset\)/,
  'normal rendering stays anchored to the new ground position');
assert.match(fighter,/this\.rig\.setPosition\(this\.x,GROUND_Y\+this\.yOffset\+/,
  'rolling rendering stays anchored to the same ground position');
assert.match(idle,/EVI_COMBAT_IDLE_FOOT_ORIGIN_Y=741\/768/,
  'the transparent sprite keeps its unchanged internal contact row');

const city=arena.slice(arena.indexOf('    // Fighting platform'),
  arena.indexOf('    // Arcades: poles'));
assert.ok(city.includes('STAGE_FLOOR_BACK_EDGE_Y')&&!city.includes('GROUND_Y'),
  'city platform retains the rear edge separate from foreground feet');
const lagoon=arena.slice(arena.indexOf('    // Shoreline ground and subtle wet sand.'),
  arena.indexOf('    // Glow mushrooms'));
assert.ok(lagoon.includes('STAGE_FLOOR_BACK_EDGE_Y')&&!lagoon.includes('GROUND_Y'),
  'lagoon sand/water perspective has the same fixed rear edge');

console.log('✓ Fighters stand 27px inside both arena floors, render 12% larger, and preserve shared combat/visual grounding.');
