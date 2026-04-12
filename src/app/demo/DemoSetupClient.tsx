'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

// ---- チップコンポーネント ----
function ChipToken({
  name,
  type,
  highlight,
  onTap,
  selected,
}: {
  name: string;
  type: 'positive' | 'negative';
  highlight?: boolean;
  onTap?: () => void;
  selected?: boolean;
}) {
  const base = type === 'positive' ? 'bg-[#d4af37] text-white' : 'bg-red-700 text-white';
  const ring = highlight || selected ? 'ring-2 ring-[#d4af37] ring-offset-2 ring-offset-[#0d3320]' : '';
  return (
    <button
      type="button"
      onClick={onTap}
      className={`
        w-14 h-14 rounded-full flex items-center justify-center
        text-xs font-bold text-center leading-tight
        transition-all duration-500 shrink-0
        ${base} ${ring}
        ${onTap ? 'active:scale-95' : ''}
        ${selected ? 'scale-110' : ''}
      `}
      style={{ minWidth: '3.5rem' }}
    >
      {name}
    </button>
  );
}

// ---- ゲームボード（背景） ----
function GameBoard({
  chipOwners,
  step,
  pendingTap,
  onChipTap,
  onZoneTap,
}: {
  chipOwners: ChipOwners;
  step: number;
  pendingTap: string | null;
  onChipTap: (name: string) => void;
  onZoneTap: (zone: 'you' | 'cpu') => void;
}) {
  const fieldChips = CHIPS.filter(c => chipOwners[c.name] === 'field');
  const youChips = CHIPS.filter(c => chipOwners[c.name] === 'you');
  const cpuChips = CHIPS.filter(c => chipOwners[c.name] === 'cpu');
  const youScore = calcScore(chipOwners, 'you');
  const cpuScore = calcScore(chipOwners, 'cpu');

  const isStep3 = step === 3;
  const showScores = step >= 7;

  const parChip = CHIPS.find(c => c.name === 'パー')!;
  const isParHighlighted = isStep3 && chipOwners['パー'] === 'field';
  const isYouZoneHighlighted = isStep3 && pendingTap === 'パー';

  return (
    <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-3 max-w-md mx-auto w-full">
      {/* 場のチップ */}
      <div className="bg-[#145a32]/80 rounded-xl p-3 border border-green-800">
        <p className="text-[#d4af37] font-semibold text-sm mb-2">場のチップ</p>
        {fieldChips.length === 0 ? (
          <p className="text-green-700 text-xs text-center py-1">すべて配布済み</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {fieldChips.map(chip => (
              <ChipToken
                key={chip.name}
                name={chip.name}
                type={chip.type}
                highlight={isStep3 && chip.name === 'パー'}
                selected={pendingTap === chip.name}
                onTap={
                  isStep3 && chip.name === 'パー'
                    ? () => onChipTap(chip.name)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* あなたゾーン */}
      <button
        type="button"
        onClick={() => isYouZoneHighlighted && onZoneTap('you')}
        className={`
          w-full bg-[#145a32]/80 rounded-xl p-3 border text-left transition-all
          ${isYouZoneHighlighted ? 'border-[#d4af37] ring-1 ring-[#d4af37]' : 'border-green-800'}
        `}
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
          {isYouZoneHighlighted && (
            <span className="text-[#d4af37] text-xs animate-pulse">👈 ここへ移動</span>
          )}
        </div>
        {youChips.length === 0 ? (
          <p className="text-green-700 text-xs">チップなし</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {youChips.map(chip => (
              <ChipToken key={chip.name} name={chip.name} type={chip.type} />
            ))}
          </div>
        )}
      </button>

      {/* CPUゾーン */}
      <div className="bg-[#145a32]/80 rounded-xl p-3 border border-green-800">
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
          <div className="flex flex-wrap gap-2">
            {cpuChips.map(chip => (
              <ChipToken key={chip.name} name={chip.name} type={chip.type} />
            ))}
          </div>
        )}
      </div>
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
  const TOTAL_STEPS = 8;

  const [step, setStep] = useState(1);
  const [chipOwners, setChipOwners] = useState<ChipOwners>({
    'パー': 'field',
    'バーディー': 'field',
    'OB': 'field',
    '1パット': 'field',
    '3パット': 'field',
    'チップイン': 'field',
  });
  const [pendingTap, setPendingTap] = useState<string | null>(null);
  const [nextBtnVisible, setNextBtnVisible] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Step 5: バーディー→あなた, 3パット→CPU を順番に自動移動
  useEffect(() => {
    if (step !== 5) return;
    setNextBtnVisible(false);
    const t1 = setTimeout(() => {
      setChipOwners(prev => ({ ...prev, 'バーディー': 'you' }));
    }, 1000);
    const t2 = setTimeout(() => {
      setChipOwners(prev => ({ ...prev, '3パット': 'cpu' }));
    }, 2500);
    const t3 = setTimeout(() => {
      setNextBtnVisible(true);
    }, 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [step]);

  // Step 6: パー → CPU 自動移動
  useEffect(() => {
    if (step !== 6) return;
    setNextBtnVisible(false);
    const t1 = setTimeout(() => {
      setChipOwners(prev => ({ ...prev, 'パー': 'cpu' }));
      const t2 = setTimeout(() => setStep(7), 1500);
      return () => clearTimeout(t2);
    }, 1000);
    return () => clearTimeout(t1);
  }, [step]);

  // ステップ変更時にnextBtnをリセット（Step 4,5,6以外）
  useEffect(() => {
    if (step !== 4 && step !== 5 && step !== 6) {
      setNextBtnVisible(true);
    }
    setErrorMsg(null);
    setPendingTap(null);
  }, [step]);

  function handleChipTap(name: string) {
    setPendingTap(name);
    setErrorMsg(null);
  }

  function handleZoneTap(zone: 'you' | 'cpu') {
    if (!pendingTap) return;
    if (step === 3) {
      if (zone === 'you') {
        setChipOwners(prev => ({ ...prev, [pendingTap]: 'you' }));
        setPendingTap(null);
        // 少し遅らせてからStep 4へ
        setTimeout(() => setStep(4), 600);
      } else {
        setErrorMsg('あなたのゾーンへ移動してください');
      }
    }
  }

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
          パーのチップを「あなた」のゾーンへ動かしてみてください
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
          このようにホールごとのイベントに応じてチップを移動させていきます
        </p>
        <p className="text-green-400 text-sm">続きを見てみましょう 👇</p>
      </div>
    ),
    6: (
      <div className="space-y-2">
        <p className="text-green-100 text-base leading-relaxed">
          次のホールでCPUがパーを取りました
        </p>
        <p className="text-green-400 text-sm">パーチップは「あなた」から「CPU」へ移動します</p>
      </div>
    ),
    7: (
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
    8: (
      <div className="space-y-2">
        <p className="text-green-100 text-base leading-relaxed font-semibold">
          運と実力が絡み合うChipGolf ⛳🎰
        </p>
        <p className="text-green-300 text-sm">次回のラウンドをもっと盛り上げよう！</p>
      </div>
    ),
  };

  return (
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
        pendingTap={pendingTap}
        onChipTap={handleChipTap}
        onZoneTap={handleZoneTap}
      />

      {/* チュートリアルモーダル（下部固定シート） */}
      <div className="relative z-10 bg-[#0d3320] border-t border-green-700 rounded-t-2xl p-5 shadow-2xl">
        <StepDots current={step} total={TOTAL_STEPS} />

        <div className="min-h-[80px] mb-4">
          {STEP_TEXT[step]}
        </div>

        {/* ボタンエリア */}
        {step === 3 ? (
          // Step 3: インタラクション待ち（ボタンなし）
          <div className="text-center text-green-600 text-sm py-2">
            ↑ チップをタップして操作してみましょう
          </div>
        ) : step === 8 ? (
          <div className="space-y-3">
            <button
              onClick={() => router.push('/game/new')}
              className="btn-gold w-full py-3 text-base"
            >
              ゲームを作成する
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full text-green-400 text-sm py-2 text-center hover:text-green-300 transition-colors"
            >
              ← トップに戻る
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
          // アニメーション中: 何も表示しない（高さ確保）
          <div className="h-12" />
        )}
      </div>
    </div>
  );
}
