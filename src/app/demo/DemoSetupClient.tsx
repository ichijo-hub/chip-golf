'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import ChipBadge from '@/components/ChipBadge';

// ---- 型定義 ----
type Owner = 'field' | 'you' | 'cpu';
type ChipOwners = Record<string, Owner>;

const CHIPS = [
  { name: 'パー', type: 'positive' },
  { name: 'バーディー', type: 'positive' },
  { name: 'チップイン', type: 'positive' },
  { name: '1パット', type: 'positive' },
  { name: 'OB', type: 'negative' },
  { name: '3パット', type: 'negative' },
] as const;

const POSITIVE_CHIPS = ['パー', 'バーディー', '1パット', 'チップイン'];
const NEGATIVE_CHIPS = ['OB', '3パット'];

function calcScore(chipOwners: ChipOwners, owner: 'you' | 'cpu'): number {
  return Object.entries(chipOwners).reduce((sum, [name, o]) => {
    if (o !== owner) return sum;
    return sum + (POSITIVE_CHIPS.includes(name) ? 1 : -1);
  }, 0);
}

function getScoreLabel(score: number): string {
  if (score > 0) return `+${score}`;
  return String(score);
}

// ---- DraggableChip ----
function DraggableChip({
  name,
  type,
  highlight,
  disabled,
}: {
  name: string;
  type: 'positive' | 'negative';
  highlight?: boolean;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: name,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={highlight ? 'ring-2 ring-[#d4af37] ring-offset-2 ring-offset-[#0d3320] rounded-full' : ''}
    >
      <ChipBadge
        name={name}
        chipType={type}
        size={56}
        showLabel={true}
      />
    </div>
  );
}

// ---- DroppableZone ----
function DroppableZone({
  id,
  children,
  className,
}: {
  id: 'you' | 'cpu';
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} ${isOver ? 'ring-2 ring-[#d4af37]' : ''}`}
    >
      {children}
    </div>
  );
}

// ---- ゲームボード（背景） ----
function GameBoard({
  chipOwners,
  step,
  showScores,
}: {
  chipOwners: ChipOwners;
  step: number;
  showScores: boolean;
}) {
  const fieldChips = CHIPS.filter(c => chipOwners[c.name] === 'field');
  const youChips = CHIPS.filter(c => chipOwners[c.name] === 'you');
  const cpuChips = CHIPS.filter(c => chipOwners[c.name] === 'cpu');
  const youScore = calcScore(chipOwners, 'you');
  const cpuScore = calcScore(chipOwners, 'cpu');

  const isDndStep = step === 3 || step === 5;

  // Step3: パーをハイライト、Step5: バーディーをハイライト
  const highlightChip = step === 3 ? 'パー' : step === 5 ? 'バーディー' : null;

  return (
    <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-3 max-w-md mx-auto w-full">
      {/* 場のチップ */}
      <div className="bg-[#145a32]/80 rounded-xl p-3 border border-green-800">
        <p className="text-[#d4af37] font-semibold text-sm mb-2">場のチップ</p>
        {fieldChips.length === 0 ? (
          <p className="text-green-700 text-xs text-center py-1">すべて配布済み</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {fieldChips.map(chip => (
              <DraggableChip
                key={chip.name}
                name={chip.name}
                type={chip.type}
                highlight={highlightChip === chip.name}
                disabled={!isDndStep}
              />
            ))}
          </div>
        )}
      </div>

      {/* あなたゾーン */}
      <DroppableZone
        id="you"
        className="w-full bg-[#145a32]/80 rounded-xl p-3 border border-green-800 transition-all"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-white font-semibold text-sm">
            あなた
            {showScores && (
              <span className={`ml-2 font-bold ${youScore > 0 ? 'text-[#d4af37]' : youScore < 0 ? 'text-red-400' : 'text-white'}`}>
                {getScoreLabel(youScore)}
              </span>
            )}
          </p>
          {isDndStep && (
            <span className="text-[#d4af37] text-xs animate-pulse">👈 ここへドロップ</span>
          )}
        </div>
        {youChips.length === 0 ? (
          <p className="text-green-700 text-xs">チップなし</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {youChips.map(chip => (
              <ChipBadge
                key={chip.name}
                name={chip.name}
                chipType={chip.type}
                size={56}
                showLabel={true}
              />
            ))}
          </div>
        )}
      </DroppableZone>

      {/* CPUゾーン */}
      <DroppableZone
        id="cpu"
        className="w-full bg-[#145a32]/80 rounded-xl p-3 border border-green-800 transition-all"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-white font-semibold text-sm">
            CPU
            {showScores && (
              <span className={`ml-2 font-bold ${cpuScore > 0 ? 'text-[#d4af37]' : cpuScore < 0 ? 'text-red-400' : 'text-white'}`}>
                {getScoreLabel(cpuScore)}
              </span>
            )}
          </p>
        </div>
        {cpuChips.length === 0 ? (
          <p className="text-green-700 text-xs">チップなし</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {cpuChips.map(chip => (
              <ChipBadge
                key={chip.name}
                name={chip.name}
                chipType={chip.type}
                size={56}
                showLabel={true}
              />
            ))}
          </div>
        )}
      </DroppableZone>
    </div>
  );
}

// ---- ステップインジケーター ----
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex justify-center gap-1.5 mb-4">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i + 1 === current
              ? 'w-3 h-3 bg-[#d4af37]'
              : i + 1 < current
              ? 'w-2 h-2 bg-green-600'
              : 'w-2 h-2 bg-green-800'
          }`}
        />
      ))}
    </div>
  );
}

