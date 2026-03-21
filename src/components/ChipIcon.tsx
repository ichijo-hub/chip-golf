interface ChipIconProps {
  size?: number;
  className?: string;
}

export default function ChipIcon({ size = 48, className = '' }: ChipIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <clipPath id="chip-icon-clip">
          <circle cx="24" cy="24" r="22" />
        </clipPath>
      </defs>

      {/* 背景 */}
      <circle cx="24" cy="24" r="22" fill="#27AE60" />

      {/* 白い切り込み4本（上下左右） */}
      <g clipPath="url(#chip-icon-clip)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
          <rect key={deg} x="21.5" y="0" width="5" height="7" fill="white" transform={`rotate(${deg} 24 24)`} />
        ))}
      </g>

      {/* 外周縁取り */}
      <circle cx="24" cy="24" r="22" fill="none" stroke="#d4af37" strokeWidth="2.5" />

      {/* 内側破線リング */}
      <circle
        cx="24"
        cy="24"
        r="14"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />

      {/* フラッグポール */}
      <line
        x1="22" y1="14"
        x2="22" y2="30"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* フラッグ（赤） */}
      <polygon points="22,14 30,17.5 22,21" fill="#E74C3C" />

      {/* ゴルフボール（白） */}
      <circle cx="26" cy="31.5" r="2.5" fill="white" />
    </svg>
  );
}
