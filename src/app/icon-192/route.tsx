import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    <svg width="192" height="192" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="#145a32" />
      <defs>
        <clipPath id="c"><circle cx="24" cy="24" r="22" /></clipPath>
      </defs>
      <circle cx="24" cy="24" r="22" fill="#27AE60" />
      <g clipPath="url(#c)">
        <rect x="21.5" y="0" width="5" height="7" fill="white" />
        <rect x="21.5" y="0" width="5" height="7" fill="white" transform="rotate(45 24 24)" />
        <rect x="21.5" y="0" width="5" height="7" fill="white" transform="rotate(90 24 24)" />
        <rect x="21.5" y="0" width="5" height="7" fill="white" transform="rotate(135 24 24)" />
        <rect x="21.5" y="0" width="5" height="7" fill="white" transform="rotate(180 24 24)" />
        <rect x="21.5" y="0" width="5" height="7" fill="white" transform="rotate(225 24 24)" />
        <rect x="21.5" y="0" width="5" height="7" fill="white" transform="rotate(270 24 24)" />
        <rect x="21.5" y="0" width="5" height="7" fill="white" transform="rotate(315 24 24)" />
      </g>
      <circle cx="24" cy="24" r="22" fill="none" stroke="#d4af37" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="22" y1="14" x2="22" y2="30" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="22,14 30,17.5 22,21" fill="#E74C3C" />
      <circle cx="26" cy="31.5" r="2.5" fill="white" />
    </svg>,
    { width: 192, height: 192 },
  );
}
