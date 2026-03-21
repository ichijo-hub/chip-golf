import ChipIcon from './ChipIcon';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const iconSize = size === 'sm' ? 28 : size === 'md' ? 36 : 48;
  const fontSize = size === 'sm' ? 18 : size === 'md' ? 24 : 32;
  const padding = size === 'sm' ? '8px 14px' : size === 'md' ? '10px 20px' : '14px 26px';

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 20,
        background: '#2ECC71',
        borderRadius: 16,
        padding,
      }}
    >
      <ChipIcon size={iconSize} />
      <span
        style={{
          fontFamily: "'Fredoka', sans-serif",
          fontWeight: 700,
          fontSize,
          color: 'white',
          lineHeight: 1,
          letterSpacing: '0.02em',
        }}
      >
        Chip Golf
      </span>
    </div>
  );
}
