'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { loadHistory } from '@/lib/gameHistory';
import { Game } from '@/types';
import Logo from '@/components/Logo';

interface ActiveGame {
  game: Game;
  isHost: boolean;
  hostName: string;
}

export default function HomeClient() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);

  useEffect(() => {
    async function loadActiveGames() {
      const history = loadHistory();
      if (history.length === 0) return;

      const results: ActiveGame[] = [];
      for (const entry of history) {
        const gameSnap = await getDoc(doc(db, 'games', entry.roomCode));
        if (!gameSnap.exists()) continue;
        const game = { id: gameSnap.id, ...gameSnap.data() } as Game;
        if (game.status === 'finished') continue;

        const playerId = localStorage.getItem(`player_${entry.roomCode}`);
        let hostName = '';
        if (game.host_player_id) {
          const hostSnap = await getDoc(doc(db, 'games', entry.roomCode, 'players', game.host_player_id));
          if (hostSnap.exists()) hostName = (hostSnap.data() as { name: string }).name;
        }
        results.push({ game, isHost: playerId === game.host_player_id, hostName });
      }
      setActiveGames(results);
    }
    loadActiveGames();
  }, []);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('ルームコードは6文字で入力してください');
      return;
    }
    router.push(`/game/${code}/lobby`);
  }

  function goToGame(game: Game) {
    if (game.status === 'playing') {
      router.push(`/game/${game.room_code}/play`);
    } else {
      router.push(`/game/${game.room_code}/lobby`);
    }
  }

  return (
    <main className="min-h-screen p-4 pt-8 pb-16">
      <div className="flex flex-col items-center mb-6">
        <Logo size="md" />
      </div>

      <div className="space-y-3">
        {activeGames.length > 0 && (
          <div className="card-casino !p-3">
            <p className="text-[#d4af37] font-semibold text-sm mb-2">開催中のゲーム</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {activeGames.map(({ game, isHost, hostName }) => (
                <button
                  key={game.id}
                  onClick={() => goToGame(game)}
                  className="w-full flex items-center justify-between bg-[#145a32] rounded-lg px-3 py-2
                             hover:bg-green-900 transition-colors text-left"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[#d4af37] tracking-widest">
                        {game.room_code}
                      </span>
                      {isHost && (
                        <span className="text-xs bg-[#d4af37] text-[#1a1a1a] px-1.5 py-0.5 rounded font-semibold">
                          ホスト
                        </span>
                      )}
                    </div>
                    {hostName && (
                      <p className="text-green-500 text-xs">{hostName} のゲーム</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0
                    ${game.status === 'playing' ? 'bg-yellow-900 text-yellow-300' : 'bg-green-900 text-green-300'}`}>
                    {game.status === 'playing' ? '進行中' : '待機中'} →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => router.push('/game/new')}
          className="btn-gold w-full py-3 text-base"
        >
          新しいゲームを作成
        </button>

        <div className="card-casino !p-3">
          <p className="text-[#d4af37] font-semibold text-sm mb-2 text-center">ルームコードで参加</p>
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder="ABC123"
              maxLength={6}
              className="flex-1 bg-[#145a32] border border-green-700 rounded-lg px-3 py-2.5
                         text-white placeholder-green-600 text-center text-lg font-mono
                         tracking-widest focus:outline-none focus:border-[#d4af37] min-w-0"
            />
            <button
              type="submit"
              className="bg-green-700 hover:bg-green-600 text-white font-semibold
                         px-4 py-2.5 rounded-lg border border-green-600 transition-colors shrink-0"
            >
              参加
            </button>
          </form>
          {error && <p className="text-red-400 text-xs mt-1.5 text-center">{error}</p>}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#0d3d22] border-t border-green-900 flex justify-center items-center pt-4 pb-8">
        <button onClick={() => router.push('/history')} className="text-green-600 text-sm hover:text-green-400 transition-colors">
          ゲーム履歴
        </button>
      </div>
    </main>
  );
}
