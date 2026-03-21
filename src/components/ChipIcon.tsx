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
        <rect x="20" y="0" width="8" height="9" fill="white" />
        <rect x="20" y="39" width="8" height="9" fill="white" />
        <rect x="0" y="20" width="9" height="8" fill="white" />
        <rect x="39" y="20" width="9" height="8" fill="white" />
      </g>

      {/* 外周リング */}
      <circle cx="24" cy="24" r="22" fill="none" stroke="white" strokeWidth="1.5" />

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
