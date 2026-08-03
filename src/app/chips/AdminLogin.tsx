'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { verifyAdminPin } from './actions';
import { useT } from '@/lib/i18n';

export default function AdminLogin() {
  const { t } = useT();
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
        setError(t.admin.invalidPin);
        setPin('');
      }
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card-casino w-full max-w-xs">
        <h1 className="text-[#d4af37] font-bold text-xl mb-1 text-center">{t.admin.title}</h1>
        <p className="text-green-600 text-sm text-center mb-6">{t.admin.description}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder={t.admin.pinPlaceholder}
            inputMode="numeric"
            autoFocus
            className="w-full bg-[#145a32] border border-green-700 rounded-lg px-4 py-3
                       text-white placeholder-green-600 focus:outline-none focus:border-[#d4af37]
                       text-center text-2xl tracking-widest"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" disabled={!pin || isPending} className="btn-gold w-full py-3">
            {isPending ? t.admin.verifying : t.admin.verify}
          </button>
        </form>
      </div>
    </main>
  );
}
