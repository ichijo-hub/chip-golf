import ChipIcon from './ChipIcon';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const iconSize = size === 'sm' ? 36 : size === 'md' ? 52 : 68;
  const fontSize = size === 'sm' ? 26 : size === 'md' ? 36 : 48;
  const padding = size === 'sm' ? '8px 14px' : size === 'md' ? '10px 20px' : '14px 26px';

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        background: '#145a32',
        borderRadius: 16,
        padding,
      }}
    >
      <ChipIcon size={iconSize} />
      <span
        style={{
          fontFamily: 'var(--font-fredoka)',
          fontWeight: 700,
          fontSize,
          color: 'white',
          lineHeight: 1,
          letterSpacing: '0.02em',
        }}
      >
        ChipGolf
      </span>
    </div>
  );
}
