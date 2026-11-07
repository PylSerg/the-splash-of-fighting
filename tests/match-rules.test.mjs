import assert from 'node:assert/strict';
import {awardRound,MATCH_MAX_ROUNDS,MATCH_WINS_REQUIRED,
  ROUND_ANNOUNCE_SECONDS,FIGHT_ANNOUNCE_SECONDS,ROUND_INTRO_TOTAL,roundIntroText,
} from '../src/combat/MatchRules.ts';
assert.equal(MATCH_MAX_ROUNDS,3);
assert.equal(MATCH_WINS_REQUIRED,2);
assert.equal(ROUND_ANNOUNCE_SECONDS,1);
assert.equal(FIGHT_ANNOUNCE_SECONDS,1);
assert.equal(ROUND_INTRO_TOTAL,2);
for(const round of [1,2,3]){
  assert.equal(roundIntroText(2,round),'ROUND '+round);
  assert.equal(roundIntroText(1.01,round),'ROUND '+round);
  assert.equal(roundIntroText(1,round),'FIGHT!');
  assert.equal(roundIntroText(.01,round),'FIGHT!');
  assert.equal(roundIntroText(0,round),null);
}

let s={wins:[0,0],roundsPlayed:0};
s=awardRound(s,null);
assert.deepEqual(s.wins,[0,0]);
assert.equal(s.roundNumber,1,'draw replays the round');
s=awardRound(s,0);
assert.deepEqual(s.wins,[1,0]);
assert.equal(s.roundNumber,2);
assert.equal(s.matchWinner,null);
s=awardRound(s,1);
assert.deepEqual(s.wins,[1,1]);
assert.equal(s.roundNumber,3);
s=awardRound(s,0);
assert.deepEqual(s.wins,[2,1]);
assert.equal(s.matchWinner,0);
assert.equal(s.roundNumber,3);
const quick=awardRound(awardRound({wins:[0,0],roundsPlayed:0},1),1);
assert.equal(quick.matchWinner,1,'two straight wins stop the match early');
assert.equal(quick.roundsPlayed,2);
console.log('Best-of-three rules: OK');
