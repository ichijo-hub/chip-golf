'use client';

import { useT } from '@/lib/i18n';

export default function LangToggle() {
  const { locale, setLocale } = useT();
  return (
    <button
      onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
      className="text-xs text-green-600 hover:text-green-400 transition-colors px-2 py-1 rounded border border-green-800 hover:border-green-600"
    >
      {locale === 'ja' ? 'EN' : 'JA'}
    </button>
  );
}
