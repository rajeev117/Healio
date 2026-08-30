import type { VisualKind } from "@/lib/content";

/**
 * Abstract monochrome case-study visuals. Geometry is SVG (crisp at any size);
 * the readout chips are real DOM so they get true backdrop-blur glass.
 */
export default function ProjectVisual({
  kind,
  className = "",
  compact = false,
}: {
  kind: VisualKind;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`grain relative isolate w-full overflow-hidden rounded-[20px] border border-[var(--viz-edge)] ${className}`}
      style={{
        background: "linear-gradient(140deg, var(--viz-from) 0%, var(--viz-to) 100%)",
      }}
      aria-hidden="true"
    >
      <div className="aspect-[720/440] w-full">
        <svg
          viewBox="0 0 720 440"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <radialGradient id={`glow-${kind}`} cx="50%" cy="50%" r="50%">
              {/* the bloom stays a light source in both themes, so it uses its
                  own token rather than following the ink colour */}
              <stop offset="0%" stopColor="var(--viz-glow)" />
              <stop offset="100%" stopColor="var(--viz-glow)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`bar-${kind}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.36" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          <ellipse cx="530" cy="70" rx="310" ry="210" fill={`url(#glow-${kind})`} />

          {kind === "nova" && (
            <g>
              {[70, 110, 150, 196, 250].map((h, i) => (
                <rect
                  key={i}
                  x={404 + i * 58}
                  y={392 - h}
                  width="44"
                  height={h}
                  rx="6"
                  fill={`url(#bar-${kind})`}
                />
              ))}
              <circle cx="620" cy="210" r="150" stroke="currentColor" strokeOpacity="0.14" fill="none" />
              <circle cx="620" cy="210" r="95" stroke="currentColor" strokeOpacity="0.08" fill="none" />
            </g>
          )}

          {kind === "aether" && (
            <g>
              <circle cx="360" cy="220" r="180" stroke="currentColor" strokeOpacity="0.09" fill="none" />
              <circle cx="360" cy="220" r="125" stroke="currentColor" strokeOpacity="0.14" fill="none" />
              <circle cx="360" cy="220" r="70" stroke="currentColor" strokeOpacity="0.22" fill="none" />
              <path
                d="M366 226 366 116M366 226 248 192M366 226 470 198M366 226 300 302M366 226 440 322"
                stroke="currentColor"
                strokeOpacity="0.17"
                strokeLinecap="round"
              />
              {[
                [366, 116],
                [248, 192],
                [470, 198],
                [300, 302],
                [440, 322],
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="3.5" fill="currentColor" fillOpacity="0.5" />
              ))}
              <circle cx="366" cy="226" r="6.5" fill="currentColor" fillOpacity="0.95" />
            </g>
          )}

          {kind === "forma" && (
            <g>
              {[
                [64, 300, 0.14],
                [86, 220, 0.09],
                [54, 352, 0.18],
                [102, 180, 0.07],
                [70, 264, 0.11],
                [92, 318, 0.15],
              ].map(([w, h, o], i, arr) => {
                const x = 118 + arr.slice(0, i).reduce((a, b) => a + b[0] + 22, 0);
                return (
                  <rect
                    key={i}
                    x={x}
                    y={392 - h}
                    width={w}
                    height={h}
                    rx="3"
                    fill="currentColor"
                    fillOpacity={o}
                  />
                );
              })}
              {[110, 180, 250, 320].map((y) => (
                <rect key={y} x="0" y={y} width="720" height="1" fill="currentColor" fillOpacity="0.05" />
              ))}
              <rect x="360" y="0" width="1" height="440" fill="currentColor" fillOpacity="0.08" />
            </g>
          )}

          {kind === "helix" && (
            <g>
              <circle cx="250" cy="220" r="140" stroke="currentColor" strokeOpacity="0.11" fill="none" />
              <circle cx="470" cy="220" r="140" stroke="currentColor" strokeOpacity="0.11" fill="none" />
              <path
                d="M80 250 198 250 226 204 260 296 290 232 318 250 440 250 468 220 494 278 520 250 640 250"
                stroke="currentColor"
                strokeOpacity="0.85"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <circle cx="360" cy="250" r="4.5" fill="currentColor" fillOpacity="0.9" />
            </g>
          )}
        </svg>
      </div>

      {/* glass readouts */}
      {!compact && (
        <div className="absolute inset-0">
          {kind === "nova" && (
            <>
              <Readout label="Total balance" value="£48,920.00" className="left-[8%] top-[27%]" />
              <Readout label="This month" value="+ 12.4%" className="left-[8%] top-[62%]" />
            </>
          )}
          {kind === "aether" && (
            <Readout label="Model confidence" value="98.4%" className="left-[8%] top-[60%]" />
          )}
          {kind === "forma" && (
            <Readout label="Projects" value="148 built" className="left-[63%] top-[14%]" />
          )}
          {kind === "helix" && (
            <Readout label="Heart rate" value="62 BPM" className="left-[63%] top-[61%]" />
          )}
        </div>
      )}
    </div>
  );
}

function Readout({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`glass-03 absolute hidden rounded-[14px] px-4 py-3.5 sm:block md:px-5 md:py-4 ${className}`}
    >
      <p className="t-caption text-quaternary">{label}</p>
      <p className="t-h-xs mt-1.5 font-medium md:mt-2">{value}</p>
    </div>
  );
}
