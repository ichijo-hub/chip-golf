import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'チップゴルフ',
    short_name: 'チップゴルフ',
    description: 'ベガスゴルフ カジノチップゲーム',
    start_url: '/',
    display: 'standalone',
    background_color: '#145a32',
    theme_color: '#145a32',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png' },
    ],
  };
}