// ---- メインコンポーネント ----
export default function DemoSetupClient() {
  const router = useRouter();
  const TOTAL_STEPS = 9;

  const [step, setStep] = useState(1);
  const [chipOwners, setChipOwners] = useState<ChipOwners>({
    'パー': 'field',
    'バーディー': 'field',
    'OB': 'field',
    '1パット': 'field',
    '3パット': 'field',
    'チップイン': 'field',
  });
  const [nextBtnVisible, setNextBtnVisible] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
  );

  // Step 4: OB → CPU 自動移動
  useEffect(() => {
    if (step !== 4) return;
    setNextBtnVisible(false);
    const t1 = setTimeout(() => {
      setChipOwners(prev => ({ ...prev, 'OB': 'cpu' }));
      const t2 = setTimeout(() => setStep(5), 1500);
      return () => clearTimeout(t2);
    }, 1000);
    return () => clearTimeout(t1);
  }, [step]);

  // Step 6: 3パット→CPU, 1パット→you を自動移動
  useEffect(() => {
    if (step !== 6) return;
    setNextBtnVisible(false);
    const t1 = setTimeout(() => {
      setChipOwners(prev => ({ ...prev, '3パット': 'cpu' }));
    }, 1000);
    const t2 = setTimeout(() => {
      setChipOwners(prev => ({ ...prev, '1パット': 'you' }));
    }, 2000);
    const t3 = setTimeout(() => {
      setNextBtnVisible(true);
    }, 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [step]);

  // Step 7: パー → CPU 自動移動
  useEffect(() => {
    if (step !== 7) return;
    setNextBtnVisible(false);
    const t1 = setTimeout(() => {
      setChipOwners(prev => ({ ...prev, 'パー': 'cpu' }));
      const t2 = setTimeout(() => setStep(8), 1500);
      return () => clearTimeout(t2);
    }, 1000);
    return () => clearTimeout(t1);
  }, [step]);

  // ステップ変更時にnextBtnをリセット（自動アニメーションステップ以外）
  useEffect(() => {
    if (step !== 4 && step !== 6 && step !== 7) {
      setNextBtnVisible(true);
    }
    setErrorMsg(null);
  }, [step]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const chipName = active.id as string;
    const targetZone = over.id as 'you' | 'cpu';

    // 場にあるチップのみ受け付ける
    if (chipOwners[chipName] !== 'field') return;

    if (step === 3) {
      if (chipName !== 'パー' || targetZone !== 'you') {
        setErrorMsg('パーのチップを「あなた」のゾーンへ移動してください');
        return;
      }
      setChipOwners(prev => ({ ...prev, 'パー': 'you' }));
      setErrorMsg(null);
      setTimeout(() => setStep(4), 600);
    } else if (step === 5) {
      if (chipName !== 'バーディー' || targetZone !== 'you') {
        setErrorMsg('バーディーのチップを「あなた」のゾーンへ移動してください');
        return;
      }
      setChipOwners(prev => ({ ...prev, 'バーディー': 'you' }));
      setErrorMsg(null);
      setTimeout(() => setStep(6), 600);
    }
  }

  const showScores = step >= 8;

  const STEP_TEXT: Record<number, React.ReactNode> = {
    1: (
      <p className="text-green-100 text-base leading-relaxed">
        ChipGolfは実際のゴルフ場で仲間と楽しむアプリです ⛳
      </p>
    ),
    2: (
      <p className="text-green-100 text-base leading-relaxed">
        チップに対応するイベントが発生したら、そのチップをイベントを起こした人のゾーンに移動します
      </p>
    ),
    3: (
      <div className="space-y-2">
        <p className="text-green-100 text-base leading-relaxed">
          例えば、あなたがパーを取りました 👏
        </p>
        <p className="text-[#d4af37] text-sm font-semibold">
          パーのチップを「あなた」のゾーンへ移動させてください
        </p>
        {errorMsg && (
          <p className="text-red-400 text-sm">{errorMsg}</p>
        )}
      </div>
    ),
    4: (
      <div className="space-y-2">
        <p className="text-green-100 text-base leading-relaxed">
          グッド！ 次はCPUがOBを打ってしまいました 😱
        </p>
        <p className="text-green-400 text-sm">OBチップが自動でCPUのゾーンへ移動します</p>
      </div>
    ),
    5: (
      <div className="space-y-2">
        <p className="text-green-100 text-base leading-relaxed">
          今度はバーディーが出ました！ 🎉
        </p>
        <p className="text-[#d4af37] text-sm font-semibold">
          バーディーのチップを「あなた」のゾーンへ移動させてください
        </p>
        {errorMsg && (
          <p className="text-red-400 text-sm">{errorMsg}</p>
        )}
      </div>
    ),
    6: (
      <div className="space-y-2">
        <p className="text-green-100 text-base leading-relaxed">
          3パットしてしまったのでCPUへ、1パットを決めたのでもう1枚あなたへ 🏌️
        </p>
        <p className="text-green-400 text-sm">チップが自動で移動します</p>
      </div>
    ),
    7: (
      <div className="space-y-2">
        <p className="text-green-100 text-base leading-relaxed">
          次のホールでCPUがパーを取りました
        </p>
        <p className="text-green-400 text-sm">パーチップが「あなた」から「CPU」へ移動します</p>
      </div>
    ),
    8: (
      <div className="space-y-2">
        <p className="text-green-100 text-base leading-relaxed">
          こうしてイベントごとにチップが行き来し、最終的なチップ合計点数で勝負が決まります
        </p>
        <div className="text-sm space-y-1">
          <p className="text-[#d4af37]">✅ ポジティブチップ（金色）：+1点</p>
          <p className="text-red-400">❌ ネガティブチップ（赤）：-1点</p>
        </div>
      </div>
    ),
    9: (
      <div className="space-y-2">
        <p className="text-green-100 text-base leading-relaxed font-semibold">
          ゲームが終わったら「ゲーム終了」ボタンを押しましょう
        </p>
        <p className="text-green-300 text-sm">すると最終順位が表示されます 🏆</p>
      </div>
    ),
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className="fixed inset-0 flex flex-col max-w-md mx-auto"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* オーバーレイ（モーダル背景を少し暗くするが、ボードは見える） */}
        <div className="fixed inset-0 bg-black/30 pointer-events-none" />

        {/* ゲームボード（背景スクロール可） */}
        <GameBoard
          chipOwners={chipOwners}
          step={step}
          showScores={showScores}
        />

        {/* チュートリアルモーダル（下部固定シート） */}
        <div className="relative z-10 bg-[#0d3320] border-t border-green-700 rounded-t-2xl p-5 shadow-2xl">
          <StepDots current={step} total={TOTAL_STEPS} />

          <div className="min-h-[80px] mb-4">
            {STEP_TEXT[step]}
          </div>

          {/* ボタンエリア */}
          {step === 3 || step === 5 ? (
            // DnDインタラクション待ち（ボタンなし）
            <div className="text-center text-green-600 text-sm py-2">
              ↑ チップをドラッグして移動してみましょう
            </div>
          ) : step === 9 ? (
            <div className="space-y-3">
              <button
                onClick={() => setShowResult(true)}
                className="w-full py-3 rounded-lg bg-red-800 text-white font-bold hover:bg-red-700 transition-colors"
              >
                ゲーム終了
              </button>
            </div>
          ) : nextBtnVisible ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="btn-gold w-full py-3 text-base"
            >
              次へ
            </button>
          ) : (
            // アニメーション中: 高さ確保
            <div className="h-12" />
          )}
        </div>
      </div>

      {/* リザルトモーダル */}
      {showResult && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0d3320] border border-green-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🏆</div>
              <h2 className="text-[#d4af37] font-bold text-xl">最終結果</h2>
            </div>
            {(() => {
              const youScore = calcScore(chipOwners, 'you');
              const cpuScore = calcScore(chipOwners, 'cpu');
              const players = [
                { name: 'あなた', score: youScore },
                { name: 'CPU', score: cpuScore },
              ].sort((a, b) => b.score - a.score);
              const medals = ['🥇', '🥈'];
              return (
                <div className="space-y-3 mb-6">
                  {players.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3 bg-[#145a32] rounded-xl p-3">
                      <span className="text-2xl">{medals[i]}</span>
                      <span className="flex-1 text-white font-semibold">{p.name}</span>
                      <span className={`font-bold text-lg ${p.score > 0 ? 'text-[#d4af37]' : p.score < 0 ? 'text-red-400' : 'text-white'}`}>
                        {p.score > 0 ? `+${p.score}` : p.score}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="space-y-3">
              <button onClick={() => router.push('/game/new')} className="btn-gold w-full py-3 text-base">
                ゲームを作成する
              </button>
              <button onClick={() => router.push('/')} className="w-full text-green-400 text-sm py-2 text-center">
                ← トップに戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}
