'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/2934735716';
const PROD_BANNER_ID = process.env.NEXT_PUBLIC_ADMOB_BANNER_ID ?? TEST_BANNER_ID;
const IS_DEV = process.env.NODE_ENV === 'development';

export default function AdBanner() {
  // AdMob インスタンスをrefで保持し、クリーンアップで確実に参照できるようにする
  const adMobRef = useRef<{ removeBanner: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function showBanner() {
      try {
        const { AdMob, BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
        adMobRef.current = AdMob;
        await AdMob.initialize({ initializeForTesting: IS_DEV });
        await AdMob.showBanner({
          adId: IS_DEV ? TEST_BANNER_ID : PROD_BANNER_ID,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: IS_DEV,
        });
      } catch (e) {
        console.warn('[AdBanner] failed to show banner:', e);
      }
    }

    showBanner();

    return () => {
      // refに保存済みのインスタンスを使って同期的に呼べる（動的importの再待機不要）
      adMobRef.current?.removeBanner().catch(() => {});
    };
  }, []);

  if (!Capacitor.isNativePlatform()) return null;

  return <div style={{ height: 60 }} aria-hidden="true" />;
}
