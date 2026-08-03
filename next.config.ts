import type { NextConfig } from "next";

// NEXT_EXPORT=1 のときのみ静的エクスポート（Capacitor モバイルビルド用）
// Vercel デプロイ時は SSR で動的ルートをネイティブに処理する
const isStaticExport = process.env.NEXT_EXPORT === '1';

const nextConfig: NextConfig = {
  ...(isStaticExport && { output: 'export' }),
  trailingSlash: true,
  images: { unoptimized: true },
  allowedDevOrigins: ['192.168.188.124', '127.0.0.1'],
  // headers() は静的エクスポート時には機能しないため SSR モードのみ追加
  ...(!isStaticExport && {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            {
              key: 'Content-Security-Policy',
              // script-src: Next.js はインラインスクリプトを使用するため unsafe-inline が必要
              // img-src: Firebase Storage の画像を許可
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://chip-golf.firebasestorage.app",
                "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com https://fcm.googleapis.com",
                "frame-src 'none'",
                "object-src 'none'",
              ].join('; '),
            },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;
