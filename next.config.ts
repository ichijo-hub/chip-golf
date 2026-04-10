import type { NextConfig } from "next";

// NEXT_EXPORT=1 のときのみ静的エクスポート（Capacitor モバイルビルド用）
// Vercel デプロイ時は SSR で動的ルートをネイティブに処理する
const nextConfig: NextConfig = {
  ...(process.env.NEXT_EXPORT === '1' && { output: 'export' }),
  trailingSlash: true,
  images: { unoptimized: true },
  allowedDevOrigins: ['192.168.188.124'],
};

export default nextConfig;
