'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const QRScanner = dynamic(() => import('@/components/QRScanner'), { ssr: false });
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { loadHistory } from '@/lib/gameHistory';
import { Game } from '@/types';
import Logo from '@/components/Logo';
import LangToggle from '@/components/LangToggle';
import { useT } from '@/lib/i18n';
import { Capacitor } from '@capacitor/core';
import AdBanner from '@/components/AdBanner';

interface ActiveGame {
  game: Game;
  isHost: boolean;
  hostName: string;
}

export default function HomeClient() {
  const router = useRouter();
  const { t } = useT();
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    async function loadActiveGames() {
      const history = await loadHistory();
      if (history.length === 0) return;

      // ゲームドキュメントを並列フェッチ
      const gameSnaps = await Promise.all(
        history.map(entry => getDoc(doc(db, 'games', entry.roomCode)))
      );

      const activeEntries = gameSnaps
        .map((snap, i) => ({ snap, roomCode: history[i].roomCode }))
        .filter(({ snap }) => snap.exists())
        .map(({ snap, roomCode }) => ({
          game: { id: snap.id, ...snap.data() } as Game,
          roomCode,
        }))
        .filter(({ game }) => game.status !== 'finished');

      // ホスト名を並列フェッチ
      const results = await Promise.all(
        activeEntries.map(async ({ game, roomCode }) => {
          const playerId = localStorage.getItem(`player_${roomCode}`);
          let hostName = '';
          if (game.host_player_id) {
            const hostSnap = await getDoc(doc(db, 'games', roomCode, 'players', game.host_player_id));
            if (hostSnap.exists()) hostName = (hostSnap.data() as { name: string }).name;
          }
          return { game, isHost: playerId === game.host_player_id, hostName };
        })
      );

      setActiveGames(results);
    }
    loadActiveGames();
  }, []);

  const handleQRScan = useCallback((code: string) => {
    setShowQRScanner(false);
    localStorage.setItem('currentRoomCode', code);
    router.push(`/game/__placeholder__/lobby?room=${code}`);
  }, [router]);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError(t.home.invalidRoomCode);
      return;
    }
    localStorage.setItem('currentRoomCode', code);
    router.push(`/game/__placeholder__/lobby?room=${code}`);
  }

  function goToGame(game: Game) {
    localStorage.setItem('currentRoomCode', game.room_code);
    if (game.status === 'playing') {
      router.push(`/game/__placeholder__/play?room=${game.room_code}`);
    } else {
      router.push(`/game/__placeholder__/lobby?room=${game.room_code}`);
    }
  }

  const isNative = Capacitor.isNativePlatform();

  return (
    <main
      className="p-4"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 2rem)',
        paddingBottom: isNative ? 140 : 80,
      }}
    >
      <div className="flex flex-col items-center mb-6 relative">
        <Logo size="md" />
        <div className="absolute right-0 top-0"><LangToggle /></div>
      </div>

      <div className="space-y-3">
        {activeGames.length > 0 && (
          <div className="card-casino !p-3">
            <p className="text-[#d4af37] font-semibold text-sm mb-2">{t.home.activeGames}</p>
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
                          {t.common.host}
                        </span>
                      )}
                    </div>
                    {hostName && (
                      <p className="text-green-500 text-xs">{t.home.gameOf.replace('{{name}}', hostName)}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0
                    ${game.status === 'playing' ? 'bg-yellow-900 text-yellow-300' : 'bg-green-900 text-green-300'}`}>
                    {game.status === 'playing' ? t.home.statusPlaying : t.home.statusWaiting}
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
          {t.home.createGame}
        </button>

        <button
          onClick={() => router.push('/demo')}
          className="w-full py-3 rounded-lg border border-green-600 text-green-300
                     hover:border-green-500 hover:text-green-200 transition-colors text-base font-medium"
        >
          {t.home.tryDemo}
        </button>

        <div className="card-casino !p-3">
          <p className="text-[#d4af37] font-semibold text-sm mb-2 text-center">{t.home.joinWithCode}</p>
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder={t.home.roomCodePlaceholder}
              maxLength={6}
              className="flex-1 bg-[#145a32] border border-green-700 rounded-lg px-3 py-2.5
                         text-white placeholder-green-600 text-center text-lg font-mono
                         tracking-widest focus:outline-none focus:border-[#d4af37] min-w-0"
            />
            <button
              type="button"
              onClick={() => setShowQRScanner(true)}
              className="bg-[#145a32] hover:bg-green-800 text-white
                         px-3 py-2.5 rounded-lg border border-green-700 transition-colors shrink-0"
              aria-label={t.home.scanQR}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="w-5 h-5">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <path d="M14 14h1v1h-1zM17 14h1v1h-1zM14 17h1v1h-1zM17 17h1v1h-1zM20 14h1v1h-1zM20 17h1v3h-3v-1h1v-1h1v-1zM14 20h3v1h-3z" fill="currentColor" stroke="none" />
              </svg>
            </button>
            <button
              type="submit"
              className="bg-green-700 hover:bg-green-600 text-white font-semibold
                         px-4 py-2.5 rounded-lg border border-green-600 transition-colors shrink-0"
            >
              {t.home.join}
            </button>
          </form>
          {error && <p className="text-red-400 text-xs mt-1.5 text-center">{error}</p>}
        </div>
      </div>

      {showQRScanner && (
        <QRScanner onScan={handleQRScan} onClose={() => setShowQRScanner(false)} />
      )}

      <div
        className="fixed left-0 right-0 bg-[#0d3d22] border-t border-green-900 flex justify-center items-center pt-4"
        style={{
          bottom: isNative ? 60 : 0,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 30px)',
        }}
      >
        <button onClick={() => router.push('/history')} className="text-green-600 text-sm hover:text-green-400 transition-colors">
          {t.home.history}
        </button>
      </div>

      <AdBanner />
    </main>
  );
}
