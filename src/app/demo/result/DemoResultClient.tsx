'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DemoState } from '@/lib/demo/initDemoState';
import { calculateScores, PlayerScore } from '@/lib/scoring';
import ChipBadge from '@/components/ChipBadge';
import LangToggle from '@/components/LangToggle';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function DemoResultClient() {
  const router = useRouter();
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem('demoState');
    if (!raw) {
      router.push('/demo');
      return;
    }
    const state = JSON.parse(raw) as DemoState;
    setScores(calculateScores(state.players, state.chipStates, state.chipDefs));
    setLoading(false);
  }, [router]);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-green-400">読み込み中...</p></main>;
  }

  return (
    <main className="min-h-screen p-4 pb-24" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
      <div className="max-w-md mx-auto">
        <div className="flex justify-end pt-4 mb-2">
          <LangToggle />
        </div>

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-3xl font-bold text-[#d4af37]">デモ結果</h1>
          <p className="text-green-500 text-sm mt-1 flex items-center justify-center gap-1">
            <span className="bg-green-900 text-green-400 px-2 py-0.5 rounded-full border border-green-700 text-xs">🎮 デモ</span>
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {scores.map(({ player, positivePoints, negativePoints, netScore, chips }, i) => (
            <div key={player.id} className="card-casino">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl w-10 text-center">{MEDALS[i] ?? '😢'}</span>
                <span className="text-white font-bold text-lg flex-1">{player.name}</span>
                <span className={`text-2xl font-bold ${netScore > 0 ? 'text-[#d4af37]' : netScore < 0 ? 'text-red-400' : 'text-white'}`}>
                  {netScore > 0 ? `+${netScore}` : netScore}
                </span>
              </div>
              <div className="flex gap-3 text-xs text-green-500 mb-2 ml-13">
                <span>ポジティブ <span className="text-green-300">+{positivePoints}</span></span>
                <span>ネガティブ <span className="text-red-300">-{negativePoints}</span></span>
              </div>
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {chips.map((chipDef, j) => (
                    <ChipBadge
                      key={j}
                      name={chipDef.name}
                      chipType={chipDef.chip_type}
                      imageUrl={chipDef.image_url}
                      imageScale={chipDef.image_scale ?? undefined}
                      imageOffsetY={chipDef.image_offset_y ?? undefined}
                      pointValue={chipDef.point_value}
                      size={48}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/game/new')}
            className="btn-gold w-full py-4 text-lg"
          >
            🎮 実際にゲームを作成する
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem('demoState');
              router.push('/demo');
            }}
            className="w-full py-3 rounded-lg border border-green-700 text-green-300
                       hover:border-green-500 transition-colors text-base"
          >
            もう一度デモで遊ぶ
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-lg border border-green-800 text-green-600
                       hover:border-green-700 hover:text-green-400 transition-colors text-sm"
          >
            トップに戻る
          </button>
        </div>
      </div>
    </main>
  );
}
