'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UniversalLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('appUrlOpen', (data: { url: string }) => {
          // https://chip-golf.vercel.app/game/ABC123/lobby?room=ABC123
          const url = new URL(data.url);
          const path = url.pathname + url.search;
          // 自ドメインの許可パスのみ受け入れる（オープンリダイレクト対策）
          if (/^\/(?:game\/|$)/.test(url.pathname)) {
            router.push(path);
          }
        });
        cleanup = () => handle.remove();
      } catch {
        // Web環境ではCapacitorが使えないため無視
      }
    };

    setup();
    return () => cleanup?.();
  }, [router]);

  return null;
}
