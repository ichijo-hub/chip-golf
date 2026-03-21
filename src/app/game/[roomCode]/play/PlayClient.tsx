'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Game, Player, ChipDefinition, ChipState, GameEvent } from '@/types';
import { calculateScores } from '@/lib/scoring';
import ChipBadge from '@/components/ChipBadge';

interface ChipSelection {
  chipState: ChipState;
  chipDef: ChipDefinition;
}

export default function PlayClient() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();
  const supabase = useRef(createClient()).current;

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [chipDefs, setChipDefs] = useState<ChipDefinition[]>([]);
  const [chipStates, setChipStates] = useState<ChipState[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChipSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLog, setShowLog] = useState(false);
  const [flashCounts, setFlashCounts] = useState<Record<string, number>>({});
  const [notifStatus, setNotifStatus] = useState<'default' | 'granted' | 'denied'>('default');

  const loadData = useCallback(async () => {
    const { data: gameData } = await supabase
      .from('games').select('*').eq('room_code', roomCode).single();

    if (!gameData) {
      setError('ゲームが見つかりません');
      setLoading(false);
      return;
    }

    const typedGame = gameData as Game;
    setGame(typedGame);

    if (typedGame.status === 'finished') {
      router.push(`/game/${roomCode}/result`);
      return;
    }

    const [
      { data: playersData },
      { data: chipDefsData },
      { data: chipStatesData },
      { data: eventsData },
    ] = await Promise.all([
      supabase.from('players').select('*').eq('game_id', typedGame.id).order('display_order'),
      supabase.from('chip_definitions').select('*').eq('game_id', typedGame.id).eq('is_active', true).order('sort_order'),
      supabase.from('chip_states').select('*').eq('game_id', typedGame.id),
      supabase.from('game_events').select('*').eq('game_id', typedGame.id).order('created_at', { ascending: false }).limit(30),
    ]);

    setPlayers((playersData ?? []) as Player[]);
    setChipDefs((chipDefsData ?? []) as ChipDefinition[]);
    setChipStates((chipStatesData ?? []) as ChipState[]);
    setEvents((eventsData ?? []) as GameEvent[]);
    setLoading(false);
  }, [roomCode, router, supabase]);

  useEffect(() => {
    const savedId = localStorage.getItem(`player_${roomCode}`);
    if (savedId) setMyPlayerId(savedId);
    loadData();
    if ('Notification' in window) {
      setNotifStatus(Notification.permission as 'default' | 'granted' | 'denied');
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [roomCode, loadData]);

  async function subscribePush(gameId: string, playerId: string) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, playerId, subscription: sub.toJSON() }),
    });
  }

  async function requestNotification(gameId: string, playerId: string) {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotifStatus(permission as 'default' | 'granted' | 'denied');
    if (permission === 'granted') {
      await subscribePush(gameId, playerId);
    }
  }

  useEffect(() => {
    if (!game || !myPlayerId) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      subscribePush(game.id, myPlayerId);
    }
  }, [game?.id, myPlayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!game) return;

    const channel = supabase
      .channel(`play:${game.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'chip_states',
        filter: `game_id=eq.${game.id}`,
      }, (payload) => {
        // 変更されたチップをフラッシュ
        if (payload.new && 'id' in payload.new) {
          const changedId = (payload.new as ChipState).id;
          setFlashCounts((prev) => ({ ...prev, [changedId]: (prev[changedId] ?? 0) + 1 }));
        }
        loadData();
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'game_events',
        filter: `game_id=eq.${game.id}`,
      }, () => loadData())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'games',
        filter: `id=eq.${game.id}`,
      }, (payload) => {
        const updated = payload.new as Game;
        setGame(updated);
        if (updated.status === 'finished') {
          router.push(`/game/${roomCode}/result`);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function transferChip(toPlayerId: string | null) {
    if (!selected || !game) return;

    const fromPlayerId = selected.chipState.holder_player_id;
    const movedId = selected.chipState.id;

    setSelected(null);

    await supabase
      .from('chip_states')
      .update({ holder_player_id: toPlayerId, updated_at: new Date().toISOString() })
      .eq('id', movedId);

    // ローカルプレイヤーのフラッシュを即時適用
    setFlashCounts((prev) => ({ ...prev, [movedId]: (prev[movedId] ?? 0) + 1 }));

    const fromName = players.find(p => p.id === fromPlayerId)?.name ?? '場';
    const toName = toPlayerId ? (players.find(p => p.id === toPlayerId)?.name ?? '') : '場';

    const description = `${selected.chipDef.name}: ${fromName} → ${toName}`;
    await supabase.from('game_events').insert({
      game_id: game.id,
      chip_state_id: movedId,
      from_player_id: fromPlayerId,
      to_player_id: toPlayerId,
      description,
    });

    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: game.id,
        senderPlayerId: myPlayerId,
        title: 'チップゴルフ',
        body: description,
      }),
    }).catch(() => {});

    loadData();
  }

  async function endGame() {
    if (!game) return;
    if (!confirm('ゲームを終了しますか？')) return;
    await supabase.from('games').update({ status: 'finished' }).eq('id', game.id);
    router.push(`/game/${roomCode}/result`);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-green-400">読み込み中...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <button onClick={() => router.push('/')} className="btn-gold px-6 py-2">トップに戻る</button>
      </main>
    );
  }

  const isHost = myPlayerId === game?.host_player_id;
  const fieldChips = chipStates.filter(cs => cs.holder_player_id === null);
  const scores = game ? calculateScores(players, chipStates, chipDefs) : [];

  return (
    <>
      {/* チップ移動モーダル */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div className="card-casino w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <ChipBadge
                  name={selected.chipDef.name}
                  chipType={selected.chipDef.chip_type}
                  imageUrl={selected.chipDef.image_url}
                  pointValue={selected.chipDef.point_value}
                  size={120}
                  showLabel={false}
                />
                <div>
                  <p className="text-[#d4af37] font-bold text-xl">{selected.chipDef.name}</p>
                  <p className={`text-base font-medium ${selected.chipDef.chip_type === 'positive' ? 'text-green-400' : 'text-red-400'}`}>
                    {selected.chipDef.chip_type === 'positive' ? `+${selected.chipDef.point_value} ポジティブ` : `-${selected.chipDef.point_value} ネガティブ`}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-green-400 text-3xl leading-none self-start">✕</button>
            </div>
            <p className="text-green-300 text-base mb-3">移動先を選択:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {players.map(p => (
                <button
                  key={p.id}
                  onClick={() => transferChip(p.id)}
                  disabled={p.id === selected.chipState.holder_player_id}
                  className={`w-full py-3 px-4 rounded-lg text-left font-medium text-lg transition-colors
                    ${p.id === selected.chipState.holder_player_id
                      ? 'bg-[#0a3d20] text-green-700 cursor-not-allowed'
                      : 'bg-green-800 hover:bg-green-700 active:bg-green-600 text-white'
                    }`}
                >
                  {p.name}
                  {p.id === myPlayerId && <span className="text-green-400 text-base ml-1">（あなた）</span>}
                  {p.id === selected.chipState.holder_player_id && <span className="text-green-600 text-base ml-1">（現在）</span>}
                </button>
              ))}
              {selected.chipState.holder_player_id !== null && (
                <button
                  onClick={() => transferChip(null)}
                  className="w-full py-3 px-4 rounded-lg text-left font-medium text-lg border
                             bg-[#0a3d20] border-green-700 hover:border-[#d4af37] text-green-300 transition-colors"
                >
                  場に戻す
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen pb-24">
        {/* ヘッダー */}
        <div className="sticky top-0 bg-[#0a3d20] border-b border-green-800 px-3 py-2 z-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <p className="text-[#d4af37] font-bold text-xl">{roomCode}</p>
            <div className="flex items-center gap-2">
              {myPlayerId && game && notifStatus !== 'granted' && notifStatus !== 'denied' && (
                <button
                  onClick={() => requestNotification(game.id, myPlayerId)}
                  className="text-sm bg-green-800 hover:bg-green-700 text-green-200
                             px-3 py-1.5 rounded-lg border border-green-600"
                >
                  🔔 通知ON
                </button>
              )}
            {isHost && (
              <button
                onClick={endGame}
                className="text-base bg-red-900 hover:bg-red-800 text-red-200
                           px-3 py-1.5 rounded-lg border border-red-700"
              >
                ゲーム終了
              </button>
            )}
            </div>
          </div>
        </div>

        <div className="p-3 space-y-3 max-w-md mx-auto">
          {/* 場のチップ */}
          <div className="card-casino !p-3">
            <p className="text-[#d4af37] font-semibold text-lg mb-2">
              場のチップ ({fieldChips.length})
            </p>
            {fieldChips.length === 0 ? (
              <p className="text-green-700 text-base text-center py-1">チップはすべて配られています</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {fieldChips.map(cs => {
                  const def = chipDefs.find(d => d.id === cs.chip_definition_id);
                  if (!def) return null;
                  return (
                    <ChipBadge
                      key={`${cs.id}-${flashCounts[cs.id] ?? 0}`}
                      name={def.name}
                      chipType={def.chip_type}
                      imageUrl={def.image_url}
                      pointValue={def.point_value}
                      size={64}
                      flash={(flashCounts[cs.id] ?? 0) > 0}
                      onClick={() => setSelected({ chipState: cs, chipDef: def })}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* プレイヤーごとのチップ */}
          {scores.map(({ player, positivePoints, negativePoints, netScore, chips }) => (
            <div key={player.id} className="card-casino !p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-white font-semibold text-lg">{player.name}</span>
                  {player.id === myPlayerId && (
                    <span className="text-base text-green-400">（あなた）</span>
                  )}
                  {player.is_host && (
                    <span className="text-base bg-[#d4af37] text-[#1a1a1a] px-1.5 py-0.5 rounded font-semibold">
                      ホスト
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className={`font-bold text-2xl
                    ${netScore > 0 ? 'text-[#d4af37]' : netScore < 0 ? 'text-red-400' : 'text-white'}`}>
                    {netScore > 0 ? `+${netScore}` : netScore}
                  </span>
                  <p className="text-green-600 text-base">+{positivePoints} / -{negativePoints}</p>
                </div>
              </div>
              {chips.length === 0 ? (
                <p className="text-green-800 text-base">チップなし</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {chips.map(chipDef => {
                    const cs = chipStates.find(
                      s => s.chip_definition_id === chipDef.id && s.holder_player_id === player.id
                    );
                    if (!cs) return null;
                    return (
                      <ChipBadge
                        key={`${cs.id}-${flashCounts[cs.id] ?? 0}`}
                        name={chipDef.name}
                        chipType={chipDef.chip_type}
                        imageUrl={chipDef.image_url}
                        pointValue={chipDef.point_value}
                        size={64}
                        flash={(flashCounts[cs.id] ?? 0) > 0}
                        onClick={() => setSelected({ chipState: cs, chipDef })}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* イベントログ */}
          <div className="card-casino !p-3">
            <button
              type="button"
              onClick={() => setShowLog(v => !v)}
              className="w-full flex items-center justify-between text-[#d4af37] font-semibold text-lg"
            >
              <span>📋 イベントログ ({events.length})</span>
              <span className="text-green-500 text-base">{showLog ? '▲ 閉じる' : '▼ 開く'}</span>
            </button>

            {showLog && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {events.length === 0 ? (
                  <p className="text-green-700 text-lg text-center py-2">まだ操作がありません</p>
                ) : (
                  events.map((ev) => (
                    <div key={ev.id} className="text-base text-green-300 bg-[#0a3d20] rounded px-3 py-1.5">
                      {ev.description}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
