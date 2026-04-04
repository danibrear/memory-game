export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DaniB's Games logo"
      style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id="logo-pill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa"/>
          <stop offset="100%" stopColor="#f472b6"/>
        </linearGradient>
      </defs>
      {/* Rounded square background */}
      <rect width="64" height="64" rx="14" fill="url(#logo-pill)"/>
      {/* Controller body */}
      <rect x="10" y="22" width="44" height="22" rx="11" fill="white" opacity="0.95"/>
      {/* Left grip */}
      <rect x="10" y="33" width="14" height="13" rx="7" fill="white" opacity="0.95"/>
      {/* Right grip */}
      <rect x="40" y="33" width="14" height="13" rx="7" fill="white" opacity="0.95"/>
      {/* D-pad horizontal */}
      <rect x="16" y="30" width="10" height="4" rx="2" fill="#6366f1"/>
      {/* D-pad vertical */}
      <rect x="19" y="27" width="4" height="10" rx="2" fill="#6366f1"/>
      {/* Face buttons — diamond layout, 8px apart center-to-center */}
      <circle cx="43" cy="27" r="2.2" fill="#f87171"/>
      <circle cx="50" cy="33" r="2.2" fill="#4ade80"/>
      <circle cx="36" cy="33" r="2.2" fill="#60a5fa"/>
      <circle cx="43" cy="39" r="2.2" fill="#facc15"/>
      {/* Select / Start */}
      <rect x="28" y="30.5" width="4" height="3" rx="1.5" fill="rgba(99,102,241,0.5)"/>
      <rect x="33" y="30.5" width="4" height="3" rx="1.5" fill="rgba(99,102,241,0.5)"/>
    </svg>
  );
}
