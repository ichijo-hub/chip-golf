import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<ChipGolfIcon size={32} />, size);
}

export function ChipGolfIcon({ size }: { size: number }) {
  const border = Math.round(size * 0.06);
  const fontSize = Math.round(size * 0.55);
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 35%, #1e7a45, #0a3d20 70%)',
        border: `${border}px solid #d4af37`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
      }}
    >
      ⛳
    </div>
  );
}
