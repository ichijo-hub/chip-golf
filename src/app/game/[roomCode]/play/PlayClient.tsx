'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  doc, getDoc, collection, getDocs, addDoc, updateDoc,
  onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor,
  useSensor, useSensors, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { db } from '@/lib/firebase/client';
import { Game, Player, ChipDefinition, ChipState, GameEvent } from '@/types';
import { calculateScores } from '@/lib/scoring';
import ChipBadge from '@/components/ChipBadge';
import Logo from '@/components/Logo';
import { useT } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';
import { chipNamesEn, chipConditionsEn } from '@/lib/i18n/chipNames';

interface ChipSelection {
  chipState: ChipState;
  chipDef: ChipDefinition;
}

export default function PlayClient() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();

  const { t, locale } = useT();
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
  const [dragActiveChip, setDragActiveChip] = useState<ChipSelection | null>(null);
  const dragOccurredRef = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
  );

  const loadData = useCallback(async () => {
    const gameSnap = await getDoc(doc(db, 'games', roomCode));
    if (!gameSnap.exists()) {
      setError(t.play.gameNotFound);
      setLoading(false);
      return;
    }
    const typedGame = { id: gameSnap.id, ...gameSnap.data() } as Game;
    setGame(typedGame);

    if (typedGame.status === 'finished') {
      router.push(`/game/${roomCode}/result`);
      return;
    }

    const [playersSnap, chipDefsSnap, eventsSnap] = await Promise.all([
      getDocs(query(collection(db, 'games', roomCode, 'players'), orderBy('display_order'))),
      getDocs(query(collection(db, 'games', roomCode, 'chip_definitions'), orderBy('sort_order'))),
      getDocs(query(collection(db, 'games', roomCode, 'game_events'), orderBy('created_at', 'desc'), limit(30))),
    ]);

    setPlayers(playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
    setChipDefs(chipDefsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChipDefinition)).filter(c => c.is_active !== false));
    setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as GameEvent)));
    setLoading(false);
  }, [roomCode, router]);

  useEffect(() => {
    const savedId = localStorage.getItem(`player_${roomCode}`);
    if (savedId) setMyPlayerId(savedId);
    loadData();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [roomCode, loadData]);

  useEffect(() => {
    const unsubChips = onSnapshot(collection(db, 'games', roomCode, 'chip_states'), (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'modified' || change.type === 'added') {
          const changedId = change.doc.id;
          setFlashCounts(prev => ({ ...prev, [changedId]: (prev[changedId] ?? 0) + 1 }));
        }
      });
      setChipStates(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChipState)));
    });

    const unsubEvents = onSnapshot(
      query(collection(db, 'games', roomCode, 'game_events'), orderBy('created_at', 'desc'), limit(30)),
      (snap) => {
        setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as GameEvent)));
      }
    );

    const unsubGame = onSnapshot(doc(db, 'games', roomCode), (snap) => {
      if (!snap.exists()) return;
      const updated = { id: snap.id, ...snap.data() } as Game;
      setGame(updated);
      if (updated.status === 'finished') router.push(`/game/${roomCode}/result`);
    });

    return () => { unsubChips(); unsubEvents(); unsubGame(); };
  }, [roomCode, router]);

  // ---- transfer logic ----

  async function doTransfer(chipState: ChipState, chipDef: ChipDefinition, toPlayerId: string | null) {
    const fromPlayerId = chipState.holder_player_id;
    const movedId = chipState.id;

    setFlashCounts(prev => ({ ...prev, [movedId]: (prev[movedId] ?? 0) + 1 }));

    await updateDoc(doc(db, 'games', roomCode, 'chip_states', movedId), {
      holder_player_id: toPlayerId,
      updated_at: new Date().toISOString(),
    });

    const fromName = players.find(p => p.id === fromPlayerId)?.name ?? '場';
    const toName = toPlayerId ? (players.find(p => p.id === toPlayerId)?.name ?? '') : '場';
    const description = `${chipDef.name}: ${fromName} → ${toName}`;

    await addDoc(collection(db, 'games', roomCode, 'game_events'), {
      id: '', game_id: roomCode,
      chip_state_id: movedId,
      chip_definition_id: chipDef.id,
      from_player_id: fromPlayerId,
      to_player_id: toPlayerId,
      hole_number: null,
      description,
      created_at: new Date().toISOString(),
    });
  }

  async function transferChip(toPlayerId: string | null) {
    if (!selected || !game) return;
    const snap = { ...selected };
    setSelected(null);
    await doTransfer(snap.chipState, snap.chipDef, toPlayerId);
  }

  // ---- drag & drop handlers ----

  function handleDragStart(event: DragStartEvent) {
    setDragActiveChip(event.active.data.current as ChipSelection);
  }

  async function handleDragEnd(event: DragEndEvent) {
    // flag so onClick on chips doesn't open modal immediately after a drag
    dragOccurredRef.current = true;
    setTimeout(() => { dragOccurredRef.current = false; }, 100);

    const drag = dragActiveChip;
    setDragActiveChip(null);
    if (!drag || !event.over) return;

    const toPlayerId = event.over.id === 'field' ? null : String(event.over.id);
    if (toPlayerId === drag.chipState.holder_player_id) return; // same zone → no-op

    await doTransfer(drag.chipState, drag.chipDef, toPlayerId);
  }

  // ---- render ----

  async function endGame() {
    if (!game) return;
    if (!confirm(t.play.confirmEndGame)) return;
    await updateDoc(doc(db, 'games', roomCode), { status: 'finished' });
    router.push(`/game/${roomCode}/result`);
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-green-400">{t.common.loading}</p></main>;
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <button onClick={() => router.push('/')} className="btn-gold px-6 py-2">{t.common.backToTop}</button>
      </main>
    );
  }

  const isHost = myPlayerId === game?.host_player_id;
  const isDragging = !!dragActiveChip;

  const fieldChips = chipStates
    .filter(cs => cs.holder_player_id === null)
    .sort((a, b) => {
      const defA = chipDefs.find(d => d.id === a.chip_definition_id);
      const defB = chipDefs.find(d => d.id === b.chip_definition_id);
      const typeOrder = (d: ChipDefinition | undefined) => d?.chip_type === 'positive' ? 0 : 1;
      if (typeOrder(defA) !== typeOrder(defB)) return typeOrder(defA) - typeOrder(defB);
      return (defB?.point_value ?? 0) - (defA?.point_value ?? 0);
    });
  const scores = game ? calculateScores(players, chipStates, chipDefs) : [];

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* タップ → モーダル */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4" onClick={() => setSelected(null)}>
          <div className="card-casino w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <ChipBadge
                  name={selected.chipDef.name}
                  chipType={selected.chipDef.chip_type}
                  imageUrl={selected.chipDef.image_url}
                  imageScale={selected.chipDef.image_scale ?? undefined}
                  imageOffsetY={selected.chipDef.image_offset_y ?? undefined}
                  pointValue={selected.chipDef.point_value}
                  size={120}
                  showLabel={false}
                />
                <div>
                  <p className="text-[#d4af37] font-bold text-xl">{locale === 'en' ? (chipNamesEn[selected.chipDef.name] ?? selected.chipDef.name) : selected.chipDef.name}</p>
                  <p className={`text-base font-medium ${selected.chipDef.chip_type === 'positive' ? 'text-green-400' : 'text-red-400'}`}>
                    {selected.chipDef.chip_type === 'positive' ? `+${selected.chipDef.point_value} ${t.common.positive}` : `-${selected.chipDef.point_value} ${t.common.negative}`}
                  </p>
                  {selected.chipDef.condition && (
                    <p className="text-green-600 text-sm mt-1">
                      {locale === 'en' ? (chipConditionsEn[selected.chipDef.condition] ?? selected.chipDef.condition) : selected.chipDef.condition}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-green-400 text-3xl leading-none self-start">✕</button>
            </div>
            <p className="text-green-300 text-base mb-3">{t.play.selectDestination}</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {players.map(p => (
                <button
                  key={p.id}
                  onClick={() => transferChip(p.id)}
                  disabled={p.id === selected.chipState.holder_player_id}
                  className={`w-full py-3 px-4 rounded-lg text-left font-medium text-lg transition-colors
                    ${p.id === selected.chipState.holder_player_id
                      ? 'bg-[#145a32] text-green-700 cursor-not-allowed'
                      : 'bg-green-800 hover:bg-green-700 active:bg-green-600 text-white'
                    }`}
                >
                  {p.name}
                  {p.id === myPlayerId && <span className="text-green-400 text-base ml-1">{t.common.you}</span>}
                  {p.id === selected.chipState.holder_player_id && <span className="text-green-600 text-base ml-1">{t.play.current}</span>}
                </button>
              ))}
              {selected.chipState.holder_player_id !== null && (
                <button
                  onClick={() => transferChip(null)}
                  className="w-full py-3 px-4 rounded-lg text-left font-medium text-lg border
                             bg-[#145a32] border-green-700 hover:border-[#d4af37] text-green-300 transition-colors"
                >
                  {t.play.returnToField}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen pb-24">
        <div className="sticky top-0 bg-[#145a32] border-b border-green-800 px-3 py-2 z-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <button onClick={() => router.push('/')}><Logo size="sm" /></button>
            <div className="flex items-center gap-2">
              <LangToggle />
              <p className="text-[#d4af37] font-bold text-xs">Room:{roomCode}</p>
              {isHost && (
                <button
                  onClick={endGame}
                  className="text-xs bg-red-900 hover:bg-red-800 text-red-200 px-2 py-1 rounded-lg border border-red-700"
                >
                  {t.play.endGame}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 space-y-3 max-w-md mx-auto">
          {/* 場のチップ */}
          <DroppableZone id="field" active={isDragging}>
            <div className="card-casino !p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[#d4af37] font-semibold text-lg">{t.play.fieldChips}</p>
                {isHost && (
                  <button
                    onClick={() => router.push(`/game/${roomCode}/chips`)}
                    className="text-xs bg-[#1a7a43] hover:bg-green-700 text-green-200 px-2 py-1 rounded-lg border border-green-600"
                  >
                    {t.play.manageChips}
                  </button>
                )}
              </div>
              {fieldChips.length === 0 ? (
                <p className="text-green-700 text-base text-center py-1">{t.play.allDistributed}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {fieldChips.map(cs => {
                    const def = chipDefs.find(d => d.id === cs.chip_definition_id);
                    if (!def) return null;
                    return (
                      <DraggableChip key={`${cs.id}-${flashCounts[cs.id] ?? 0}`} id={cs.id} data={{ chipState: cs, chipDef: def }} onTap={() => setSelected({ chipState: cs, chipDef: def })}>
                        <ChipBadge
                          name={def.name}
                          chipType={def.chip_type}
                          imageUrl={def.image_url}
                          imageScale={def.image_scale ?? undefined}
                          imageOffsetY={def.image_offset_y ?? undefined}
                          pointValue={def.point_value}
                          size={64}
                          flash={(flashCounts[cs.id] ?? 0) > 0}
                        />
                      </DraggableChip>
                    );
                  })}
                </div>
              )}
            </div>
          </DroppableZone>

          {/* プレイヤーパネル */}
          {scores.map(({ player, positivePoints, negativePoints, netScore, chips }) => (
            <DroppableZone key={player.id} id={player.id} active={isDragging}>
              <div className="card-casino !p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white font-semibold text-lg">{player.name}</span>
                    {player.id === myPlayerId && <span className="text-base text-green-400">{t.common.you}</span>}
                    {player.is_host && (
                      <span className="text-base bg-[#d4af37] text-[#1a1a1a] px-1.5 py-0.5 rounded font-semibold">{t.common.host}</span>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className={`font-bold text-2xl ${netScore > 0 ? 'text-[#d4af37]' : netScore < 0 ? 'text-red-400' : 'text-white'}`}>
                      {netScore > 0 ? `+${netScore}` : netScore}
                    </span>
                    <p className="text-green-600 text-base">+{positivePoints} / -{negativePoints}</p>
                  </div>
                </div>
                {chips.length === 0 ? (
                  <p className="text-green-800 text-base">{t.common.noChips}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {chips.map(chipDef => {
                      const cs = chipStates.find(s => s.chip_definition_id === chipDef.id && s.holder_player_id === player.id);
                      if (!cs) return null;
                      return (
                        <DraggableChip key={`${cs.id}-${flashCounts[cs.id] ?? 0}`} id={cs.id} data={{ chipState: cs, chipDef }} onTap={() => setSelected({ chipState: cs, chipDef })}>
                          <ChipBadge
                            name={chipDef.name}
                            chipType={chipDef.chip_type}
                            imageUrl={chipDef.image_url}
                            imageScale={chipDef.image_scale ?? undefined}
                            imageOffsetY={chipDef.image_offset_y ?? undefined}
                            pointValue={chipDef.point_value}
                            size={64}
                            flash={(flashCounts[cs.id] ?? 0) > 0}
                            onClick={() => { if (!dragOccurredRef.current) setSelected({ chipState: cs, chipDef }); }}
                          />
                        </DraggableChip>
                      );
                    })}
                  </div>
                )}
              </div>
            </DroppableZone>
          ))}

          {/* イベントログ */}
          <div className="card-casino !p-3">
            <button
              type="button"
              onClick={() => setShowLog(v => !v)}
              className="w-full flex items-center justify-between text-[#d4af37] font-semibold text-lg"
            >
              <span>{t.play.eventLog.replace('{{count}}', String(events.length))}</span>
              <span className="text-green-500 text-base">{showLog ? t.play.closeLog : t.play.openLog}</span>
            </button>
            {showLog && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {events.length === 0 ? (
                  <p className="text-green-700 text-lg text-center py-2">{t.play.noEvents}</p>
                ) : (
                  events.map((ev) => {
                    const chipDef = chipDefs.find(d => d.id === ev.chip_definition_id);
                    const chipName = chipDef
                      ? (locale === 'en' ? (chipNamesEn[chipDef.name] ?? chipDef.name) : chipDef.name)
                      : (ev.description?.split(':')[0] ?? '');
                    const fromName = ev.from_player_id
                      ? (players.find(p => p.id === ev.from_player_id)?.name ?? t.play.field)
                      : t.play.field;
                    const toName = ev.to_player_id
                      ? (players.find(p => p.id === ev.to_player_id)?.name ?? t.play.field)
                      : t.play.field;
                    const label = chipDef
                      ? `${chipName}: ${fromName} → ${toName}`
                      : (ev.description ?? '');
                    return (
                      <div key={ev.id} className="text-base text-green-300 bg-[#145a32] rounded px-3 py-1.5">
                        {label}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ドラッグ中のフローティングチップ */}
      <DragOverlay dropAnimation={null}>
        {dragActiveChip && (
          <div style={{ filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.6))', opacity: 0.9, cursor: 'grabbing' }}>
            <ChipBadge
              name={dragActiveChip.chipDef.name}
              chipType={dragActiveChip.chipDef.chip_type}
              imageUrl={dragActiveChip.chipDef.image_url}
              imageScale={dragActiveChip.chipDef.image_scale ?? undefined}
              imageOffsetY={dragActiveChip.chipDef.image_offset_y ?? undefined}
              pointValue={dragActiveChip.chipDef.point_value}
              size={80}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ---- inner components ----

function DraggableChip({
  id, data, children, onTap,
}: {
  id: string;
  data: ChipSelection;
  children: React.ReactNode;
  onTap?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const tapStart = useRef({ time: 0, x: 0, y: 0 });
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap; // 毎レンダーで最新を維持、effectは再実行しない

  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const handleTouchStart = (e: TouchEvent) => {
      tapStart.current = { time: Date.now(), x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!onTapRef.current) return;
      const { time, x, y } = tapStart.current;
      const t = e.changedTouches[0];
      const dist = Math.hypot(t.clientX - x, t.clientY - y);
      if (Date.now() - time < 400 && dist < 8) onTapRef.current();
    };
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []); // マウント時のみ登録、onTapはrefで参照

  const setRef = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  return (
    <div
      ref={setRef}
      {...attributes}
      {...listeners}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => onTapRef.current?.()}
      style={{ opacity: isDragging ? 0.25 : 1, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function DroppableZone({
  id, children, active,
}: {
  id: string;
  children: React.ReactNode;
  active: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl transition-all duration-150 ${active && isOver ? 'ring-2 ring-[#d4af37]' : ''}`}
    >
      {children}
    </div>
  );
}
