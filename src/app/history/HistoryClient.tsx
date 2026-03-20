'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { loadHistory } from '@/lib/gameHistory';
import { calculateScores } from '@/lib/scoring';
import { Game, Player, ChipDefinition, ChipState } from '@/types';

interface GameSummary {
  game: Game;
  players: Player[];
  topPlayer: Player | null;
  netScores: { player: Player; netScore: number }[];
  joinedAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  lobby: '待機中',
  playing: '進行中',
  finished: '終了',
};

const MEDALS = ['🥇', '🥈', '🥉'];

export default function HistoryClient() {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [summaries, setSummaries] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const history = loadHistory();
      if (history.length === 0) { setLoading(false); return; }

      const roomCodes = history.map(h => h.roomCode);

      const { data: gamesData } = await supabase
        .from('games').select('*').in('room_code', roomCodes);
      if (!gamesData || gamesData.length === 0) { setLoading(false); return; }

      const games = gamesData as Game[];

      const gameIds = games.map(g => g.id);
      const [{ data: playersData }, { data: chipDefsData }, { data: chipStatesData }] =
        await Promise.all([
          supabase.from('players').select('*').in('game_id', gameIds).order('display_order'),
          supabase.from('chip_definitions').select('*').in('game_id', gameIds),
          supabase.from('chip_states').select('*').in('game_id', gameIds),
        ]);

      const players = (playersData ?? []) as Player[];
      const chipDefs = (chipDefsData ?? []) as ChipDefinition[];
      const chipStates = (chipStatesData ?? []) as ChipState[];

      const result: GameSummary[] = history
        .map(entry => {
          const game = games.find(g => g.room_code === entry.roomCode);
          if (!game) return null;
          const gamePlayers = players.filter(p => p.game_id === game.id);
          const gameChipDefs = chipDefs.filter(c => c.game_id === game.id);
          const gameChipStates = chipStates.filter(c => c.game_id === game.id);
          const scores = calculateScores(gamePlayers, gameChipStates, gameChipDefs);
          return {
            game,
            players: gamePlayers,
            topPlayer: scores[0]?.player ?? null,
            netScores: scores.map(s => ({ player: s.player, netScore: s.netScore })),
            joinedAt: entry.joinedAt,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      setSummaries(result);
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-green-400">読み込み中...</p></main>;
  }

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <button onClick={() => router.push('/')} className="text-green-400 hover:text-[#d4af37] transition-colors">← トップ</button>
          <h1 className="text-2xl font-bold text-[#d4af37]">ゲーム履歴</h1>
        </div>

        {summaries.length === 0 ? (
          <div className="card-casino text-center py-12">
            <p className="text-4xl mb-4">⛳</p>
            <p className="text-green-500">まだ参加したゲームがありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {summaries.map(({ game, players, netScores, joinedAt }) => (
              <div key={game.id} className="card-casino">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#d4af37] tracking-widest">{game.room_code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${game.status === 'finished' ? 'bg-green-900 text-green-300' :
                          game.status === 'playing' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-gray-800 text-gray-400'}`}>
                        {STATUS_LABEL[game.status]}
                      </span>
                    </div>
                    <p className="text-green-600 text-xs mt-1">
                      {new Date(joinedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      　{players.length}人参加
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(
                      game.status === 'finished' ? `/game/${game.room_code}/result` :
                      game.status === 'playing'  ? `/game/${game.room_code}/play` :
                      `/game/${game.room_code}/lobby`
                    )}
                    className="text-sm text-green-400 hover:text-[#d4af37] transition-colors shrink-0"
                  >
                    {game.status === 'finished' ? '結果を見る' : '参加する'} →
                  </button>
                </div>

                {netScores.length > 0 && (
                  <div className="space-y-1">
                    {netScores.map(({ player, netScore }, i) => (
                      <div key={player.id} className="flex items-center gap-2 text-sm">
                        <span className="w-6 text-center">{MEDALS[i] ?? '　'}</span>
                        <span className="flex-1 text-white truncate">{player.name}</span>
                        <span className={`font-bold tabular-nums
                          ${netScore > 0 ? 'text-[#d4af37]' : netScore < 0 ? 'text-red-400' : 'text-white'}`}>
                          {netScore > 0 ? `+${netScore}` : netScore}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
