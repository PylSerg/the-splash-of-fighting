/** Best-of-three: first to two won rounds takes the match. Draws replay. */
export const MATCH_MAX_ROUNDS = 3;
export const MATCH_WINS_REQUIRED = 2;
export interface MatchScore {
  wins: [number,number];
  roundsPlayed:number;
}
export function awardRound(score:MatchScore,winner:0|1|null): MatchScore & {
  matchWinner:0|1|null; roundNumber:number;
} {
  const wins:[number,number]=[...score.wins];
  if(winner!==null) wins[winner]++;
  const roundsPlayed=score.roundsPlayed+(winner===null?0:1);
  const matchWinner=wins[0]>=MATCH_WINS_REQUIRED?0:
    wins[1]>=MATCH_WINS_REQUIRED?1:null;
  return {wins,roundsPlayed,matchWinner,
    roundNumber:Math.min(MATCH_MAX_ROUNDS,roundsPlayed+1)};
}
