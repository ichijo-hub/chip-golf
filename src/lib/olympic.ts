import { OlympicEntry, OlympicHoleLog, Player } from '@/types';

// rank 1=最遠(金)=4pt, rank 2=銀=3pt, rank 3=銅=2pt, rank 4=鉄=1pt
// position=null のプレイヤーは 0点
export function calcHolePoints(entry: OlympicEntry): number {
  if (entry.position === null) return 0;
  return Math.max(1, 5 - entry.position);
}

export interface OlympicPlayerTotal {
  player: Player;
  totalPoints: number;
  holePoints: Record<number, number>;
  settlement: number;
}

export function calcOlympicTotals(
  players: Player[],
  logs: OlympicHoleLog[],
): OlympicPlayerTotal[] {
  const totals: Record<string, number> = {};
  const breakdown: Record<string, Record<number, number>> = {};

  players.forEach(p => {
    totals[p.id] = 0;
    breakdown[p.id] = {};
  });

  logs.forEach(log => {
    players.forEach(p => {
      const entry = log.entries[p.id];
      if (!entry) return;
      const pts = calcHolePoints(entry);
      totals[p.id] = (totals[p.id] ?? 0) + pts;
      breakdown[p.id][log.hole_number] = pts;
    });
  });

  const n = players.length;

  return players.map(p => {
    const mine = totals[p.id] ?? 0;
    const othersSum = players
      .filter(o => o.id !== p.id)
      .reduce((sum, o) => sum + (totals[o.id] ?? 0), 0);
    return {
      player: p,
      totalPoints: mine,
      holePoints: breakdown[p.id] ?? {},
      settlement: mine * (n - 1) - othersSum,
    };
  }).sort((a, b) => b.settlement - a.settlement);
}
