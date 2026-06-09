'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  doc, getDoc, collection, getDocs, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { loadHistory } from '@/lib/gameHistory';
import { calculateScores } from '@/lib/scoring';
import { Game, Player, ChipDefinition, ChipState } from '@/types';
import Logo from '@/components/Logo';
import { useT } from '@/lib/i18n';

interface GameSummary {
  game: Game;
  players: Player[];
  netScores: { player: Player; netScore: number }[];
  joinedAt: string;
}


const MEDALS = ['🥇', '🥈', '🥉'];

export default function HistoryClient() {
  const router = useRouter();
  const { t } = useT();
  const [summaries, setSummaries] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const history = (await loadHistory()).slice(0, 15); // 最大15件
        setLoading(false);
        if (history.length === 0) return;

        await Promise.all(history.map(async (entry) => {
          try {
            const gameSnap = await getDoc(doc(db, 'games', entry.roomCode));
            if (!gameSnap.exists()) return;
            const game = { id: gameSnap.id, ...gameSnap.data() } as Game;

            const [playersSnap, chipDefsSnap, chipStatesSnap] = await Promise.all([
              getDocs(query(collection(db, 'games', entry.roomCode, 'players'), orderBy('display_order'))),
              getDocs(collection(db, 'games', entry.roomCode, 'chip_definitions')),
              getDocs(collection(db, 'games', entry.roomCode, 'chip_states')),
            ]);

            const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
            const chipDefs = chipDefsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChipDefinition));
            const chipStates = chipStatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChipState));
            const scores = calculateScores(players, chipStates, chipDefs);

            const summary: GameSummary = {
              game,
              players,
              netScores: scores.map(s => ({ player: s.player, netScore: s.netScore })),
              joinedAt: entry.joinedAt,
            };

            setSummaries(prev =>
              [...prev, summary].sort(
                (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
              )
            );
          } catch {
            // 個別エラーは無視して他のゲームを継続
          }
        }));
      } catch {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusLabel = (status: string) => ({
    lobby: t.history.waiting,
    playing: t.history.playing,
    finished: t.history.finished,
  }[status] ?? status);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-green-400">{t.common.loading}</p></main>;
  }

  return (
    <main className="min-h-screen pb-24">
      <div className="sticky top-0 bg-[#145a32] border-b border-green-800 px-3 z-10" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: '8px' }}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/')}><Logo size="sm" /></button>
          <p className="text-[#d4af37] font-bold text-sm">{t.history.title}</p>
        </div>
      </div>
      <div className="max-w-md mx-auto p-4">
        {summaries.length === 0 ? (
          <div className="card-casino text-center py-12">
            <p className="text-4xl mb-4">⛳</p>
            <p className="text-green-500">{t.history.noGames}</p>
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
                        {statusLabel(game.status)}
                      </span>
                    </div>
                    <p className="text-green-600 text-xs mt-1">
                      {new Date(joinedAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      　{t.history.participants.replace('{{count}}', String(players.length))}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      localStorage.setItem('currentRoomCode', game.room_code);
                      router.push(
                        game.status === 'finished' ? `/game/__placeholder__/result?room=${game.room_code}` :
                        game.status === 'playing'  ? `/game/__placeholder__/play?room=${game.room_code}` :
                        `/game/__placeholder__/lobby?room=${game.room_code}`
                      );
                    }}
                    className="text-sm text-green-400 hover:text-[#d4af37] transition-colors shrink-0"
                  >
                    {game.status === 'finished' ? t.history.viewResult : t.history.join} →
                  </button>
                </div>
                {netScores.length > 0 && (
                  <div className="space-y-1">
                    {netScores.map(({ player, netScore }, i) => (
                      <div key={player.id} className="flex items-center gap-2 text-sm">
                        <span className="w-6 text-center">{MEDALS[i] ?? '　'}</span>
                        <span className="flex-1 text-white truncate">{player.name}</span>
                        <span className={`font-bold tabular-nums ${netScore > 0 ? 'text-[#d4af37]' : netScore < 0 ? 'text-red-400' : 'text-white'}`}>
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
