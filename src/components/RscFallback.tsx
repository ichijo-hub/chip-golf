'use client';
import { useEffect } from 'react';

/**
 * Capacitor (static export) 向け RSC ペイロードフォールバック
 *
 * next build では generateStaticParams が返した __placeholder__ 分しか
 * RSC ペイロード (.txt) が生成されない。
 * 実際の roomCode (例: ABCDEF) で router.push すると
 * /game/ABCDEF/lobby/*.txt が 404 → Next.js がハードナビ → ホームに戻る。
 *
 * window.fetch を intercept して:
 *   1. /game/{realCode}/{page}/*.txt → /game/__placeholder__/{page}/*.txt に差し替え
 *   2. レスポンスボディ内の "__placeholder__" を realCode に置換して返す
 * これにより useParams() が正しい roomCode を返す。
 */
export default function RscFallback() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const origFetch = window.fetch.bind(window);

    window.fetch = function (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      // RSC ペイロードパターン:
      // /game/{ROOMCODE}/{page}/*.txt (index.txt, __next._full.txt, etc.)
      // __placeholder__ で始まるパスはスキップ
      const m = url.match(
        /(.*\/game\/)([A-Z0-9]+)(\/(?:lobby|play|result|chips)\/[^?#]*\.txt)/i,
      );

      if (m && !/^__/.test(m[2])) {
        const realCode = m[2].toUpperCase();
        const fallbackUrl = `${m[1]}__placeholder__${m[3]}`;

        return origFetch(fallbackUrl, init).then(async (res) => {
          if (!res.ok) return res;
          const text = await res.text();
          // __placeholder__ を実際の roomCode に置換
          const patched = text.split('__placeholder__').join(realCode);
          return new Response(patched, {
            status: res.status,
            statusText: res.statusText,
            headers: new Headers(res.headers),
          });
        });
      }

      return origFetch(input, init);
    };

    return () => {
      window.fetch = origFetch;
    };
  }, []);

  return null;
}
