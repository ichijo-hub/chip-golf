'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Game } from '@/types';

interface ActiveGame {
  game: Game;
  isHost: boolean;
  hostName: string;
}

export default function HomeClient() {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);

  useEffect(() => {
    async function loadActiveGames() {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('games')
        .select('*')
        .in('status', ['lobby', 'playing'])
        .or(`status.eq.playing,and(status.eq.lobby,created_at.gte.${oneHourAgo})`)
        .order('created_at', { ascending: false });

      if (!data || data.length === 0) return;

      const games = data as Game[];
      const hostPlayerIds = games.map(g => g.host_player_id).filter(Boolean) as string[];

      const { data: playersData } = await supabase
        .from('players')
        .select('id, name')
        .in('id', hostPlayerIds);

      const playerMap = Object.fromEntries(
        ((playersData ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name])
      );

      const result: ActiveGame[] = games.map(game => {
        const playerId = localStorage.getItem(`player_${game.room_code}`);
        return {
          game,
          isHost: playerId === game.host_player_id,
          hostName: game.host_player_id ? (playerMap[game.host_player_id] ?? '') : '',
        };
      });

      setActiveGames(result);
    }
    loadActiveGames();
  }, [supabase]);

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
      {/* ヘッダー */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 rounded-full bg-[#d4af37] flex items-center justify-center mb-3 shadow-lg">
          <span className="text-3xl leading-none">⛳</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight leading-none">チップゴルフ</h1>
        <p className="text-green-600 text-xs mt-1.5 tracking-wide">ベガスゴルフ カジノチップゲーム</p>
      </div>

      <div className="space-y-3">
        {/* 開催中のゲーム */}
        {activeGames.length > 0 && (
          <div className="card-casino !p-3">
            <p className="text-[#d4af37] font-semibold text-sm mb-2">開催中のゲーム</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {activeGames.map(({ game, isHost, hostName }) => (
                <button
                  key={game.id}
                  onClick={() => goToGame(game)}
                  className="w-full flex items-center justify-between bg-[#0a3d20] rounded-lg px-3 py-2
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

        {/* 新規作成 */}
        <button
          onClick={() => router.push('/game/new')}
          className="btn-gold w-full py-3 text-base"
        >
          新しいゲームを作成
        </button>

        {/* ルームコード参加 */}
        <div className="card-casino !p-3">
          <p className="text-[#d4af37] font-semibold text-sm mb-2 text-center">ルームコードで参加</p>
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder="ABC123"
              maxLength={6}
              className="flex-1 bg-[#0a3d20] border border-green-700 rounded-lg px-3 py-2.5
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

      <div className="fixed bottom-0 left-0 right-0 bg-[#0a2d14] border-t border-green-900 flex justify-center items-center gap-8 py-3">
        <button onClick={() => router.push('/history')} className="text-green-600 text-sm hover:text-green-400 transition-colors">
          ゲーム履歴
        </button>
        <span className="text-green-900">|</span>
        <button onClick={() => router.push('/chips')} className="text-green-600 text-sm hover:text-green-400 transition-colors">
          チップ管理
        </button>
      </div>
    </main>
  );
}
