'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext, DragOverlay, DragEndEvent, DragStartEvent,
  useSensor, useSensors, MouseSensor, TouchSensor,
  useDraggable, useDroppable, MeasuringStrategy,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import ChipBadge from '@/components/ChipBadge';

type Owner = 'field' | 'you' | 'cpu';
type ChipOwners = Record<string, Owner>;

const CHIPS = [
  { name: 'パー',      type: 'positive' as const, imageUrl: '/chips/PAR.webp',       imageScale: 1.0, imageOffsetY: 40, point: 1 },
  { name: 'バーディー', type: 'positive' as const, imageUrl: '/chips/BIRDIE.webp',    imageScale: 1.5, imageOffsetY: 34, point: 2 },
  { name: 'チップイン', type: 'positive' as const, imageUrl: '/chips/CHIPIN.webp',    imageScale: 1.4, imageOffsetY: 31, point: 2 },
  { name: '1パット',   type: 'positive' as const, imageUrl: '/chips/1PUTT.webp',     imageScale: 1.1, imageOffsetY: 28, point: 1 },
  { name: 'OB',       type: 'negative' as const, imageUrl: '/chips/OB.webp',         imageScale: 1.4, imageOffsetY: 33, point: 2 },
  { name: '3パット',   type: 'negative' as const, imageUrl: '/chips/THREEPUTT.webp', imageScale: 1.3, imageOffsetY: 33, point: 2 },
];
const CHIP_MAP = Object.fromEntries(CHIPS.map(c => [c.name, c]));

function calcScore(owners: ChipOwners, owner: Owner) {
  return Object.entries(owners).reduce((s, [n, o]) => {
    if (o !== owner) return s;
    const c = CHIP_MAP[n];
    return s + (c.type === 'positive' ? c.point : -c.point);
  }, 0);
}
function scoreLabel(n: number) { return n > 0 ? `+${n}` : String(n); }

// ステップ定義:
// 1  ChipGolf紹介
// 2  チップ説明
// 3  パー → you (DnD)
// 4  OB  → cpu (DnD)
// 5  バーディー → you (DnD)
// 6a 3パット → cpu (DnD)
// 6b 1パット → you (DnD)  ← 6aが完了したら自動で6bへ
// 7  パー → cpu (DnD)
// 8  スコア説明
// 9  マルチデバイス訴求
// 10 ゲーム終了

// 内部ステップ（6aと6bを分けて管理）
type Step = 1|2|3|4|5|'6a'|'6b'|7|8|9|10;

const FIELD_ALL: ChipOwners = {
  'パー': 'field', 'バーディー': 'field', 'OB': 'field',
  '1パット': 'field', '3パット': 'field', 'チップイン': 'field',
};

const STEP_STATES: Record<string, ChipOwners> = {
  '1':  { ...FIELD_ALL },
  '2':  { ...FIELD_ALL },
  '3':  { ...FIELD_ALL },
  '4':  { 'パー': 'you',  'バーディー': 'field', 'OB': 'field', '1パット': 'field', '3パット': 'field', 'チップイン': 'field' },
  '5':  { 'パー': 'you',  'バーディー': 'field', 'OB': 'cpu',   '1パット': 'field', '3パット': 'field', 'チップイン': 'field' },
  '6a': { 'パー': 'you',  'バーディー': 'you',   'OB': 'cpu',   '1パット': 'field', '3パット': 'field', 'チップイン': 'field' },
  '6b': { 'パー': 'you',  'バーディー': 'you',   'OB': 'cpu',   '1パット': 'field', '3パット': 'cpu',   'チップイン': 'field' },
  '7':  { 'パー': 'you',  'バーディー': 'you',   'OB': 'cpu',   '1パット': 'you',   '3パット': 'cpu',   'チップイン': 'field' },
  '8':  { 'パー': 'cpu',  'バーディー': 'you',   'OB': 'cpu',   '1パット': 'you',   '3パット': 'cpu',   'チップイン': 'field' },
  '9':  { 'パー': 'cpu',  'バーディー': 'you',   'OB': 'cpu',   '1パット': 'you',   '3パット': 'cpu',   'チップイン': 'field' },
  '10': { 'パー': 'cpu',  'バーディー': 'you',   'OB': 'cpu',   '1パット': 'you',   '3パット': 'cpu',   'チップイン': 'field' },
};

