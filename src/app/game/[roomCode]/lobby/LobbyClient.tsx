'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  doc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { saveToHistory } from '@/lib/gameHistory';
import { Game, Player, HoleMode } from '@/types';

const HOLE_MODES: HoleMode[] = ['none', '9h', '18h_out', '18h_in'];

function holeModeData(mode: HoleMode) {
  if (mode === '9h')      return { total_holes: 9,  current_hole: 1 };
  if (mode === '18h_out') return { total_holes: 18, current_hole: 1 };
  if (mode === '18h_in')  return { total_holes: 18, current_hole: 10 };
  return                         { total_holes: 0,  current_hole: 1 };
}
import { useT } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';

export default function LobbyClient() {
  const params = useParams();
  const router = useRouter();
  // ?room= が優先（__placeholder__ ナビゲーション）、なければ params から取得（Vercel SSR 直アクセス）
  const [roomCode] = useState(() => {
    const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('currentRoomCode') : null;
    const fromSearch = new URLSearchParams(window.location.search).get('room');
    const fromParams = params?.roomCode as string | undefined;
    const code = fromSearch || fromStorage || (fromParams && fromParams !== '__placeholder__' ? fromParams : '');
    return (code || '').toUpperCase();
  });

  const { t } = useT();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [lobbyUrl, setLobbyUrl] = useState('');

  const loadGame = useCallback(async () => {
    if (!roomCode) { router.push('/'); return; }
    const gameSnap = await getDoc(doc(db, 'games', roomCode));
    if (!gameSnap.exists()) {
      setError(t.lobby.gameNotFound);
      setLoading(false);
      return;
    }
    const typedGame = { id: gameSnap.id, ...gameSnap.data() } as Game;
    setGame(typedGame);

    const playersSnap = await getDocs(query(collection(db, 'games', roomCode, 'players'), orderBy('display_order')));
    setPlayers(playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
    setLoading(false);

    const savedId = localStorage.getItem(`player_${roomCode}`);
    if (typedGame.status === 'playing' && savedId) { localStorage.setItem('currentRoomCode', roomCode); router.push(`/game/__placeholder__/play?room=${roomCode}`); }
    else if (typedGame.status === 'finished') { localStorage.setItem('currentRoomCode', roomCode); router.push(`/game/__placeholder__/result?room=${roomCode}`); }
  }, [roomCode, router]);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    setLobbyUrl(`${baseUrl}/game/__placeholder__/lobby?room=${roomCode}`);
    const savedId = localStorage.getItem(`player_${roomCode}`);
    if (savedId) setMyPlayerId(savedId);
    loadGame();
  }, [roomCode, loadGame]);

  useEffect(() => {
    // Realtime: game status changes
    if (!roomCode) return;
    const unsubGame = onSnapshot(doc(db, 'games', roomCode), (snap) => {
      if (!snap.exists()) return;
      const updated = { id: snap.id, ...snap.data() } as Game;
      setGame(updated);
      const savedId = localStorage.getItem(`player_${roomCode}`);
      if (updated.status === 'playing' && savedId) { localStorage.setItem('currentRoomCode', roomCode); router.push(`/game/__placeholder__/play?room=${roomCode}`); }
    });

    // Realtime: player list changes
    const unsubPlayers = onSnapshot(
      query(collection(db, 'games', roomCode, 'players'), orderBy('display_order')),
      (snap) => {
        setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
      }
    );

    return () => { unsubGame(); unsubPlayers(); };
  }, [roomCode, router]);

  async function handleJoin(isSpectator: boolean) {
    if (!playerName.trim() || !game) return;
    setJoining(true);
    setError('');

    try {
      const playerRef = await addDoc(collection(db, 'games', roomCode, 'players'), {
        id: '', game_id: roomCode, name: playerName.trim(),
        display_order: players.length, is_host: false,
        is_spectator: isSpectator, comments: [],
        created_at: new Date().toISOString(),
      });
      await updateDoc(playerRef, { id: playerRef.id });

      localStorage.setItem(`player_${roomCode}`, playerRef.id);
      saveToHistory(roomCode);
      setMyPlayerId(playerRef.id);

      if (game.status === 'playing') {
        localStorage.setItem('currentRoomCode', roomCode);
        router.push(`/game/__placeholder__/play?room=${roomCode}`);
      }
    } catch (err: unknown) {
      setError(t.lobby.joinError.replace('{{error}}', err instanceof Error ? err.message : String(err)));
    } finally {
      setJoining(false);
    }
  }

  async function handleStartGame() {
    if ((game?.olympic_enabled || game?.dracon_enabled || game?.niapin_enabled) && (!game.hole_mode || game.hole_mode === 'none')) {
      setError(t.lobby.errorOlympicNeedsHole);
      return;
    }
    setError('');
    await updateDoc(doc(db, 'games', roomCode), { status: 'playing' });
    localStorage.setItem('currentRoomCode', roomCode);
    router.push(`/game/__placeholder__/play?room=${roomCode}`);
  }

  async function handleHoleModeChange(mode: HoleMode) {
    const { total_holes, current_hole } = holeModeData(mode);
    await updateDoc(doc(db, 'games', roomCode), { hole_mode: mode, total_holes, current_hole });
  }

  async function handleDeleteGame() {
    if (!confirm(t.lobby.confirmDelete)) return;
    const batch = writeBatch(db);
    const [playersSnap, chipDefsSnap, chipStatesSnap, eventsSnap] = await Promise.all([
      getDocs(collection(db, 'games', roomCode, 'players')),
      getDocs(collection(db, 'games', roomCode, 'chip_definitions')),
      getDocs(collection(db, 'games', roomCode, 'chip_states')),
      getDocs(collection(db, 'games', roomCode, 'game_events')),
    ]);
    [...playersSnap.docs, ...chipDefsSnap.docs, ...chipStatesSnap.docs, ...eventsSnap.docs].forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'games', roomCode));
    await batch.commit();
    router.push('/');
  }

  function copyRoomCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isHost = myPlayerId === game?.host_player_id;
  const isJoined = !!myPlayerId;
  const nonSpectatorCount = players.filter(p => !p.is_spectator).length;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-green-400">{t.common.loading}</p>
      </main>
    );
  }

  if (error && !game) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-400 text-center">{error}</p>
        <button onClick={() => router.push('/')} className="btn-gold px-6 py-2">{t.common.backToTop}</button>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 pb-24" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <button onClick={() => router.push('/')} className="text-green-400 hover:text-[#d4af37] transition-colors">
            {t.lobby.backToTop}
          </button>
          <h1 className="text-2xl font-bold text-[#d4af37] flex-1">{t.lobby.title}</h1>
          <LangToggle />
        </div>

        <div className="card-casino text-center mb-4">
          <p className="text-green-400 text-sm mb-2">{t.lobby.roomCode}</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-mono font-bold text-[#d4af37] tracking-widest">
              {roomCode}
            </span>
            <button onClick={copyRoomCode} className="text-green-400 hover:text-[#d4af37] transition-colors text-sm">
              {copied ? t.lobby.copied : t.lobby.copy}
            </button>
          </div>
        </div>

        {lobbyUrl && (
          <div className="card-casino flex flex-col items-center mb-4">
            <p className="text-green-400 text-sm mb-3">{t.lobby.qrCode}</p>
            <div className="bg-white p-3 rounded-lg">
              <QRCodeSVG value={lobbyUrl} size={160} />
            </div>
          </div>
        )}

        {!isJoined && (
          <div className="card-casino mb-4">
            <p className="text-[#d4af37] font-semibold mb-1">{t.lobby.joinSection}</p>
            {game?.status === 'playing' && (
              <p className="text-green-500 text-xs mb-3">{t.lobby.joinInProgressNote}</p>
            )}
            <div className="space-y-3">
              <input
                type="text" value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t.lobby.namePlaceholder} maxLength={20}
                className="w-full bg-[#145a32] border border-green-700 rounded-lg px-4 py-3
                           text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37]"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleJoin(false)}
                  disabled={joining || !playerName.trim()}
                  className="btn-gold flex-1 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {joining ? t.lobby.joining : t.lobby.joinAsPlayer}
                </button>
                <button
                  type="button"
                  onClick={() => handleJoin(true)}
                  disabled={joining || !playerName.trim()}
                  className="flex-1 py-3 rounded-lg border border-green-600 text-green-300
                             hover:border-[#d4af37] hover:text-[#d4af37] transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                >
                  {t.lobby.joinAsSpectator}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card-casino mb-4">
          <p className="text-[#d4af37] font-semibold mb-1">{t.lobby.playersCount.replace('{{count}}', String(players.length))}</p>
          {isHost && <p className="text-green-600 text-xs mb-3">{t.lobby.anyNumberNote}</p>}
          {players.length === 0 ? (
            <p className="text-green-600 text-sm text-center py-2">{t.lobby.waitingForPlayers}</p>
          ) : (
            <ul className="space-y-2">
              {players.map((p) => (
                <li key={p.id} className="flex items-center justify-between bg-[#145a32] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium">{p.name}</span>
                    {p.id === myPlayerId && <span className="text-xs text-green-400">{t.common.you}</span>}
                    {p.is_spectator && (
                      <span className="text-xs bg-green-900 border border-green-700 text-green-400 px-2 py-0.5 rounded">
                        {t.play.spectator}
                      </span>
                    )}
                  </div>
                  {p.is_host && (
                    <span className="text-xs bg-[#d4af37] text-[#1a1a1a] px-2 py-0.5 rounded font-semibold">{t.common.host}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {isHost && isJoined && (
          <div className="space-y-3">
            <div className="card-casino">
              <p className="text-[#d4af37] font-semibold mb-3">{t.newGame.holeSetting}</p>
              <div className="grid grid-cols-2 gap-2">
                {HOLE_MODES.filter(mode => !((game?.olympic_enabled || game?.dracon_enabled || game?.niapin_enabled) && mode === 'none')).map(mode => {
                  const label = mode === 'none' ? t.newGame.holeNone
                    : mode === '9h' ? t.newGame.hole9h
                    : mode === '18h_out' ? t.newGame.hole18hOut
                    : t.newGame.hole18hIn;
                  const current = game?.hole_mode ?? 'none';
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleHoleModeChange(mode)}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                        current === mode
                          ? 'bg-[#d4af37] text-[#1a1a1a]'
                          : 'bg-[#145a32] border border-green-700 text-green-300 hover:border-[#d4af37]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => { localStorage.setItem('currentRoomCode', roomCode); router.push(`/game/__placeholder__/chips?room=${roomCode}`); }}
              className="w-full py-3 rounded-lg border border-green-700 text-green-300
                         hover:border-[#d4af37] hover:text-[#d4af37] transition-colors text-sm"
            >
              {t.lobby.manageChips}
            </button>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={handleStartGame}
              disabled={nonSpectatorCount < 2}
              className="btn-gold w-full text-lg py-4"
            >
              {nonSpectatorCount < 2 ? t.lobby.needMorePlayers : t.lobby.startGame}
            </button>
            <button
              onClick={handleDeleteGame}
              className="w-full py-3 rounded-lg border border-red-800 text-red-500
                         hover:border-red-600 hover:text-red-400 transition-colors text-sm"
            >
              {t.lobby.deleteGame}
            </button>
          </div>
        )}

        {isJoined && !isHost && (
          <p className="text-center text-green-500 text-sm">
            {t.lobby.waitingForHost}
          </p>
        )}
      </div>
    </main>
  );
}
