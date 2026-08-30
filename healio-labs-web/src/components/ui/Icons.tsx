import type { SVGProps } from "react";

export function Arrow({ flip = false, ...props }: SVGProps<SVGSVGElement> & { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 14"
      width="16"
      height="14"
      fill="none"
      aria-hidden="true"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      {...props}
    >
      <path
        d="M1 7h14M9.5 1.5 15 7l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 34 34" width={size} height={size} aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="hl-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="33" height="33" rx="10.5" fill="url(#hl-mark)" stroke="currentColor" strokeOpacity="0.2" />
      <path
        d="M8 17h4.5L15 11.5 18.5 22.5 21 17h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark />
      <span className="t-h-xs whitespace-nowrap">
        <span className="font-semibold">Healio</span>{" "}
        <span className="text-tertiary font-medium">Labs</span>
      </span>
    </span>
  );
}

const iconProps = {
  viewBox: "0 0 30 30",
  width: 30,
  height: 30,
  fill: "none",
  "aria-hidden": true as const,
};

export function ServiceIcon({ name }: { name: "strategy" | "design" | "technology" | "growth" }) {
  if (name === "strategy") {
    return (
      <svg {...iconProps}>
        <rect y="3" width="30" height="1.5" rx="0.75" fill="currentColor" />
        <rect y="12" width="21" height="1.5" rx="0.75" fill="currentColor" opacity="0.5" />
        <rect y="21" width="13" height="1.5" rx="0.75" fill="currentColor" opacity="0.5" />
        <circle cx="25" cy="21" r="3.4" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (name === "design") {
    return (
      <svg {...iconProps}>
        <rect x="0.6" y="6.6" width="17.8" height="17.8" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        <circle cx="20.5" cy="15.5" r="8.9" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (name === "technology") {
    return (
      <svg {...iconProps}>
        <rect x="0.6" y="3.6" width="10.8" height="10.8" rx="2.6" stroke="currentColor" strokeWidth="1.2" />
        <rect x="16.6" y="3.6" width="10.8" height="10.8" rx="2.6" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
        <rect x="0.6" y="19.6" width="10.8" height="10.8" rx="2.6" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
        <rect x="16" y="19" width="12" height="12" rx="3" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...iconProps}>
      <rect y="21" width="4" height="9" rx="2" fill="currentColor" opacity="0.45" />
      <rect x="8" y="15" width="4" height="15" rx="2" fill="currentColor" opacity="0.45" />
      <rect x="16" y="9" width="4" height="21" rx="2" fill="currentColor" />
      <rect x="24" y="2" width="4" height="28" rx="2" fill="currentColor" />
    </svg>
  );
}
