'use client';

import { useEffect, useReducer, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor,
  useSensor, useSensors, useDraggable, useDroppable,
  MeasuringStrategy,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { ChipDefinition, ChipState } from '@/types';
import { DemoState } from '@/lib/demo/initDemoState';
import { demoReducer } from '@/lib/demo/demoReducer';
import { decideCpuAction } from '@/lib/demo/cpuPlayer';
import { calculateScores } from '@/lib/scoring';
import ChipBadge from '@/components/ChipBadge';
import Logo from '@/components/Logo';

interface ChipSelection {
  chipState: ChipState;
  chipDef: ChipDefinition;
}

function loadDemoState(): DemoState | null {
  const raw = sessionStorage.getItem('demoState');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoState;
  } catch {
    return null;
  }
}

export default function DemoPlayClient() {
  const router = useRouter();

  const [state, dispatch] = useReducer(demoReducer, undefined, () => {
    const s = loadDemoState();
    if (!s) {
      // ダミー初期値（直後にリダイレクト）
      return {
        players: [], chipDefs: [], chipStates: [], events: [],
        myPlayerId: '', cpuPlayerIds: [], currentHole: 1, totalHoles: 9,
        status: 'playing',
      } as DemoState;
    }
    return s;
  });

  const [initialized, setInitialized] = useState(false);
  const [selected, setSelected] = useState<ChipSelection | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [cpuThinking, setCpuThinking] = useState(false);
  const [flashCounts, setFlashCounts] = useState<Record<string, number>>({});
  const [dragActiveChip, setDragActiveChip] = useState<ChipSelection | null>(null);
  const dragOccurredRef = useRef(false);
  const cpuThinkingRef = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    const raw = sessionStorage.getItem('demoState');
    if (!raw) {
      router.push('/demo');
      return;
    }
    setInitialized(true);
  }, [router]);

  // stateをsessionStorageに同期
  useEffect(() => {
    if (initialized && state) {
      sessionStorage.setItem('demoState', JSON.stringify(state));
    }
  }, [state, initialized]);

  // ゲーム終了時に結果画面へ
  useEffect(() => {
    if (initialized && state?.status === 'finished') {
      router.push('/demo/result');
    }
  }, [state?.status, initialized, router]);

  // 最新stateをrefで追跡
  const stateRef = useRef(state);
  stateRef.current = state;

  function flashChip(chipStateId: string) {
    setFlashCounts(prev => ({ ...prev, [chipStateId]: (prev[chipStateId] ?? 0) + 1 }));
  }

  function doTransfer(chipState: ChipState, chipDef: ChipDefinition, toPlayerId: string | null) {
    flashChip(chipState.id);
    dispatch({ type: 'TRANSFER_CHIP', chipStateId: chipState.id, toPlayerId });

    if (!cpuThinkingRef.current) {
      setTimeout(() => runCpuTurns(), 50);
    }
  }

  function runCpuTurns() {
    if (cpuThinkingRef.current) return;
    cpuThinkingRef.current = true;
    setCpuThinking(true);

    const cpuIds = [...stateRef.current.cpuPlayerIds];
    let idx = 0;

    function next() {
      if (idx >= cpuIds.length) {
        cpuThinkingRef.current = false;
        setCpuThinking(false);
        return;
      }
      const cpuId = cpuIds[idx];
      idx++;
      const current = stateRef.current;
      const action = decideCpuAction(cpuId, current.chipStates, current.chipDefs, current.players);
      if (action) {
        flashChip(action.chipStateId);
        dispatch({ type: 'TRANSFER_CHIP', chipStateId: action.chipStateId, toPlayerId: action.toPlayerId });
      }
      setTimeout(next, 700);
    }

    setTimeout(next, 1200);
  }

  function transferChip(toPlayerId: string | null) {
    if (!selected || cpuThinking) return;
    const snap = { ...selected };
    setSelected(null);
    doTransfer(snap.chipState, snap.chipDef, toPlayerId);
  }

  function handleDragStart(event: DragStartEvent) {
    setDragActiveChip(event.active.data.current as ChipSelection);
  }

  function handleDragEnd(event: DragEndEvent) {
    dragOccurredRef.current = true;
    setTimeout(() => { dragOccurredRef.current = false; }, 100);
    const drag = dragActiveChip;
    setDragActiveChip(null);
    if (!drag || !event.over || cpuThinking) return;
    const toPlayerId = event.over.id === 'field' ? null : String(event.over.id);
    if (toPlayerId === drag.chipState.holder_player_id) return;
    doTransfer(drag.chipState, drag.chipDef, toPlayerId);
  }

  function handleEndGame() {
    if (!confirm('ゲームを終了しますか？')) return;
    dispatch({ type: 'END_GAME' });
  }

  if (!initialized) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-green-400">読み込み中...</p></main>;
  }

  const { players, chipDefs, chipStates, events, myPlayerId, cpuPlayerIds } = state;

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
  const scores = calculateScores(players, chipStates, chipDefs);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      autoScroll={false}
    >
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
                  <p className="text-[#d4af37] font-bold text-xl">{selected.chipDef.name}</p>
                  <p className={`text-base font-medium ${selected.chipDef.chip_type === 'positive' ? 'text-green-400' : 'text-red-400'}`}>
                    {selected.chipDef.chip_type === 'positive'
                      ? `+${selected.chipDef.point_value} ポジティブ`
                      : `-${selected.chipDef.point_value} ネガティブ`}
                  </p>
                  {selected.chipDef.condition && (
                    <p className="text-green-600 text-sm mt-1">{selected.chipDef.condition}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-green-400 text-3xl leading-none self-start">✕</button>
            </div>
            <p className="text-green-300 text-base mb-3">移動先を選択</p>
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
                  {p.id === myPlayerId && <span className="text-green-400 text-base ml-1">（あなた）</span>}
                  {p.id === selected.chipState.holder_player_id && <span className="text-green-600 text-base ml-1">現在</span>}
                </button>
              ))}
              {selected.chipState.holder_player_id !== null && (
                <button
                  onClick={() => transferChip(null)}
                  className="w-full py-3 px-4 rounded-lg text-left font-medium text-lg border
                             bg-[#145a32] border-green-700 hover:border-[#d4af37] text-green-300 transition-colors"
                >
                  場に戻す
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CPU操作中インジケーター */}
      {cpuThinking && (
        <div className="fixed inset-0 bg-black/20 z-40 flex items-start justify-center pointer-events-none" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 80px)' }}>
          <div className="bg-[#145a32] border border-green-700 rounded-xl px-6 py-3 text-green-300 text-sm shadow-xl">
            CPUが考え中...
          </div>
        </div>
      )}

      <main className="min-h-screen pb-24">
        {/* ヘッダー */}
        <div className="sticky top-0 bg-[#145a32] border-b border-green-800 px-3 z-10" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: '8px' }}>
          <div className="max-w-md mx-auto flex items-center justify-between">
            <button onClick={() => router.push('/')}><Logo size="sm" /></button>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded-full border border-green-700 font-medium">
                🎮 デモ
              </span>
              <button
                onClick={handleEndGame}
                disabled={cpuThinking}
                className="text-xs bg-red-900 hover:bg-red-800 text-red-200 px-2 py-1 rounded-lg border border-red-700 disabled:opacity-50 transition-colors"
              >
                終了
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 space-y-3 max-w-md mx-auto">
          {/* 場のチップ */}
          <DroppableZone id="field" active={isDragging && !cpuThinking}>
            <div className="card-casino !p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[#d4af37] font-semibold text-lg">場のチップ</p>
              </div>
              {fieldChips.length === 0 ? (
                <p className="text-green-700 text-base text-center py-1">すべて配布済み</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {fieldChips.map(cs => {
                    const def = chipDefs.find(d => d.id === cs.chip_definition_id);
                    if (!def) return null;
                    return (
                      <DraggableChip
                        key={`${cs.id}-${flashCounts[cs.id] ?? 0}`}
                        id={cs.id}
                        data={{ chipState: cs, chipDef: def }}
                        disabled={cpuThinking}
                        onTap={() => { if (!cpuThinking) setSelected({ chipState: cs, chipDef: def }); }}
                      >
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
            <DroppableZone key={player.id} id={player.id} active={isDragging && !cpuThinking}>
              <div className="card-casino !p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white font-semibold text-lg">{player.name}</span>
                    {player.id === myPlayerId && <span className="text-base text-green-400">（あなた）</span>}
                    {player.is_host && (
                      <span className="text-xs bg-[#d4af37] text-[#1a1a1a] px-1.5 py-0.5 rounded font-semibold">HOST</span>
                    )}
                    {cpuPlayerIds.includes(player.id) && (
                      <span className="text-xs bg-green-900 text-green-400 px-1.5 py-0.5 rounded border border-green-700">CPU</span>
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
                  <p className="text-green-800 text-base">チップなし</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {chips.map(chipDef => {
                      const cs = chipStates.find(s => s.chip_definition_id === chipDef.id && s.holder_player_id === player.id);
                      if (!cs) return null;
                      return (
                        <DraggableChip
                          key={`${cs.id}-${flashCounts[cs.id] ?? 0}`}
                          id={cs.id}
                          data={{ chipState: cs, chipDef }}
                          disabled={cpuThinking}
                          onTap={() => { if (!cpuThinking) setSelected({ chipState: cs, chipDef }); }}
                        >
                          <ChipBadge
                            name={chipDef.name}
                            chipType={chipDef.chip_type}
                            imageUrl={chipDef.image_url}
                            imageScale={chipDef.image_scale ?? undefined}
                            imageOffsetY={chipDef.image_offset_y ?? undefined}
                            pointValue={chipDef.point_value}
                            size={64}
                            flash={(flashCounts[cs.id] ?? 0) > 0}
                            onClick={() => { if (!dragOccurredRef.current && !cpuThinking) setSelected({ chipState: cs, chipDef }); }}
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
              <span>イベントログ（{events.length}件）</span>
              <span className="text-green-500 text-base">{showLog ? '▲ 閉じる' : '▼ 開く'}</span>
            </button>
            {showLog && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {events.length === 0 ? (
                  <p className="text-green-700 text-lg text-center py-2">まだ操作なし</p>
                ) : (
                  events.map((ev) => (
                    <div key={ev.id} className="text-base text-green-300 bg-[#145a32] rounded px-3 py-1.5">
                      {ev.description}
                    </div>
                  ))
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
  id, data, children, onTap, disabled,
}: {
  id: string;
  data: ChipSelection;
  children: React.ReactNode;
  onTap?: () => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const tapStart = useRef({ time: 0, x: 0, y: 0 });
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

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
  }, []);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  return (
    <div
      ref={setRef}
      {...attributes}
      {...(disabled ? {} : listeners)}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => !disabled && onTapRef.current?.()}
      style={{
        opacity: isDragging ? 0.25 : disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      } as React.CSSProperties}
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
