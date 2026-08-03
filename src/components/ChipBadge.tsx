'use client';

import { ChipType } from '@/types';
import { useT } from '@/lib/i18n';
import { chipNamesEn } from '@/lib/i18n/chipNames';

interface ChipBadgeProps {
  name: string;
  chipType: ChipType;
  imageUrl?: string | null;
  imageScale?: number | null;
  imageOffsetY?: number | null;
  pointValue?: number;
  size?: number; // px（デフォルト64）
  flash?: boolean;
  showLabel?: boolean;
  onClick?: () => void;
  className?: string;
  isCustom?: boolean; // 限定チップ（カジノ柄+名前表示）
}

export default function ChipBadge({
  name,
  chipType,
  imageUrl,
  imageScale,
  imageOffsetY,
  pointValue,
  size = 64,
  flash = false,
  showLabel = true,
  onClick,
  className = '',
  isCustom = false,
}: ChipBadgeProps) {
  const { locale } = useT();
  const fullName = locale === 'en' ? (chipNamesEn[name] ?? name) : name;
  const displayName = isCustom && fullName.length > 6 ? fullName.slice(0, 6) + '…' : fullName;
  const isPositive = chipType === 'positive';
  const Tag = (onClick ? 'button' : 'div') as React.ElementType;

  const chip = (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{ width: size, height: size, minWidth: size, ...(imageUrl ? { background: 'transparent', border: `2px solid ${isPositive ? '#d4af37' : '#ef4444'}`, boxShadow: 'none' } : {}) }}
      className={[
        'chip-badge',
        isPositive ? 'chip-positive' : 'chip-negative',
        onClick ? 'chip-badge-interactive' : '',
        flash ? 'chip-flash' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {imageUrl && (
        <div
          aria-label={displayName}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: `${(imageScale ?? 1.5) * 100}%`,
            backgroundPosition: `center ${imageOffsetY ?? 40}%`,
            backgroundRepeat: 'no-repeat',
            pointerEvents: 'none',
          }}
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
      {/* 限定チップ: カジノ柄 + 名前テキスト */}
      {isCustom && !imageUrl && (() => {
        const display = name.slice(0, 10);
        const line1 = display.slice(0, 5);
        const line2 = display.slice(5);
        const twoLine = line2.length > 0;
        // 文字数に応じてフォントサイズを自動縮小
        const fs = twoLine
          ? (line1.length <= 3 ? 20 : 17)
          : (line1.length <= 2 ? 28 : line1.length <= 3 ? 24 : line1.length <= 4 ? 20 : 17);
        return (
          <svg
            viewBox="0 0 100 100"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            {/* 外周のカジノストライプ（8等分の交互セグメント） */}
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="7" strokeDasharray="17.3 17.3" strokeLinecap="butt" />
            {/* 内側リング */}
            <circle cx="50" cy="50" r="37" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            {twoLine ? (
              <>
                <text x="50" y={50 - fs * 0.1} textAnchor="middle" fill="white" fontSize={fs} fontWeight="800" fontFamily="system-ui, -apple-system, sans-serif" style={{ letterSpacing: '-0.5px' }}>{line1}</text>
                <text x="50" y={50 + fs * 1.1} textAnchor="middle" fill="white" fontSize={fs} fontWeight="800" fontFamily="system-ui, -apple-system, sans-serif" style={{ letterSpacing: '-0.5px' }}>{line2}</text>
              </>
            ) : (
              <text x="50" y="57" textAnchor="middle" fill="white" fontSize={fs} fontWeight="800" fontFamily="system-ui, -apple-system, sans-serif" style={{ letterSpacing: '-0.5px' }}>{line1}</text>
            )}
          </svg>
        );
      })()}
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
        whiteSpace: 'nowrap',
        marginTop: 3,
        pointerEvents: 'none',
      }}
    >
      {displayName}
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
