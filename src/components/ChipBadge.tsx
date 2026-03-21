'use client';

import { ChipType } from '@/types';

interface ChipBadgeProps {
  name: string;
  chipType: ChipType;
  imageUrl?: string | null;
  pointValue?: number;
  size?: number; // px（デフォルト64）
  flash?: boolean;
  showLabel?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function ChipBadge({
  name,
  chipType,
  imageUrl,
  pointValue,
  size = 64,
  flash = false,
  showLabel = true,
  onClick,
  className = '',
}: ChipBadgeProps) {
  const isPositive = chipType === 'positive';
  const fontSize = size <= 44 ? '8px' : size <= 56 ? '10px' : '11px';
  const Tag = (onClick ? 'button' : 'div') as React.ElementType;

  const chip = (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{ width: size, height: size, minWidth: size }}
      className={[
        'chip-badge',
        isPositive ? 'chip-positive' : 'chip-negative',
        onClick ? 'chip-badge-interactive' : '',
        flash ? 'chip-flash' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* 内側の装飾リング */}
      <span
        style={{
          position: 'absolute',
          inset: 4,
          borderRadius: '9999px',
          border: `1px solid ${isPositive ? 'rgba(212,175,55,0.35)' : 'rgba(248,113,113,0.35)'}`,
          pointerEvents: 'none',
        }}
      />
    </Tag>
  );

  const nameFontSize = size <= 44 ? 8 : size <= 56 ? 9 : size <= 72 ? 11 : 12;
  const label = (
    <span
      style={{
        fontSize: nameFontSize,
        color: '#86efac', // text-green-300
        textAlign: 'center',
        lineHeight: 1.2,
        maxWidth: size + 8,
        wordBreak: 'break-word',
        marginTop: 3,
        pointerEvents: 'none',
      }}
    >
      {name}
    </span>
  );

  // バッジなし
  if (pointValue === undefined) {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        {chip}
        {showLabel && label}
      </div>
    );
  }

  // バッジあり：overflow:hidden の外に出すためラッパーで包む
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        {chip}
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: Math.max(24, Math.round(size * 0.35)),
            height: Math.max(24, Math.round(size * 0.35)),
            borderRadius: '9999px',
            fontSize: Math.max(14, Math.round(size * 0.20)),
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            pointerEvents: 'none',
            background: isPositive ? '#d4af37' : '#ef4444',
            color: isPositive ? '#1a1a1a' : '#fff',
            border: '1.5px solid #145a32',
            lineHeight: 1,
          }}
        >
          {isPositive ? '+' : '-'}{pointValue}
        </span>
      </div>
      {showLabel && label}
    </div>
  );
}
