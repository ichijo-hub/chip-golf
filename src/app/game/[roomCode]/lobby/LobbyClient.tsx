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

export default function LobbyClient() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();

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
    const gameSnap = await getDoc(doc(db, 'games', roomCode));
    if (!gameSnap.exists()) {
      setError('ゲームが見つかりません。ルームコードを確認してください。');
      setLoading(false);
      return;
    }
    const typedGame = { id: gameSnap.id, ...gameSnap.data() } as Game;
    setGame(typedGame);

    const playersSnap = await getDocs(query(collection(db, 'games', roomCode, 'players'), orderBy('display_order')));
    setPlayers(playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
    setLoading(false);

    if (typedGame.status === 'playing') router.push(`/game/${roomCode}/play`);
    else if (typedGame.status === 'finished') router.push(`/game/${roomCode}/result`);
  }, [roomCode, router]);

  useEffect(() => {
    setLobbyUrl(`${window.location.origin}/game/${roomCode}/lobby`);
    const savedId = localStorage.getItem(`player_${roomCode}`);
    if (savedId) setMyPlayerId(savedId);
    loadGame();
  }, [roomCode, loadGame]);

  useEffect(() => {
    // Realtime: game status changes
    const unsubGame = onSnapshot(doc(db, 'games', roomCode), (snap) => {
      if (!snap.exists()) return;
      const updated = { id: snap.id, ...snap.data() } as Game;
      setGame(updated);
      if (updated.status === 'playing') router.push(`/game/${roomCode}/play`);
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
      setError(`参加に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    } finally {
      setJoining(false);
    }
  }

  async function handleStartGame() {
    await updateDoc(doc(db, 'games', roomCode), { status: 'playing' });
    router.push(`/game/${roomCode}/play`);
  }

  async function handleDeleteGame() {
    if (!confirm('このゲームを削除しますか？参加者全員のゲームが終了します。')) return;
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
        <p className="text-green-400">読み込み中...</p>
      </main>
    );
  }

  if (error && !game) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-400 text-center">{error}</p>
        <button onClick={() => router.push('/')} className="btn-gold px-6 py-2">トップに戻る</button>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <button onClick={() => router.push('/')} className="text-green-400 hover:text-[#d4af37] transition-colors">
            ← トップ
          </button>
          <h1 className="text-2xl font-bold text-[#d4af37]">待機ルーム</h1>
        </div>

        <div className="card-casino text-center mb-4">
          <p className="text-green-400 text-sm mb-2">ルームコード</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-mono font-bold text-[#d4af37] tracking-widest">
              {roomCode}
            </span>
            <button onClick={copyRoomCode} className="text-green-400 hover:text-[#d4af37] transition-colors text-sm">
              {copied ? '✓ コピー済み' : 'コピー'}
            </button>
          </div>
        </div>

        {lobbyUrl && (
          <div className="card-casino flex flex-col items-center mb-4">
            <p className="text-green-400 text-sm mb-3">QRコードで参加</p>
            <div className="bg-white p-3 rounded-lg">
              <QRCodeSVG value={lobbyUrl} size={160} />
            </div>
          </div>
        )}

        {!isJoined && (
          <div className="card-casino mb-4">
            <p className="text-[#d4af37] font-semibold mb-3">ゲームに参加する</p>
            <form onSubmit={handleJoin} className="space-y-3">
              <input
                type="text" value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="あなたの名前" maxLength={20}
                className="w-full bg-[#145a32] border border-green-700 rounded-lg px-4 py-3
                           text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37]"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={joining} className="btn-gold w-full py-3">
                {joining ? '参加中...' : '参加する'}
              </button>
            </form>
          </div>
        )}

        <div className="card-casino mb-4">
          <p className="text-[#d4af37] font-semibold mb-3">参加者 ({players.length}人)</p>
          {players.length === 0 ? (
            <p className="text-green-600 text-sm text-center py-2">参加者を待っています...</p>
          ) : (
            <ul className="space-y-2">
              {players.map((p) => (
                <li key={p.id} className="flex items-center justify-between bg-[#145a32] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{p.name}</span>
                    {p.id === myPlayerId && <span className="text-xs text-green-400">（あなた）</span>}
                  </div>
                  {p.is_host && (
                    <span className="text-xs bg-[#d4af37] text-[#1a1a1a] px-2 py-0.5 rounded font-semibold">ホスト</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {isHost && isJoined && (
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/game/${roomCode}/chips`)}
              className="w-full py-3 rounded-lg border border-green-700 text-green-300
                         hover:border-[#d4af37] hover:text-[#d4af37] transition-colors text-sm"
            >
              チップを管理・編集
            </button>
            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              className="btn-gold w-full text-lg py-4"
            >
              {players.length < 2 ? 'あと1人以上参加が必要です' : 'ゲームを開始する'}
            </button>
            <button
              onClick={handleDeleteGame}
              className="w-full py-3 rounded-lg border border-red-800 text-red-500
                         hover:border-red-600 hover:text-red-400 transition-colors text-sm"
            >
              ゲームを削除する
            </button>
          </div>
        )}

        {isJoined && !isHost && (
          <p className="text-center text-green-500 text-sm">
            ホストがゲームを開始するまでお待ちください...
          </p>
        )}
      </div>
    </main>
  );
}
