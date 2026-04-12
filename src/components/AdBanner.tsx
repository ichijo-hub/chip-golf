'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// テスト用バナー広告 ID（Google 公式）
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/2934735716';
const PROD_BANNER_ID = process.env.NEXT_PUBLIC_ADMOB_BANNER_ID ?? TEST_BANNER_ID;
const IS_DEV = process.env.NODE_ENV === 'development';

export default function AdBanner() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removed = false;

    async function showBanner() {
      try {
        const { AdMob, BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
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
      removed = true;
      if (!Capacitor.isNativePlatform()) return;
      import('@capacitor-community/admob').then(({ AdMob }) => {
        if (!removed) return;
        AdMob.removeBanner().catch(() => {});
      });
    };
  }, []);

  // ネイティブ以外では何も表示しない
  if (!Capacitor.isNativePlatform()) return null;

  // バナー分のスペース確保（高さ約60px）
  return <div style={{ height: 60 }} aria-hidden="true" />;
}
