'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';

/**
 * オフライン中であることを画面上部に表示する。
 * Firestore は永続キャッシュを持つため圏外でも画面は出るが、書き込みは接続が戻るまで
 * サーバーに届かない。全員でスコアを共有するアプリなので「今ズレているかもしれない」が
 * 見えないと危険なため、明示する。
 *
 * navigator.onLine は端末がネットワークに繋がっているかしか見ておらず、
 * Firestore がサーバーに到達できているかとは別物である点に注意。
 */
export default function OfflineIndicator() {
  const { t } = useT();
  // SSR とハイドレーション直後は false 固定にし、マウント後に実際の状態を反映する
  const [offline, setOffline] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  // 各画面のヘッダーは #scroll-root（スクロールコンテナ）内の sticky top-0 なので、
  // バーを固定表示するだけだとヘッダーを覆って「ゲーム終了」やメニューが押せなくなる。
  // スクロールコンテナ側に実測ぶんの padding-top を入れて、ヘッダーをバーの下に押し出す。
  useLayoutEffect(() => {
    const root = document.getElementById('scroll-root');
    if (!root) return;
    if (!offline) {
      root.style.paddingTop = '';
      return;
    }
    const apply = () => {
      root.style.paddingTop = `${barRef.current?.offsetHeight ?? 0}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    if (barRef.current) ro.observe(barRef.current);
    return () => {
      ro.disconnect();
      root.style.paddingTop = '';
    };
  }, [offline]);

  if (!offline) return null;

  return (
    <div
      ref={barRef}
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-30 bg-[#4a3a10] border-b border-[#d4af37]/50 px-3 text-center"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)', paddingBottom: '6px' }}
    >
      <p className="text-sm font-bold text-[#f0c040]">📡 {t.common.offline}</p>
      <p className="text-xs text-[#f0c040]/80">{t.common.offlineDetail}</p>
    </div>
  );
}
