import Image from 'next/image';

interface ChipIconProps {
  size?: number;
  className?: string;
}

export default function ChipIcon({ size = 48, className = '' }: ChipIconProps) {
  return (
    <Image
      src="/chip-icon.png"
      alt="Chip Golf Icon"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: '50%' }}
    />
  );
}
