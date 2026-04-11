'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * ページ遷移時にbodyのスクロール位置をリセットする。
 * html{overflow:hidden} + body{overflow-y:auto} 構成では
 * Next.jsの自動スクロールリセットが効かないため手動で対処。
 */
export default function ScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    document.getElementById('scroll-root')?.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
