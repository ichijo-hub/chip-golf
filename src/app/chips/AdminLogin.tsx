'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { verifyAdminPin } from './actions';

export default function AdminLogin() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const ok = await verifyAdminPin(pin);
      if (ok) {
        router.refresh();
      } else {
        setError('PINが違います');
        setPin('');
      }
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card-casino w-full max-w-xs">
        <h1 className="text-[#d4af37] font-bold text-xl mb-1 text-center">管理者認証</h1>
        <p className="text-green-600 text-sm text-center mb-6">チップ管理にはPINが必要です</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="PIN を入力"
            inputMode="numeric"
            autoFocus
            className="w-full bg-[#145a32] border border-green-700 rounded-lg px-4 py-3
                       text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37]
                       text-center text-2xl tracking-widest"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" disabled={!pin || isPending} className="btn-gold w-full py-3">
            {isPending ? '確認中...' : '認証'}
          </button>
        </form>
      </div>
    </main>
  );
}
