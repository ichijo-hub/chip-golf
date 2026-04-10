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
import { Game, Player } from '@/types';
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

    if (typedGame.status === 'playing') { localStorage.setItem('currentRoomCode', roomCode); router.push(`/game/__placeholder__/play?room=${roomCode}`); }
    else if (typedGame.status === 'finished') { localStorage.setItem('currentRoomCode', roomCode); router.push(`/game/__placeholder__/result?room=${roomCode}`); }
  }, [roomCode, router]);

  useEffect(() => {
    setLobbyUrl(window.location.href);
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
      if (updated.status === 'playing') { localStorage.setItem('currentRoomCode', roomCode); router.push(`/game/__placeholder__/play?room=${roomCode}`); }
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

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim() || !game) return;
    setJoining(true);
    setError('');

    try {
      const playerRef = await addDoc(collection(db, 'games', roomCode, 'players'), {
        id: '', game_id: roomCode, name: playerName.trim(),
        display_order: players.length, is_host: false, created_at: new Date().toISOString(),
      });
      // Update the id field to match the doc id
      await updateDoc(playerRef, { id: playerRef.id });

      localStorage.setItem(`player_${roomCode}`, playerRef.id);
      saveToHistory(roomCode);
      setMyPlayerId(playerRef.id);
    } catch (err: unknown) {
      setError(t.lobby.joinError.replace('{{error}}', err instanceof Error ? err.message : String(err)));
    } finally {
      setJoining(false);
    }
  }

  async function handleStartGame() {
    await updateDoc(doc(db, 'games', roomCode), { status: 'playing' });
    localStorage.setItem('currentRoomCode', roomCode);
    router.push(`/game/__placeholder__/play?room=${roomCode}`);
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
    <main className="min-h-screen p-4 pb-24">
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
            <p className="text-[#d4af37] font-semibold mb-3">{t.lobby.joinSection}</p>
            <form onSubmit={handleJoin} className="space-y-3">
              <input
                type="text" value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t.lobby.namePlaceholder} maxLength={20}
                className="w-full bg-[#145a32] border border-green-700 rounded-lg px-4 py-3
                           text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37]"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={joining} className="btn-gold w-full py-3">
                {joining ? t.lobby.joining : t.lobby.joinButton}
              </button>
            </form>
          </div>
        )}

        <div className="card-casino mb-4">
          <p className="text-[#d4af37] font-semibold mb-3">{t.lobby.playersCount.replace('{{count}}', String(players.length))}</p>
          {players.length === 0 ? (
            <p className="text-green-600 text-sm text-center py-2">{t.lobby.waitingForPlayers}</p>
          ) : (
            <ul className="space-y-2">
              {players.map((p) => (
                <li key={p.id} className="flex items-center justify-between bg-[#145a32] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{p.name}</span>
                    {p.id === myPlayerId && <span className="text-xs text-green-400">{t.common.you}</span>}
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
            <button
              onClick={() => { localStorage.setItem('currentRoomCode', roomCode); router.push(`/game/__placeholder__/chips?room=${roomCode}`); }}
              className="w-full py-3 rounded-lg border border-green-700 text-green-300
                         hover:border-[#d4af37] hover:text-[#d4af37] transition-colors text-sm"
            >
              {t.lobby.manageChips}
            </button>
            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              className="btn-gold w-full text-lg py-4"
            >
              {players.length < 2 ? t.lobby.needMorePlayers : t.lobby.startGame}
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
