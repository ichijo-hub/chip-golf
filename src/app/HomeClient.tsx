'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomeClient() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('ルームコードは6文字で入力してください');
      return;
    }
    router.push(`/game/${code}/lobby`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">⛳</div>
        <h1 className="text-4xl font-bold text-[#d4af37] tracking-wide">
          チップゴルフ
        </h1>
        <p className="text-green-300 mt-2 text-sm">
          ベガスゴルフ カジノチップゲーム
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => router.push('/game/new')}
          className="btn-gold w-full text-lg py-4"
        >
          新しいゲームを作成
        </button>

        <div className="card-casino">
          <p className="text-[#d4af37] font-semibold mb-3 text-center">
            ゲームに参加
          </p>
          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="ルームコード（例: ABC123）"
              maxLength={6}
              className="w-full bg-[#0a3d20] border border-green-700 rounded-lg px-4 py-3
                         text-white placeholder-green-600 text-center text-xl font-mono
                         tracking-widest focus:outline-none focus:border-[#d4af37]"
            />
            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}
            <button
              type="submit"
              className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold
                         py-3 rounded-lg border border-green-600 transition-colors"
            >
              参加する
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 flex gap-6">
        <button
          onClick={() => router.push('/history')}
          className="text-green-700 text-xs hover:text-green-500 transition-colors"
        >
          ゲーム履歴
        </button>
        <button
          onClick={() => router.push('/chips')}
          className="text-green-700 text-xs hover:text-green-500 transition-colors"
        >
          チップ管理
        </button>
      </div>
      <p className="mt-4 text-green-700 text-xs">© 2026 チップゴルフ</p>
    </main>
  );
}
