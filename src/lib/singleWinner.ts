import { SingleWinnerHoleLog, Player } from '@/types';

export interface SingleWinnerPlayerTotal {
  player: Player;
  wins: number;
  points: number;
  settlement: number;
}

export function calcSingleWinnerTotals(
  players: Player[],
  logs: SingleWinnerHoleLog[],
): SingleWinnerPlayerTotal[] {
  const pts: Record<string, number> = {};
  const wins: Record<string, number> = {};
  players.forEach(p => { pts[p.id] = 0; wins[p.id] = 0; });

  logs.forEach(log => {
    if (!log.winner_player_id) return;
    const effectiveValue = (log.double_up ? 2 : 1) + (log.carryover ?? 0);
    pts[log.winner_player_id] = (pts[log.winner_player_id] ?? 0) + effectiveValue;
    wins[log.winner_player_id] = (wins[log.winner_player_id] ?? 0) + 1;
  });

  const n = players.length;

  return players.map(p => {
    const mine = pts[p.id] ?? 0;
    const othersSum = players
      .filter(o => o.id !== p.id)
      .reduce((sum, o) => sum + (pts[o.id] ?? 0), 0);
    return {
      player: p,
      wins: wins[p.id] ?? 0,
      points: mine,
      settlement: mine * (n - 1) - othersSum,
    };
  }).sort((a, b) => b.settlement - a.settlement);
}
