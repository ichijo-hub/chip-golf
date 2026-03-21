import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    <svg
      width="512"
      height="512"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="c">
          <circle cx="24" cy="24" r="22" />
        </clipPath>
      </defs>
      <circle cx="24" cy="24" r="22" fill="#27AE60" />
      <g clipPath="url(#c)">
        <rect x="20" y="0" width="8" height="9" fill="white" />
        <rect x="20" y="39" width="8" height="9" fill="white" />
        <rect x="0" y="20" width="9" height="8" fill="white" />
        <rect x="39" y="20" width="9" height="8" fill="white" />
      </g>
      <circle cx="24" cy="24" r="22" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="22" y1="14" x2="22" y2="30" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="22,14 30,17.5 22,21" fill="#E74C3C" />
      <circle cx="26" cy="31.5" r="2.5" fill="white" />
    </svg>,
    { width: 512, height: 512 },
  );
}
