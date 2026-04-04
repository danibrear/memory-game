import { useState } from "react";

const OPENMOJI_BASE = "https://openmoji.org/data/color/svg";

interface OpenMojiImgProps {
  code: string;
  alt?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function OpenMojiImg({
  code,
  alt = "",
  size = 64,
  className,
  style,
}: OpenMojiImgProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <span
        style={{ fontSize: size * 0.6, lineHeight: 1, ...style }}
        className={className}
        role="img"
        aria-label={alt}>
        ❓
      </span>
    );
  }

  return (
    <img
      src={`${OPENMOJI_BASE}/${code}.svg`}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ display: "inline-block", ...style }}
      onError={() => setError(true)}
      draggable={false}
    />
  );
}
