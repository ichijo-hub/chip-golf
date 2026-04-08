'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ja, Translations } from './ja';
import { en } from './en';

type Locale = 'ja' | 'en';

const translations: Record<Locale, Translations> = { ja, en };

interface I18nContextType {
  t: Translations;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType>({
  t: ja,
  locale: 'ja',
  setLocale: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ja');

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null;
    if (saved && (saved === 'ja' || saved === 'en')) {
      setLocaleState(saved);
    } else {
      // ブラウザ言語から自動検出
      const browser = navigator.language.startsWith('ja') ? 'ja' : 'en';
      setLocaleState(browser);
    }
  }, []);

  function setLocale(locale: Locale) {
    localStorage.setItem('locale', locale);
    setLocaleState(locale);
  }

  return (
    <I18nContext.Provider value={{ t: translations[locale], locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
