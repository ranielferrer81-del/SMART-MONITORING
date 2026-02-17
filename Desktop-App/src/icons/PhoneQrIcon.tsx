type PhoneQrIconProps = {
  className?: string;
};

export default function PhoneQrIcon({ className = '' }: PhoneQrIconProps) {
  return (
    <svg
      viewBox="0 0 200 300"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="phoneBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="phoneScreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>

      {/* Phone body */}
      <rect
        x="35"
        y="15"
        width="130"
        height="270"
        rx="22"
        stroke="white"
        strokeWidth="10"
        fill="url(#phoneBody)"
        opacity="0.95"
      />

      {/* Screen */}
      <rect
        x="50"
        y="50"
        width="100"
        height="200"
        rx="14"
        fill="url(#phoneScreen)"
      />

      {/* Speaker notch */}
      <rect x="90" y="32" width="40" height="6" rx="3" fill="white" opacity="0.7" />

      {/* Home indicator */}
      <rect x="85" y="260" width="30" height="8" rx="4" fill="white" opacity="0.7" />

      {/* QR code on screen */}
      <g transform="translate(70,90)" fill="none" stroke="white" strokeWidth="6">
        <rect x="0" y="0" width="60" height="60" rx="6" />

        <rect x="8" y="8" width="16" height="16" />
        <rect x="36" y="8" width="16" height="16" />
        <rect x="8" y="36" width="16" height="16" />
        <rect x="36" y="36" width="16" height="16" />

        <rect x="26" y="26" width="8" height="8" />

        <rect x="18" y="18" width="8" height="8" transform="translate(20 0)" />
        <rect x="18" y="18" width="8" height="8" transform="translate(0 20)" />
        <rect x="18" y="18" width="8" height="8" transform="translate(20 20)" />
      </g>
    </svg>
  );
}

