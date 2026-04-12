'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { initDemoState } from '@/lib/demo/initDemoState';

const CPU_OPTIONS = [1, 2, 3] as const;

export default function DemoSetupClient() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [cpuCount, setCpuCount] = useState<1 | 2 | 3>(1);

  function handleStart() {
    const state = initDemoState(playerName, cpuCount);
    sessionStorage.setItem('demoState', JSON.stringify(state));
    router.push('/demo/play');
  }

  return (
    <main className="min-h-screen p-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}>
      <div className="max-w-md mx-auto">
        <div className="flex flex-col items-center mb-8">
          <Logo size="md" />
        </div>

        <div className="card-casino mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🎮</span>
            <h1 className="text-[#d4af37] font-bold text-xl">デモモード</h1>
          </div>
          <p className="text-green-400 text-sm mb-1">
            Firebase不要で今すぐ試せます。
          </p>
          <p className="text-green-600 text-xs">
            CPUプレイヤーと一緒に遊んでルールを体験しましょう。
          </p>
        </div>

        <div className="card-casino mb-4">
          <label className="block text-[#d4af37] font-semibold text-sm mb-2">
            あなたの名前（任意）
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="あなた"
            maxLength={20}
            className="w-full bg-[#145a32] border border-green-700 rounded-lg px-3 py-2.5
                       text-white placeholder-green-600 text-base
                       focus:outline-none focus:border-[#d4af37]"
          />
        </div>

        <div className="card-casino mb-6">
          <p className="text-[#d4af37] font-semibold text-sm mb-3">CPUプレイヤー人数</p>
          <div className="flex gap-2">
            {CPU_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setCpuCount(n)}
                className={`flex-1 py-3 rounded-lg font-bold text-lg transition-all border
                  ${cpuCount === n
                    ? 'bg-[#d4af37] text-[#1a1a1a] border-[#f0c040]'
                    : 'bg-[#145a32] text-green-300 border-green-700 hover:border-green-500'
                  }`}
              >
                {n}人
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          className="btn-gold w-full py-4 text-lg mb-4"
        >
          🎮 デモを開始
        </button>

        <button
          onClick={() => router.push('/')}
          className="w-full py-3 rounded-lg border border-green-700 text-green-400
                     hover:border-green-500 transition-colors text-sm text-center"
        >
          ← トップに戻る
        </button>
      </div>
    </main>
  );
}
