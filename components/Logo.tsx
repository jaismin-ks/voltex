interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  variant?: "mark" | "stamp";
}

/**
 * Voltex mark.
 *
 * A stylized lightning bolt inside a hexagonal shield outline.
 * The bolt is rendered in the brand accent (electric blue), the hex
 * outline inherits `currentColor` so it adapts to paper/ink depending
 * on the surface. Clean, geometric, scales well from 24px nav to 128px favicon.
 */
export function Logo({
  size = 28,
  withWordmark = false,
  className,
  variant = "mark",
}: LogoProps) {
  const stroke = variant === "stamp" ? 2.5 : 2;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`.trim()}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-label="Voltex"
      >
        {/* Hexagonal shield outline */}
        <path
          d="M32 4 L56 18 L56 46 L32 60 L8 46 L8 18 Z"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinejoin="round"
          fill="none"
        />
        {/* Lightning bolt */}
        <path
          d="M35 12 L22 34 L30 34 L28 52 L42 28 L34 28 Z"
          fill="var(--signal, #6C9CFF)"
          stroke="var(--signal, #6C9CFF)"
          strokeWidth={0.5}
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span className="text-base font-semibold tracking-tight text-[var(--paper)]">
          Voltex
        </span>
      )}
    </span>
  );
}