// DnDルール: ステップ→{移動すべきチップ, 移動先, エラー文}
const DND_RULES: Record<string, { chip: string; target: Owner; error: string }> = {
  '3':  { chip: 'パー',      target: 'you', error: 'パーのチップを「あなた」のゾーンへ移動してください' },
  '4':  { chip: 'OB',       target: 'cpu', error: 'OBのチップを「CPU」のゾーンへ移動してください' },
  '5':  { chip: 'バーディー', target: 'you', error: 'バーディーのチップを「あなた」のゾーンへ移動してください' },
  '6a': { chip: '3パット',   target: 'cpu', error: '3パットのチップを「CPU」のゾーンへ移動してください' },
  '6b': { chip: '1パット',   target: 'you', error: '1パットのチップを「あなた」のゾーンへ移動してください' },
  '7':  { chip: 'パー',      target: 'cpu', error: 'パーのチップを「CPU」のゾーンへ移動してください' },
};

// Step表示番号（ドットインジケーター用）
const TOTAL_DOTS = 10;
function dotIndex(step: Step): number {
  if (step === '6a' || step === '6b') return 6;
  return step as number;
}

// 前のステップ
function prevStep(step: Step): Step {
  if (step === '6b') return '6a';
  if (step === '6a') return 5;
  if (step === 7) return '6b';
  const n = step as number;
  return (n - 1) as Step;
}
function nextStep(step: Step): Step {
  if (step === '6a') return '6b';
  if (step === '6b') return 7;
  const n = step as number;
  return (n + 1) as Step;
}

// ---- DraggableChip ----
function DraggableChip({ name, highlight, disabled, onTap }: {
  name: string; highlight?: boolean; disabled?: boolean; onTap?: () => void;
}) {
  const chip = CHIP_MAP[name];
  const dragOccurred = useRef(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: name, disabled, data: { chipName: name },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ touchAction: 'none', opacity: isDragging ? 0.3 : 1 }}
      className={highlight ? 'ring-2 ring-[#d4af37] ring-offset-2 ring-offset-[#0d3320] rounded-full' : ''}
      onPointerDown={() => { dragOccurred.current = false; }}
      onClick={() => { if (!dragOccurred.current && onTap) onTap(); }}
    >
      <ChipBadge
        name={name} chipType={chip.type}
        imageUrl={chip.imageUrl} imageScale={chip.imageScale} imageOffsetY={chip.imageOffsetY}
        pointValue={chip.point} size={64} showLabel
      />
    </div>
  );
}

