import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chip Golf',
    short_name: 'Chip Golf',
    description: 'ベガスゴルフ カジノチップゲーム',
    start_url: '/',
    display: 'standalone',
    background_color: '#145a32',
    theme_color: '#145a32',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
  };
}
