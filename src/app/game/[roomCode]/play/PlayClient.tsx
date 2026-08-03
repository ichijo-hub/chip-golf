'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useRoomCode } from '@/hooks/useRoomCode';
import {
  doc, getDoc, collection, getDocs, addDoc, updateDoc, setDoc, deleteDoc,
  onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor,
  useSensor, useSensors, useDraggable, useDroppable,
  MeasuringStrategy,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { db } from '@/lib/firebase/client';
import { Game, Player, ChipDefinition, ChipState, GameEvent, OlympicEntry, OlympicHoleLog, SingleWinnerHoleLog, HoleMode } from '@/types';
import { calculateScores } from '@/lib/scoring';
import { calcOlympicTotals } from '@/lib/olympic';
import { calcSingleWinnerTotals } from '@/lib/singleWinner';
import OlympicModal from '@/components/OlympicModal';
import SingleWinnerModal from '@/components/SingleWinnerModal';
import ChipBadge from '@/components/ChipBadge';
import Logo from '@/components/Logo';
import { useT } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';
import { saveGameChipsToLibrary } from '@/lib/chipLibrary';
import { chipNamesEn, chipConditionsEn } from '@/lib/i18n/chipNames';
import { formatEventLabel, isChipTransferEvent, sideGameTypeOf } from '@/lib/eventLabel';

interface ChipSelection {
  chipState: ChipState;
  chipDef: ChipDefinition;
}

export default function PlayClient() {
  const router = useRouter();
  const roomCode = useRoomCode();

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
  const [olympicLogs, setOlympicLogs] = useState<OlympicHoleLog[]>([]);
  const [showOlympicModal, setShowOlympicModal] = useState(false);
  const [draconLogs, setDraconLogs] = useState<SingleWinnerHoleLog[]>([]);
  const [niapinLogs, setNiapinLogs] = useState<SingleWinnerHoleLog[]>([]);
  const [showDraconModal, setShowDraconModal] = useState(false);
  const [showNiapinModal, setShowNiapinModal] = useState(false);
  const [showHoleModeSelector, setShowHoleModeSelector] = useState(false);
  const [dragActiveChip, setDragActiveChip] = useState<ChipSelection | null>(null);
  const dragOccurredRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [spectatorConfirmOpen, setSpectatorConfirmOpen] = useState(false);
  const [playerConfirmOpen, setPlayerConfirmOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<GameEvent | null>(null);
  const [logEditError, setLogEditError] = useState('');
  // ログ行から過去ホールのサイドゲームを開くとき、その対象ホール（null = 現在ホール）
  const [sideGameEditHole, setSideGameEditHole] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
  );

  const loadData = useCallback(async () => {
    if (!roomCode) { router.push('/'); return; }
    try {
      const gameSnap = await getDoc(doc(db, 'games', roomCode));
      if (!gameSnap.exists()) {
        setError(t.play.gameNotFound);
        setLoading(false);
        return;
      }
      const typedGame = { id: gameSnap.id, ...gameSnap.data() } as Game;
      setGame(typedGame);

      if (typedGame.status === 'finished') {
        localStorage.setItem('currentRoomCode', roomCode);
        router.push(`/game/__placeholder__/result?room=${roomCode}`);
        return;
      }

      const [playersSnap, chipDefsSnap, eventsSnap] = await Promise.all([
        getDocs(query(collection(db, 'games', roomCode, 'players'), orderBy('display_order'))),
        getDocs(query(collection(db, 'games', roomCode, 'chip_definitions'), orderBy('sort_order'))),
        getDocs(query(collection(db, 'games', roomCode, 'game_events'), orderBy('created_at', 'desc'), limit(500))),
      ]);

      setPlayers(playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
      const loadedChipDefs = chipDefsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChipDefinition));
      setChipDefs(loadedChipDefs.filter(c => c.is_active !== false));
      setEvents(eventsSnap.docs.map(d => ({ ...d.data(), id: d.id } as GameEvent)));
      saveGameChipsToLibrary(loadedChipDefs);
      setLoading(false);
    } catch {
      setLoading(false);
    }
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
    const unsubChipDefs = onSnapshot(
      query(collection(db, 'games', roomCode, 'chip_definitions'), orderBy('sort_order')),
      (snap) => {
        setChipDefs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChipDefinition)).filter(c => c.is_active !== false));
      }
    );

    const unsubChips = onSnapshot(collection(db, 'games', roomCode, 'chip_states'), (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'modified' || change.type === 'added') {
          const changedId = change.doc.id;
          setFlashCounts(prev => ({ ...prev, [changedId]: (prev[changedId] ?? 0) + 1 }));
        }
      });
      setChipStates(snap.docs.map(d => ({ ...d.data(), id: d.id } as ChipState)));
    });

    const unsubEvents = onSnapshot(
      query(collection(db, 'games', roomCode, 'game_events'), orderBy('created_at', 'desc'), limit(500)),
      (snap) => {
        setEvents(snap.docs.map(d => ({ ...d.data(), id: d.id } as GameEvent)));
      }
    );

    const unsubGame = onSnapshot(doc(db, 'games', roomCode), (snap) => {
      if (!snap.exists()) return;
      const updated = { id: snap.id, ...snap.data() } as Game;
      setGame(updated);
      if (updated.status === 'finished') { localStorage.setItem('currentRoomCode', roomCode); router.push(`/game/__placeholder__/result?room=${roomCode}`); }
    });

    const unsubOlympic = onSnapshot(
      collection(db, 'games', roomCode, 'olympic_logs'),
      (snap) => {
        setOlympicLogs(snap.docs.map(d => ({ ...d.data() } as OlympicHoleLog)));
      }
    );

    const unsubDracon = onSnapshot(
      collection(db, 'games', roomCode, 'dracon_logs'),
      (snap) => {
        setDraconLogs(snap.docs.map(d => ({ ...d.data() } as SingleWinnerHoleLog)));
      }
    );

    const unsubNiapin = onSnapshot(
      collection(db, 'games', roomCode, 'niapin_logs'),
      (snap) => {
        setNiapinLogs(snap.docs.map(d => ({ ...d.data() } as SingleWinnerHoleLog)));
      }
    );

    const unsubPlayers = onSnapshot(
      query(collection(db, 'games', roomCode, 'players'), orderBy('display_order')),
      (snap) => {
        setPlayers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Player)));
      }
    );

    return () => { unsubChipDefs(); unsubChips(); unsubEvents(); unsubGame(); unsubOlympic(); unsubDracon(); unsubNiapin(); unsubPlayers(); };
  }, [roomCode, router]);

  // ---- transfer logic ----

  async function doTransfer(chipState: ChipState, chipDef: ChipDefinition, toPlayerId: string | null) {
    const me = players.find(p => p.id === myPlayerId);
    if (me?.is_spectator) return;
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

    const hasHoles = game?.hole_mode && game.hole_mode !== 'none';
    await addDoc(collection(db, 'games', roomCode, 'game_events'), {
      game_id: roomCode,
      chip_state_id: movedId,
      chip_definition_id: chipDef.id,
      from_player_id: fromPlayerId,
      to_player_id: toPlayerId,
      hole_number: hasHoles ? (game?.current_hole ?? null) : null,
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

  // ---- hole mode change (host only) ----

  async function changeHoleMode(mode: HoleMode) {
    const total_holes = mode === '9h' ? 9 : 18;
    const current_hole = mode === '18h_in' ? 10 : 1;
    await updateDoc(doc(db, 'games', roomCode), { hole_mode: mode, total_holes, current_hole });
    setShowHoleModeSelector(false);
  }

  // ---- olympic ----

  /** 同じホール・同じ種目の古いログ行を消す（再入力時にログが重複しないように） */
  async function clearSideGameEvents(type: 'olympic' | 'dracon' | 'niapin', holeNumber: number) {
    const stale = events.filter(ev => ev.hole_number === holeNumber && sideGameTypeOf(ev) === type);
    await Promise.all(
      stale.map(ev => deleteDoc(doc(db, 'games', roomCode, 'game_events', ev.id)))
    );
  }

  async function saveOlympicLog(holeNumber: number, entries: Record<string, OlympicEntry>) {
    await setDoc(doc(db, 'games', roomCode, 'olympic_logs', String(holeNumber)), {
      hole_number: holeNumber,
      entries,
      updated_at: new Date().toISOString(),
    });

    await clearSideGameEvents('olympic', holeNumber);

    const RANK_LABELS = locale === 'en'
      ? ['🥇Gold', '🥈Silver', '🥉Bronze', '🫀Iron']
      : ['🥇金', '🥈銀', '🥉銅', '鉄'];
    const olympicLabel = locale === 'en' ? 'Olympic' : 'オリンピック';
    await Promise.all(
      Object.entries(entries)
        .filter(([, entry]) => entry.position !== null)
        .map(([playerId, entry]) => {
          const player = players.find(p => p.id === playerId);
          if (!player) return Promise.resolve();
          const pts = Math.max(1, 5 - entry.position!);
          const rankLabel = RANK_LABELS[entry.position! - 1] ?? String(entry.position);
          return addDoc(collection(db, 'games', roomCode, 'game_events'), {
            game_id: roomCode,
            chip_state_id: null,
            chip_definition_id: null,
            from_player_id: null,
            to_player_id: playerId,
            hole_number: holeNumber,
            description: `🏅 H${holeNumber} ${olympicLabel}: ${player.name} ${rankLabel}(${pts}pt)`,
            side_game: 'olympic',
            created_at: new Date().toISOString(),
          });
        })
    );

    setShowOlympicModal(false);
    setSideGameEditHole(null);
  }

  async function saveSingleWinnerLog(
    type: 'dracon' | 'niapin',
    holeNumber: number,
    winnerId: string | null,
    doubleUp: boolean,
    carryover: number,
  ) {
    await setDoc(doc(db, 'games', roomCode, `${type}_logs`, String(holeNumber)), {
      hole_number: holeNumber,
      winner_player_id: winnerId,
      double_up: doubleUp,
      carryover,
      updated_at: new Date().toISOString(),
    });

    await clearSideGameEvents(type, holeNumber);

    const emoji = type === 'dracon' ? '🏌️' : '📍';
    const label = locale === 'en'
      ? (type === 'dracon' ? 'Longest Drive' : 'Closest Pin')
      : (type === 'dracon' ? 'ドラコン' : 'ニアピン');
    const noWinnerLabel = locale === 'en' ? 'No winner' : '該当者なし';

    if (winnerId) {
      const player = players.find(p => p.id === winnerId);
      if (player) {
        const basePts = doubleUp ? 2 : 1;
        const effectivePts = basePts + carryover;
        const extras = [
          doubleUp ? (locale === 'en' ? 'Double' : '倍付け') : '',
          carryover > 0 ? `CO+${carryover}` : '',
        ].filter(Boolean).join(' ');
        const extrasLabel = extras ? ` (${extras})` : '';
        await addDoc(collection(db, 'games', roomCode, 'game_events'), {
          game_id: roomCode,
          chip_state_id: null,
          chip_definition_id: null,
          from_player_id: null,
          to_player_id: winnerId,
          hole_number: holeNumber,
          description: `${emoji} H${holeNumber} ${label}: ${player.name}(${effectivePts}pt${extrasLabel})`,
          side_game: type,
          created_at: new Date().toISOString(),
        });
      }
    } else {
      await addDoc(collection(db, 'games', roomCode, 'game_events'), {
        game_id: roomCode,
        chip_state_id: null,
        chip_definition_id: null,
        from_player_id: null,
        to_player_id: null,
        hole_number: holeNumber,
        description: `${emoji} H${holeNumber} ${label}: ${noWinnerLabel}`,
        side_game: type,
        created_at: new Date().toISOString(),
      });
    }

    if (type === 'dracon') setShowDraconModal(false);
    else setShowNiapinModal(false);
    setSideGameEditHole(null);
  }

  // ---- hole management ----

  function getNextHole(g: Game): number | null {
    const mode = g.hole_mode ?? 'none';
    if (mode === 'none') return null;
    const h = g.current_hole;
    if (mode === '9h') return h < 9 ? h + 1 : null;
    if (mode === '18h_out') return h < 18 ? h + 1 : null;
    if (mode === '18h_in') {
      if (h >= 10 && h < 18) return h + 1;
      if (h === 18) return 1;
      if (h >= 1 && h < 9) return h + 1;
      return null; // h === 9: last hole done
    }
    return null;
  }

  function getPrevHole(g: Game): number | null {
    const mode = g.hole_mode ?? 'none';
    if (mode === 'none') return null;
    const h = g.current_hole;
    if (mode === '9h') return h > 1 ? h - 1 : null;
    if (mode === '18h_out') return h > 1 ? h - 1 : null;
    if (mode === '18h_in') {
      if (h === 10) return null; // 10H = 先頭ホール
      if (h > 10) return h - 1; // 11〜18 → 前へ
      if (h === 1) return 18;   // 1H → 18H へ戻る
      return h - 1;              // 2〜9 → 前へ
    }
    return null;
  }

  async function advanceHole() {
    if (!game) return;
    const next = getNextHole(game);
    if (next === null) return;
    await updateDoc(doc(db, 'games', roomCode), { current_hole: next });
  }

  async function retreatHole() {
    if (!game) return;
    const prev = getPrevHole(game);
    if (prev === null) return;
    await updateDoc(doc(db, 'games', roomCode), { current_hole: prev });
  }

  // ---- render ----

  async function endGame() {
    if (!game) return;
    if (!confirm(t.play.confirmEndGame)) return;
    await updateDoc(doc(db, 'games', roomCode), { status: 'finished' });
    localStorage.setItem('currentRoomCode', roomCode);
    router.push(`/game/__placeholder__/result?room=${roomCode}`);
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
  const me = players.find(p => p.id === myPlayerId);
  const isSpectator = me?.is_spectator ?? false;
  const isDragging = !!dragActiveChip;

  async function toggleSpectator() {
    if (!me || !myPlayerId || isHost) return;
    if (!me.is_spectator) {
      const now = new Date().toISOString();
      // チップを場に戻す
      const myChips = chipStates.filter(cs => cs.holder_player_id === myPlayerId);
      // オリンピックのエントリを削除
      const olympicResets = olympicLogs
        .filter(log => myPlayerId in log.entries)
        .map(log => {
          const newEntries = { ...log.entries };
          delete newEntries[myPlayerId];
          return setDoc(doc(db, 'games', roomCode, 'olympic_logs', String(log.hole_number)), {
            hole_number: log.hole_number, entries: newEntries, updated_at: now,
          });
        });
      // ドラコン/ニアピンの当選者をリセット
      const draconResets = draconLogs
        .filter(log => log.winner_player_id === myPlayerId)
        .map(log => updateDoc(doc(db, 'games', roomCode, 'dracon_logs', String(log.hole_number)), {
          winner_player_id: null, updated_at: now,
        }));
      const niapinResets = niapinLogs
        .filter(log => log.winner_player_id === myPlayerId)
        .map(log => updateDoc(doc(db, 'games', roomCode, 'niapin_logs', String(log.hole_number)), {
          winner_player_id: null, updated_at: now,
        }));
      await Promise.all([
        ...myChips.map(cs =>
          updateDoc(doc(db, 'games', roomCode, 'chip_states', cs.id), {
            holder_player_id: null, updated_at: now,
          })
        ),
        ...olympicResets,
        ...draconResets,
        ...niapinResets,
      ]);
    }
    await updateDoc(doc(db, 'games', roomCode, 'players', myPlayerId), {
      is_spectator: !me.is_spectator,
    });
  }

  // ---- イベントログの修正（ホストのみ） ----

  /** events は created_at desc なので、そのチップの最初のヒット = 最新の移動記録 */
  function isLatestEventForChip(ev: GameEvent): boolean {
    if (!ev.chip_state_id) return false;
    const latest = events.find(e => e.chip_state_id === ev.chip_state_id && e.chip_definition_id !== null);
    return latest?.id === ev.id;
  }

  function openLogEditor(ev: GameEvent) {
    if (!isHost) return;
    const sideGame = sideGameTypeOf(ev);
    if (sideGame) {
      // サイドゲームの記録は該当ホールの入力モーダルで直す（精算の元データがそちらにあるため）
      if (ev.hole_number != null) setSideGameEditHole(ev.hole_number);
      if (sideGame === 'olympic') setShowOlympicModal(true);
      else if (sideGame === 'dracon') setShowDraconModal(true);
      else setShowNiapinModal(true);
      return;
    }
    if (isChipTransferEvent(ev)) setEditingEvent(ev);
  }

  async function saveEventEdit(
    ev: GameEvent,
    fromPlayerId: string | null,
    toPlayerId: string | null,
    holeNumber: number | null,
  ) {
    const now = new Date().toISOString();
    const syncState = isLatestEventForChip(ev);
    const chipDef = chipDefs.find(d => d.id === ev.chip_definition_id);
    const fromName = fromPlayerId ? (players.find(p => p.id === fromPlayerId)?.name ?? '場') : '場';
    const toName = toPlayerId ? (players.find(p => p.id === toPlayerId)?.name ?? '場') : '場';

    setLogEditError('');
    try {
      await updateDoc(doc(db, 'games', roomCode, 'game_events', ev.id), {
        from_player_id: fromPlayerId,
        to_player_id: toPlayerId,
        hole_number: holeNumber,
        description: chipDef ? `${chipDef.name}: ${fromName} → ${toName}` : (ev.description ?? null),
        edited_at: now,
      });

      // 最新の記録を直したときだけ、実際のチップの持ち主（＝スコア）も合わせる
      if (syncState && ev.chip_state_id) {
        await updateDoc(doc(db, 'games', roomCode, 'chip_states', ev.chip_state_id), {
          holder_player_id: toPlayerId,
          updated_at: now,
        });
      }
      setEditingEvent(null);
    } catch (err: unknown) {
      setLogEditError(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteEvent(ev: GameEvent) {
    const now = new Date().toISOString();
    const syncState = isLatestEventForChip(ev);

    setLogEditError('');
    try {
      await deleteDoc(doc(db, 'games', roomCode, 'game_events', ev.id));

      // 最新の記録を消した場合はその移動を取り消す＝チップを移動元に戻す
      if (syncState && ev.chip_state_id) {
        await updateDoc(doc(db, 'games', roomCode, 'chip_states', ev.chip_state_id), {
          holder_player_id: ev.from_player_id,
          updated_at: now,
        });
      }
      setEditingEvent(null);
    } catch (err: unknown) {
      setLogEditError(err instanceof Error ? err.message : String(err));
    }
  }

  function copyRoomCodeToClipboard() {
    navigator.clipboard.writeText(roomCode);
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2000);
  }

  function handleToggleSpectator() {
    setMenuOpen(false);
    if (!isSpectator) {
      setSpectatorConfirmOpen(true);
    } else {
      setPlayerConfirmOpen(true);
    }
  }

  async function submitComment(comment: string) {
    if (!myPlayerId) return;
    const current = players.find(p => p.id === myPlayerId)?.comments ?? [];
    const updated = [...current, comment.trim()].slice(-10);
    await updateDoc(doc(db, 'games', roomCode, 'players', myPlayerId), {
      comments: updated,
    });
  }
  const hasHoles = !!(game?.hole_mode && game.hole_mode !== 'none');
  const canAdvance = hasHoles && game ? getNextHole(game) !== null : false;
  const canRetreat = hasHoles && game ? getPrevHole(game) !== null : false;

  const currentHole = game?.current_hole ?? 1;
  const isOlympicEnabled = !!game?.olympic_enabled;
  const isDraconEnabled = !!game?.dracon_enabled;
  const isNiapinEnabled = !!game?.niapin_enabled;
  const currentOlympicLog = olympicLogs.find(l => l.hole_number === currentHole) ?? null;
  const isCurrentHoleLogged = !!currentOlympicLog;
  const currentDraconLog = draconLogs.find(l => l.hole_number === currentHole) ?? null;
  const currentNiapinLog = niapinLogs.find(l => l.hole_number === currentHole) ?? null;

  // サイドゲームのモーダルが対象にするホール（ログ行から開いた場合はその行のホール）
  const sideGameHole = sideGameEditHole ?? currentHole;
  const olympicModalLog = olympicLogs.find(l => l.hole_number === sideGameHole) ?? null;
  const draconModalLog = draconLogs.find(l => l.hole_number === sideGameHole) ?? null;
  const niapinModalLog = niapinLogs.find(l => l.hole_number === sideGameHole) ?? null;

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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      autoScroll={false}
    >
      {/* オリンピック入力モーダル */}
      {showOlympicModal && (
        <OlympicModal
          players={players}
          holeNumber={sideGameHole}
          isHoleEditable={!hasHoles}
          existingLog={olympicModalLog}
          onSave={saveOlympicLog}
          onClose={() => { setShowOlympicModal(false); setSideGameEditHole(null); }}
        />
      )}

      {/* ドラコン入力モーダル */}
      {showDraconModal && (
        <SingleWinnerModal
          type="dracon"
          players={players}
          holeNumber={sideGameHole}
          isHoleEditable={!hasHoles}
          existingLog={draconModalLog}
          onSave={(hole, winner, doubleUp, carryover) => saveSingleWinnerLog('dracon', hole, winner, doubleUp, carryover)}
          onClose={() => { setShowDraconModal(false); setSideGameEditHole(null); }}
        />
      )}

      {/* ニアピン入力モーダル */}
      {showNiapinModal && (
        <SingleWinnerModal
          type="niapin"
          players={players}
          holeNumber={sideGameHole}
          isHoleEditable={!hasHoles}
          existingLog={niapinModalLog}
          onSave={(hole, winner, doubleUp, carryover) => saveSingleWinnerLog('niapin', hole, winner, doubleUp, carryover)}
          onClose={() => { setShowNiapinModal(false); setSideGameEditHole(null); }}
        />
      )}

      {/* ログ行の修正モーダル（ホストのみ） */}
      {editingEvent && (
        <EventEditModal
          event={editingEvent}
          chipDef={chipDefs.find(d => d.id === editingEvent.chip_definition_id) ?? null}
          players={players}
          isLatest={isLatestEventForChip(editingEvent)}
          totalHoles={hasHoles ? (game?.total_holes ?? 18) : 0}
          locale={locale}
          t={t}
          error={logEditError}
          onSave={saveEventEdit}
          onDelete={deleteEvent}
          onClose={() => { setEditingEvent(null); setLogEditError(''); }}
        />
      )}

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
                  isCustom={!selected.chipDef.chip_template_id}
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
        <div className="sticky top-0 bg-[#145a32] border-b border-green-800 px-3 z-10" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: '8px' }}>
          <div className="max-w-md mx-auto flex items-center justify-between">
            <button onClick={() => router.push('/')}><Logo size="sm" /></button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className="text-xs bg-green-900 hover:bg-green-800 text-green-300 px-2 py-1 rounded-lg border border-green-700"
              >
                Reload
              </button>
              {isHost && (
                <button
                  onClick={endGame}
                  className="text-xs bg-red-900 hover:bg-red-800 text-red-200 px-2 py-1 rounded-lg border border-red-700"
                >
                  {t.play.endGame}
                </button>
              )}
              <button
                onClick={() => setMenuOpen(true)}
                className="text-green-300 hover:text-[#d4af37] p-1 transition-colors"
                aria-label="メニュー"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ハンバーガーメニュー */}
        {menuOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
            <div
              className="absolute top-0 right-0 w-64 bg-[#0d3d22] border-l border-b border-green-800 rounded-bl-xl shadow-2xl p-4 space-y-3"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* ルームコード + コピー */}
              <div className="flex items-center justify-between bg-[#145a32] rounded-lg px-3 py-2">
                <span className="font-mono font-bold text-[#d4af37] tracking-widest text-sm">{roomCode}</span>
                <button
                  onClick={copyRoomCodeToClipboard}
                  className="text-xs text-green-400 hover:text-[#d4af37] transition-colors ml-2 shrink-0"
                >
                  {copiedRoom ? t.play.copied : t.play.copyRoomCode}
                </button>
              </div>

              {/* 言語切替 */}
              <div className="flex items-center justify-between">
                <span className="text-green-400 text-sm">Language</span>
                <LangToggle />
              </div>

              {/* 観戦者 ↔ プレイヤー切替（ホスト以外のみ） */}
              {!isHost && (
                <>
                  <div className="border-t border-green-800" />
                  <button
                    onClick={handleToggleSpectator}
                    className={`w-full text-left text-sm py-1 transition-colors ${isSpectator ? 'text-green-300 hover:text-[#d4af37]' : 'text-yellow-400 hover:text-yellow-300'}`}
                  >
                    {isSpectator ? `👤 ${t.play.becomePlayer}` : `👀 ${t.play.becomeSpectator}`}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 観戦者になる確認モーダル */}
        {spectatorConfirmOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="card-casino w-full max-w-sm">
              <p className="text-[#d4af37] font-bold mb-2">⚠️ {t.play.confirmBecomeSpectator}</p>
              <p className="text-green-300 text-sm mb-4">{t.play.confirmBecomeSpectatorDetail}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setSpectatorConfirmOpen(false); toggleSpectator(); }}
                  className="btn-gold flex-1 py-2"
                >
                  {t.play.confirm}
                </button>
                <button
                  onClick={() => setSpectatorConfirmOpen(false)}
                  className="flex-1 py-2 rounded-lg border border-green-700 text-green-300 hover:border-green-500 transition-colors"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* プレイヤーになる確認モーダル */}
        {playerConfirmOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="card-casino w-full max-w-sm">
              <p className="text-[#d4af37] font-bold mb-4">👤 {t.play.confirmBecomePlayer}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPlayerConfirmOpen(false); toggleSpectator(); }}
                  className="btn-gold flex-1 py-2"
                >
                  {t.play.confirm}
                </button>
                <button
                  onClick={() => setPlayerConfirmOpen(false)}
                  className="flex-1 py-2 rounded-lg border border-green-700 text-green-300 hover:border-green-500 transition-colors"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 space-y-3 max-w-md mx-auto">
          {/* ホール設定変更（ホストのみ） */}
          {isHost && (
            <div className="card-casino !p-3">
              <div className="flex items-center justify-between">
                <p className="text-[#d4af37] font-semibold text-sm">{t.newGame.holeSetting}</p>
                <button
                  type="button"
                  onClick={() => setShowHoleModeSelector(v => !v)}
                  className="text-xs text-green-400 hover:text-[#d4af37] transition-colors"
                >
                  {showHoleModeSelector ? t.common.close : t.common.edit}
                </button>
              </div>
              {showHoleModeSelector && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {(['9h', '18h_out', '18h_in'] as HoleMode[]).map(mode => {
                    const label = mode === '9h' ? t.newGame.hole9h
                      : mode === '18h_out' ? t.newGame.hole18hOut
                      : t.newGame.hole18hIn;
                    const current = game?.hole_mode ?? 'none';
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => changeHoleMode(mode)}
                        className={`py-2 rounded-lg text-sm font-medium border transition-colors
                          ${current === mode
                            ? 'bg-[#d4af37] border-yellow-400 text-[#1a1a1a]'
                            : 'bg-green-800 border-green-700 hover:bg-green-700 text-white'
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ホールナビゲーション */}
          {hasHoles && game && (
            <div className="card-casino !p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <button
                  onClick={retreatHole}
                  disabled={!canRetreat || isSpectator}
                  className={`flex-1 py-3 rounded-xl font-bold text-base transition-colors border
                    ${canRetreat && !isSpectator
                      ? 'bg-green-800 hover:bg-green-700 active:bg-green-600 text-white border-green-600'
                      : 'bg-[#0d3320] text-green-900 border-green-900 cursor-not-allowed'
                    }`}
                >
                  {t.play.prevHole}
                </button>
                <div className="text-center shrink-0">
                  <p className="text-[#d4af37] text-xs font-semibold uppercase tracking-wider mb-0.5">HOLE</p>
                  <p className="text-white font-bold text-4xl leading-none">{game.current_hole}</p>
                  <p className="text-green-500 text-sm mt-0.5">/ {game.total_holes}</p>
                </div>
                <button
                  onClick={advanceHole}
                  disabled={!canAdvance || isSpectator}
                  className={`flex-1 py-3 rounded-xl font-bold text-base transition-colors border
                    ${canAdvance && !isSpectator
                      ? 'bg-[#d4af37] hover:bg-yellow-500 active:bg-yellow-600 text-[#1a1a1a] border-yellow-400'
                      : 'bg-[#0d3320] text-green-900 border-green-900 cursor-not-allowed'
                    }`}
                >
                  {t.play.nextHole}
                </button>
              </div>
              {isOlympicEnabled && !isSpectator && (
                <button
                  type="button"
                  onClick={() => setShowOlympicModal(true)}
                  className={`w-full py-2 rounded-xl font-bold text-sm border transition-colors
                    ${isCurrentHoleLogged
                      ? 'bg-green-900 border-green-600 text-green-300'
                      : 'bg-yellow-900/40 border-yellow-600 text-yellow-300 hover:bg-yellow-900/70'
                    }`}
                >
                  {isCurrentHoleLogged
                    ? `${t.olympic.buttonLogged} H${currentHole}`
                    : `${t.olympic.buttonLabel} H${currentHole} 入力`}
                </button>
              )}
              {isDraconEnabled && !isSpectator && (
                <button
                  type="button"
                  onClick={() => setShowDraconModal(true)}
                  className={`w-full py-2 rounded-xl font-bold text-sm border transition-colors
                    ${!!currentDraconLog
                      ? 'bg-green-900 border-green-600 text-green-300'
                      : 'bg-yellow-900/40 border-yellow-600 text-yellow-300 hover:bg-yellow-900/70'
                    }`}
                >
                  {currentDraconLog
                    ? `${t.dracon.buttonLogged} H${currentHole}`
                    : `${t.dracon.buttonLabel} H${currentHole} 入力`}
                </button>
              )}
              {isNiapinEnabled && !isSpectator && (
                <button
                  type="button"
                  onClick={() => setShowNiapinModal(true)}
                  className={`w-full py-2 rounded-xl font-bold text-sm border transition-colors
                    ${!!currentNiapinLog
                      ? 'bg-green-900 border-green-600 text-green-300'
                      : 'bg-yellow-900/40 border-yellow-600 text-yellow-300 hover:bg-yellow-900/70'
                    }`}
                >
                  {currentNiapinLog
                    ? `${t.niapin.buttonLogged} H${currentHole}`
                    : `${t.niapin.buttonLabel} H${currentHole} 入力`}
                </button>
              )}
            </div>
          )}

          {/* ホールモードなし + オリンピック有効時のスタンドアロンボタン */}
          {!hasHoles && isOlympicEnabled && !isSpectator && (
            <button
              type="button"
              onClick={() => setShowOlympicModal(true)}
              className="w-full py-3 rounded-xl font-bold text-sm border bg-yellow-900/40 border-yellow-600 text-yellow-300 hover:bg-yellow-900/70 transition-colors"
            >
              {t.olympic.buttonLabel}
            </button>
          )}

          {/* 場のチップ */}
          <DroppableZone id="field" active={isDragging}>
            <div className="card-casino !p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[#d4af37] font-semibold text-lg">{t.play.fieldChips}</p>
                {!isSpectator && (
                  <button
                    onClick={() => { localStorage.setItem('currentRoomCode', roomCode); router.push(`/game/__placeholder__/chips?room=${roomCode}`); }}
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
                      <DraggableChip
                        key={`${cs.id}-${flashCounts[cs.id] ?? 0}`}
                        id={cs.id}
                        data={{ chipState: cs, chipDef: def }}
                        onTap={isSpectator ? undefined : () => setSelected({ chipState: cs, chipDef: def })}
                        disabled={isSpectator}
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
                          isCustom={!def.chip_template_id}
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
            <DroppableZone key={player.id} id={player.id} active={isDragging && !isSpectator}>
              <div className="card-casino !p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white font-semibold text-lg">{player.name}</span>
                    {player.id === myPlayerId && <span className="text-base text-green-400">{t.common.you}</span>}
                    {player.is_host && (
                      <span className="text-base bg-[#d4af37] text-[#1a1a1a] px-1.5 py-0.5 rounded font-semibold">{t.common.host}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <div className="text-right">
                      <span className={`font-bold text-2xl ${netScore > 0 ? 'text-[#d4af37]' : netScore < 0 ? 'text-red-400' : 'text-white'}`}>
                        {netScore > 0 ? `+${netScore}` : netScore}
                      </span>
                      <p className="text-green-600 text-base">+{positivePoints} / -{negativePoints}</p>
                    </div>
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
                        <DraggableChip
                          key={`${cs.id}-${flashCounts[cs.id] ?? 0}`}
                          id={cs.id}
                          data={{ chipState: cs, chipDef }}
                          onTap={isSpectator ? undefined : () => setSelected({ chipState: cs, chipDef })}
                          disabled={isSpectator}
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
                            onClick={isSpectator ? undefined : () => { if (!dragOccurredRef.current) setSelected({ chipState: cs, chipDef }); }}
                            isCustom={!chipDef.chip_template_id}
                          />
                        </DraggableChip>
                      );
                    })}
                  </div>
                )}
              </div>
            </DroppableZone>
          ))}

          {/* 観戦者セクション */}
          <SpectatorSection
            players={players}
            myPlayerId={myPlayerId}
            isSpectator={isSpectator}
            onSubmitComment={submitComment}
            t={t}
          />

          {/* オリンピック途中経過 */}
          {isOlympicEnabled && olympicLogs.length > 0 && (() => {
            const totals = calcOlympicTotals(players, olympicLogs);
            return (
              <div className="card-casino !p-3">
                <p className="text-[#d4af37] font-semibold text-base mb-2">🏅 {t.olympic.tabOlympic}</p>
                <div className="space-y-1.5">
                  {totals.map(({ player, totalPoints, settlement }) => (
                    <div key={player.id} className="flex items-center justify-between bg-[#145a32] rounded-lg px-3 py-2">
                      <span className="text-white text-sm font-medium">{player.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-green-400 text-sm">{totalPoints}pt</span>
                        <span className={`text-sm font-bold w-14 text-right ${settlement > 0 ? 'text-[#d4af37]' : settlement < 0 ? 'text-red-400' : 'text-white'}`}>
                          {settlement > 0 ? `+${settlement}` : settlement}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ドラコン途中経過 */}
          {isDraconEnabled && draconLogs.length > 0 && (() => {
            const totals = calcSingleWinnerTotals(players, draconLogs);
            return (
              <div className="card-casino !p-3">
                <p className="text-[#d4af37] font-semibold text-base mb-2">🏌️ {t.dracon.tabLabel}</p>
                <div className="space-y-1.5">
                  {totals.map(({ player, wins, settlement }) => (
                    <div key={player.id} className="flex items-center justify-between bg-[#145a32] rounded-lg px-3 py-2">
                      <span className="text-white text-sm font-medium">{player.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-green-400 text-sm">{wins}{t.dracon.wins}</span>
                        <span className={`text-sm font-bold w-14 text-right ${settlement > 0 ? 'text-[#d4af37]' : settlement < 0 ? 'text-red-400' : 'text-white'}`}>
                          {settlement > 0 ? `+${settlement}` : settlement}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ニアピン途中経過 */}
          {isNiapinEnabled && niapinLogs.length > 0 && (() => {
            const totals = calcSingleWinnerTotals(players, niapinLogs);
            return (
              <div className="card-casino !p-3">
                <p className="text-[#d4af37] font-semibold text-base mb-2">📍 {t.niapin.tabLabel}</p>
                <div className="space-y-1.5">
                  {totals.map(({ player, wins, settlement }) => (
                    <div key={player.id} className="flex items-center justify-between bg-[#145a32] rounded-lg px-3 py-2">
                      <span className="text-white text-sm font-medium">{player.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-green-400 text-sm">{wins}{t.niapin.wins}</span>
                        <span className={`text-sm font-bold w-14 text-right ${settlement > 0 ? 'text-[#d4af37]' : settlement < 0 ? 'text-red-400' : 'text-white'}`}>
                          {settlement > 0 ? `+${settlement}` : settlement}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

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
              <>
                {isHost && events.length > 0 && (
                  <p className="text-green-600 text-xs mt-2">{t.play.editLogHint}</p>
                )}
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {events.length === 0 ? (
                    <p className="text-green-700 text-lg text-center py-2">{t.play.noEvents}</p>
                  ) : (
                    events.map((ev) => {
                      const label = formatEventLabel(ev, chipDefs, players, locale, t.play.field, t.play.holeLabel);
                      const editable = isHost && (!!sideGameTypeOf(ev) || isChipTransferEvent(ev));
                      const body = (
                        <>
                          <span className="flex-1 text-left">{label}</span>
                          {ev.edited_at && (
                            <span className="text-green-600 text-xs shrink-0">{t.play.editLogEdited}</span>
                          )}
                          {editable && <span className="text-[#d4af37] text-sm shrink-0">✎</span>}
                        </>
                      );
                      const className = 'w-full text-base text-green-300 bg-[#145a32] rounded px-3 py-1.5 flex items-center gap-2';
                      return editable ? (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => openLogEditor(ev)}
                          className={`${className} hover:bg-green-800 transition-colors`}
                        >
                          {body}
                        </button>
                      ) : (
                        <div key={ev.id} className={className}>{body}</div>
                      );
                    })
                  )}
                </div>
              </>
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
              isCustom={!dragActiveChip.chipDef.chip_template_id}
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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data, disabled });
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
      style={{ opacity: isDragging ? 0.25 : 1, cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab', touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

function EventEditModal({
  event, chipDef, players, isLatest, totalHoles, locale, t, error, onSave, onDelete, onClose,
}: {
  event: GameEvent;
  chipDef: ChipDefinition | null;
  players: Player[];
  isLatest: boolean;
  totalHoles: number; // 0 = ホール設定なし
  locale: 'ja' | 'en';
  t: ReturnType<typeof useT>['t'];
  error: string;
  onSave: (ev: GameEvent, from: string | null, to: string | null, hole: number | null) => Promise<void>;
  onDelete: (ev: GameEvent) => Promise<void>;
  onClose: () => void;
}) {
  const [fromId, setFromId] = useState<string | null>(event.from_player_id);
  const [toId, setToId] = useState<string | null>(event.to_player_id);
  const [hole, setHole] = useState<number | null>(event.hole_number);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectClass = 'w-full bg-[#0d3320] border border-green-800 rounded-lg px-3 py-2 text-white text-base focus:outline-none focus:border-[#d4af37]';

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(event, fromId, toId, hole);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await onDelete(event);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card-casino w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {chipDef && (
              <ChipBadge
                name={chipDef.name}
                chipType={chipDef.chip_type}
                imageUrl={chipDef.image_url}
                imageScale={chipDef.image_scale ?? undefined}
                imageOffsetY={chipDef.image_offset_y ?? undefined}
                pointValue={chipDef.point_value}
                size={64}
                showLabel={false}
                isCustom={!chipDef.chip_template_id}
              />
            )}
            <div>
              <p className="text-[#d4af37] font-bold text-lg">{t.play.editLogTitle}</p>
              {chipDef && (
                <p className="text-green-300 text-sm">
                  {locale === 'en' ? (chipNamesEn[chipDef.name] ?? chipDef.name) : chipDef.name}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-green-400 text-3xl leading-none">✕</button>
        </div>

        <p className={`text-sm rounded-lg px-3 py-2 mb-4 ${isLatest ? 'bg-yellow-900/40 text-yellow-300' : 'bg-[#145a32] text-green-400'}`}>
          {isLatest ? t.play.editLogSyncNote : t.play.editLogRecordOnlyNote}
        </p>

        <div className="space-y-3">
          {totalHoles > 0 && (
            <div>
              <label className="text-green-400 text-sm block mb-1">{t.play.editLogHole}</label>
              <select
                className={selectClass}
                value={hole ?? ''}
                onChange={e => setHole(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">{t.play.editLogNoHole}</option>
                {Array.from({ length: totalHoles }, (_, i) => i + 1).map(h => (
                  <option key={h} value={h}>{t.play.holeLabel}{h}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-green-400 text-sm block mb-1">{t.play.editLogFrom}</label>
            <select className={selectClass} value={fromId ?? ''} onChange={e => setFromId(e.target.value || null)}>
              <option value="">{t.play.field}</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-green-400 text-sm block mb-1">{t.play.editLogTo}</label>
            <select className={selectClass} value={toId ?? ''} onChange={e => setToId(e.target.value || null)}>
              <option value="">{t.play.field}</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm rounded-lg px-3 py-2 bg-red-900/40 text-red-300 break-words">
            {t.play.editLogError.replace('{{error}}', error)}
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={handleSave} disabled={saving} className="btn-gold flex-1 py-2 disabled:opacity-50">
            {saving ? t.common.saving : t.common.save}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 rounded-lg border border-green-700 text-green-300 hover:border-green-500 transition-colors disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
        </div>

        <div className="border-t border-green-800 mt-4 pt-3">
          {confirmDelete ? (
            <div>
              <p className="text-red-300 text-sm mb-2">
                {t.play.editLogDeleteConfirm}
                {isLatest && ` ${t.play.editLogDeleteSyncNote}`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-red-900 hover:bg-red-800 text-red-100 border border-red-700 transition-colors disabled:opacity-50"
                >
                  {t.common.delete}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg border border-green-700 text-green-300 hover:border-green-500 transition-colors disabled:opacity-50"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full text-red-400 hover:text-red-300 text-sm py-1 transition-colors"
            >
              🗑 {t.play.editLogDelete}
            </button>
          )}
        </div>
      </div>
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

function SpectatorSection({
  players, myPlayerId, isSpectator, onSubmitComment, t,
}: {
  players: Player[];
  myPlayerId: string | null;
  isSpectator: boolean;
  onSubmitComment: (comment: string) => Promise<void>;
  t: ReturnType<typeof useT>['t'];
}) {
  const spectators = players.filter(p => p.is_spectator);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!comment.trim()) return;
    setSending(true);
    await onSubmitComment(comment);
    setComment('');
    setSending(false);
  }

  if (spectators.length === 0 && !isSpectator) return null;

  return (
    <div className="card-casino !p-3">
      <p className="text-green-400 font-semibold text-base mb-2">{t.play.spectators}</p>
      {spectators.length === 0 ? (
        <p className="text-green-800 text-sm">{t.play.noSpectators}</p>
      ) : (
        <div className="space-y-2">
          {spectators.map(p => (
            <div key={p.id} className="bg-[#145a32] rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="text-green-300 font-medium text-sm">{p.name}</span>
                {p.id === myPlayerId && <span className="text-xs text-green-500">{t.common.you}</span>}
              </div>
              {(p.comments ?? []).length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {[...(p.comments ?? [])].reverse().map((c, i) => (
                    <p key={i} className="text-green-500 text-xs break-words">💬 {c}</p>
                  ))}
                </div>
              )}
              {p.id === myPlayerId && isSpectator && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={e => setComment(e.target.value.slice(0, 40))}
                    onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && (e.preventDefault(), handleSend())}
                    placeholder={t.play.commentPlaceholder}
                    maxLength={40}
                    className="flex-1 bg-[#0d3320] border border-green-800 rounded px-2 py-1
                               text-white placeholder-green-700 focus:outline-none focus:border-green-600 text-xs"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !comment.trim()}
                    className="text-xs px-3 py-1 rounded bg-green-800 hover:bg-green-700 text-white
                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t.play.commentSend}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