// ---- DroppableZone ----
function DroppableZone({ id, children, className, active }: {
  id: string; children: React.ReactNode; className?: string; active?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} transition-all ${active ? 'ring-1 ring-green-700' : ''} ${isOver ? 'ring-2 ring-[#d4af37]' : ''}`}
    >
      {children}
    </div>
  );
}

// ---- スコアパネル（実際のゲームUIに合わせる） ----
function PlayerPanel({ label, chips, score, isDndTarget, isDragging }: {
  label: string; chips: typeof CHIPS; score: number;
  isDndTarget?: boolean; isDragging?: boolean;
}) {
  const positiveSum = chips.filter(c => c.type === 'positive').reduce((s, c) => s + c.point, 0);
  const negativeSum = chips.filter(c => c.type === 'negative').reduce((s, c) => s + c.point, 0);

  return (
    <DroppableZone id={label === 'あなた' ? 'you' : 'cpu'} active={isDragging}
      className="card-casino !p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-semibold text-lg">{label}</span>
        <div className="text-right shrink-0 ml-2">
          <span className={`font-bold text-2xl tabular-nums ${score > 0 ? 'text-[#d4af37]' : score < 0 ? 'text-red-400' : 'text-white'}`}>
            {scoreLabel(score)}
          </span>
          {(positiveSum > 0 || negativeSum > 0) && (
            <p className="text-green-600 text-xs">+{positiveSum} / -{negativeSum}</p>
          )}
        </div>
      </div>
      {chips.length === 0 ? (
        <p className="text-green-800 text-sm">チップなし</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {chips.map(c => (
            <ChipBadge key={c.name} name={c.name} chipType={c.type}
              imageUrl={c.imageUrl} imageScale={c.imageScale} imageOffsetY={c.imageOffsetY}
              pointValue={c.point} size={64} showLabel />
          ))}
        </div>
      )}
      {isDndTarget && (
        <p className="text-[#d4af37] text-xs mt-2 animate-pulse text-center">👆 ここへドロップ</p>
      )}
    </DroppableZone>
  );
}

// ---- ステップドット ----
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex justify-center gap-1.5 mb-3">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`rounded-full transition-all duration-300 ${
          i + 1 === current ? 'w-3 h-3 bg-[#d4af37]' : i + 1 < current ? 'w-2 h-2 bg-green-600' : 'w-2 h-2 bg-green-800'
        }`} />
      ))}
    </div>
  );
}

// ---- メイン ----
export default function DemoSetupClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [chipOwners, setChipOwners] = useState<ChipOwners>(STEP_STATES['1']);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [dragActive, setDragActive] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => { setErrorMsg(null); }, [step]);

  const isDndStep = !!DND_RULES[String(step)];
  const rule = DND_RULES[String(step)];
  const showScores = dotIndex(step) >= 4;

  function goNext() {
    const ns = nextStep(step);
    setStep(ns);
    setChipOwners(STEP_STATES[String(ns)]);
  }
  function goBack() {
    if (step === 1) { router.push('/'); return; }
    const ps = prevStep(step);
    setStep(ps);
    setChipOwners(STEP_STATES[String(ps)]);
    setShowResult(false);
  }

  function handleDragStart(e: DragStartEvent) {
    setDragActive(e.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragActive(null);
    const { active, over } = event;
    if (!over || !rule) return;
    const chipName = active.id as string;
    const zone = over.id as Owner;
    if (chipOwners[chipName] !== 'field') return;
    if (chipName !== rule.chip || zone !== rule.target) {
      setErrorMsg(rule.error);
      return;
    }
    const newOwners = { ...chipOwners, [chipName]: zone };
    setChipOwners(newOwners);
    setErrorMsg(null);
    // 6aが完了したら即座に6bへ（チップ配置を6bの初期値に設定してからステップ進む）
    setTimeout(() => setStep(s => nextStep(s)), 600);
  }

  // ---- ゲームボード ----
  const fieldChips = CHIPS.filter(c => chipOwners[c.name] === 'field');
  const youChips   = CHIPS.filter(c => chipOwners[c.name] === 'you');
  const cpuChips   = CHIPS.filter(c => chipOwners[c.name] === 'cpu');
  const youScore   = calcScore(chipOwners, 'you');
  const cpuScore   = calcScore(chipOwners, 'cpu');

  // スコア順ソート（実際のゲームと同じ）
  const playerPanels = [
    { label: 'あなた', chips: youChips, score: youScore },
    { label: 'CPU',   chips: cpuChips, score: cpuScore },
  ].sort((a, b) => b.score - a.score);

  const STEP_TEXT: Record<string, React.ReactNode> = {
    '1': <p className="text-green-100 text-base leading-relaxed">ChipGolfは実際のゴルフ場で仲間と楽しむアプリです ⛳</p>,
    '2': <p className="text-green-100 text-base leading-relaxed">チップに対応するイベントが発生したら、そのチップをイベントを起こした人のゾーンに移動します</p>,
    '3': (
      <div className="space-y-1">
        <p className="text-green-100 text-base leading-relaxed">例えば、あなたがパーを取りました 👏</p>
        <p className="text-[#d4af37] text-sm font-semibold">パーのチップを「あなた」のゾーンへ移動させてください</p>
        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
      </div>
    ),
    '4': (
      <div className="space-y-1">
        <p className="text-green-100 text-base leading-relaxed">次はCPUがOBを打ってしまいました 😱</p>
        <p className="text-[#d4af37] text-sm font-semibold">OBチップを「CPU」のゾーンへ移動させてください</p>
        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
      </div>
    ),
    '5': (
      <div className="space-y-1">
        <p className="text-green-100 text-base leading-relaxed">バーディーが出ました！ 🎉</p>
        <p className="text-[#d4af37] text-sm font-semibold">バーディーのチップを「あなた」のゾーンへ移動させてください</p>
        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
      </div>
    ),
    '6a': (
      <div className="space-y-1">
        <p className="text-green-100 text-base leading-relaxed">3パットしてしまいました 😓</p>
        <p className="text-[#d4af37] text-sm font-semibold">3パットのチップを「CPU」のゾーンへ移動させてください</p>
        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
      </div>
    ),
    '6b': (
      <div className="space-y-1">
        <p className="text-green-100 text-base leading-relaxed">1パットを決めました！ 🎯</p>
        <p className="text-[#d4af37] text-sm font-semibold">1パットのチップを「あなた」のゾーンへ移動させてください</p>
        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
      </div>
    ),
    '7': (
      <div className="space-y-1">
        <p className="text-green-100 text-base leading-relaxed">次のホールでCPUがパーを取りました</p>
        <p className="text-[#d4af37] text-sm font-semibold">パーチップを「CPU」のゾーンへ移動させてください</p>
        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
      </div>
    ),
    '8': (
      <div className="space-y-2">
        <p className="text-green-100 text-base leading-relaxed">こうしてイベントごとにチップが行き来し、最終的なチップ合計点数で勝負が決まります</p>
        <div className="text-sm space-y-0.5">
          <p className="text-[#d4af37]">✅ ポジティブチップ：獲得点数分プラス</p>
          <p className="text-red-400">❌ ネガティブチップ：獲得点数分マイナス</p>
        </div>
      </div>
    ),
    '9': (
      <div className="space-y-2">
        <p className="text-green-100 text-base leading-relaxed">
          プレイする全員がアプリを入れれば、それぞれのスマホで<span className="text-[#d4af37] font-semibold">リアルタイムに状況確認＆チップ操作</span>ができます 📱
        </p>
        <div className="flex justify-center gap-4 py-1">
          {['Aさん', 'Bさん', 'Cさん'].map(n => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div className="w-10 h-16 rounded-xl bg-[#145a32] border border-green-600 flex items-center justify-center text-lg">📱</div>
              <span className="text-green-400 text-xs">{n}</span>
            </div>
          ))}
        </div>
        <p className="text-green-300 text-sm text-center">チップを動かすのも誰でもOK 👆</p>
      </div>
    ),
    '10': (
      <div className="space-y-1">
        <p className="text-green-100 text-base leading-relaxed font-semibold">ゲームが終わったら「ゲーム終了」ボタンを押しましょう</p>
        <p className="text-green-300 text-sm">最終順位が表示されます 🏆</p>
      </div>
    ),
  };

  const dragActiveChip = dragActive ? CHIP_MAP[dragActive] : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      autoScroll={false}
    >
      <div className="fixed inset-0 flex flex-col max-w-md mx-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="fixed inset-0 bg-black/30 pointer-events-none" />

        {/* ゲームボード */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-3 relative z-0">
          {/* 場のチップ */}
          <DroppableZone id="field" active={!!dragActive} className="card-casino !p-3">
            <p className="text-[#d4af37] font-semibold text-base mb-2">場のチップ</p>
            {fieldChips.length === 0
              ? <p className="text-green-700 text-sm text-center py-1">すべて配布済み</p>
              : <div className="flex flex-wrap gap-2">
                  {fieldChips.map(c => (
                    <DraggableChip
                      key={c.name} name={c.name}
                      highlight={rule?.chip === c.name}
                      disabled={!isDndStep || rule?.chip !== c.name}
                    />
                  ))}
                </div>
            }
          </DroppableZone>

          {/* プレイヤーパネル（スコア順） */}
          {playerPanels.map(({ label, chips, score }) => (
            <PlayerPanel
              key={label}
              label={label}
              chips={chips}
              score={showScores ? score : 0}
              isDndTarget={isDndStep && rule?.target === (label === 'あなた' ? 'you' : 'cpu')}
              isDragging={!!dragActive}
            />
          ))}
        </div>

        {/* チュートリアルモーダル */}
        <div className="relative z-10 bg-[#0d3320] border-t border-green-700 rounded-t-2xl px-5 pt-4 pb-5 shadow-2xl">
          <StepDots current={dotIndex(step)} total={TOTAL_DOTS} />

          <div className="min-h-[72px] mb-3">
            {STEP_TEXT[String(step)]}
          </div>

          {isDndStep ? (
            <div className="space-y-2">
              <p className="text-center text-green-600 text-sm">↑ チップをドラッグして移動してみましょう</p>
              <button onClick={goBack} className="w-full py-2 text-green-500 text-sm text-center hover:text-green-300 transition-colors">← 戻る</button>
            </div>
          ) : step === 10 ? (
            <div className="space-y-2">
              <button onClick={() => setShowResult(true)} className="w-full py-3 rounded-lg bg-red-800 text-white font-bold hover:bg-red-700 transition-colors">
                ゲーム終了
              </button>
              <button onClick={goBack} className="w-full py-2 text-green-500 text-sm text-center hover:text-green-300 transition-colors">← 戻る</button>
            </div>
          ) : (
            <div className="space-y-2">
              <button onClick={goNext} className="btn-gold w-full py-3 text-base">次へ</button>
              <button onClick={goBack} className="w-full py-2 text-green-500 text-sm text-center hover:text-green-300 transition-colors">← 戻る</button>
            </div>
          )}
        </div>
      </div>

      {/* DragOverlay */}
      <DragOverlay dropAnimation={null}>
        {dragActiveChip && (
          <div style={{ filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.6))', opacity: 0.9 }}>
            <ChipBadge
              name={dragActiveChip.name} chipType={dragActiveChip.type}
              imageUrl={dragActiveChip.imageUrl} imageScale={dragActiveChip.imageScale}
              imageOffsetY={dragActiveChip.imageOffsetY} pointValue={dragActiveChip.point}
              size={80} showLabel={false}
            />
          </div>
        )}
      </DragOverlay>

      {/* リザルトモーダル */}
      {showResult && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0d3320] border border-green-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🏆</div>
              <h2 className="text-[#d4af37] font-bold text-xl">最終結果</h2>
            </div>
            <div className="space-y-3 mb-5">
              {[
                { name: 'あなた', score: youScore },
                { name: 'CPU',   score: cpuScore },
              ].sort((a, b) => b.score - a.score).map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 bg-[#145a32] rounded-xl p-3">
                  <span className="text-2xl">{['🥇','🥈'][i]}</span>
                  <span className="flex-1 text-white font-semibold">{p.name}</span>
                  <span className={`font-bold text-xl tabular-nums ${p.score > 0 ? 'text-[#d4af37]' : p.score < 0 ? 'text-red-400' : 'text-white'}`}>
                    {scoreLabel(p.score)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <button onClick={() => router.push('/game/new')} className="btn-gold w-full py-3 text-base">ゲームを作成する</button>
              <button onClick={() => router.push('/')} className="w-full text-green-400 text-sm py-2 text-center">← トップに戻る</button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}
