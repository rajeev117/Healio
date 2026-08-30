/**
 * Abstract product mockups. Deliberately unbranded greyscale blocks — they read
 * as "a real interface" without pretending to be a screenshot of one.
 */

function Bar({
  w,
  h = 8,
  o = 0.2,
  className = "",
}: {
  w: number | string;
  h?: number;
  o?: number;
  className?: string;
}) {
  return (
    <span
      className={`block rounded-full ${className}`}
      style={{ width: typeof w === "number" ? `${w}px` : w, height: h, background: `rgb(var(--fg-rgb) / ${o})` }}
    />
  );
}

export function DesktopMock({ className = "" }: { className?: string }) {
  const chart = [36, 58, 44, 86, 70, 104, 92, 126, 148];
  return (
    <div
      className={`glass-02 overflow-hidden rounded-[16px] ${className}`}
      style={{ background: "linear-gradient(150deg, var(--mock-from) 0%, var(--mock-to) 100%)" }}
      aria-hidden="true"
    >
      {/* title bar */}
      <div className="flex h-11 items-center gap-2 border-b border-ink/[0.09] px-5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-[7px] w-[7px] rounded-full bg-ink/20" />
        ))}
        <span className="mx-auto"><Bar w={180} h={9} o={0.07} /></span>
      </div>

      <div className="flex">
        {/* sidebar */}
        <div className="hidden w-[196px] shrink-0 space-y-[26px] border-r border-ink/[0.08] bg-ink/[0.022] p-6 sm:block">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-4 rounded-full border border-ink/50" />
            <Bar w={74} h={9} o={0.3} />
          </div>
          <div className="space-y-[26px] pt-2">
            {[78, 96, 68, 78, 58, 68].map((w, i) => (
              <Bar key={i} w={w} h={8} o={i === 1 ? 0.34 : 0.11} />
            ))}
          </div>
        </div>

        {/* main */}
        <div className="min-w-0 flex-1 p-6 sm:p-8">
          <Bar w={232} h={15} o={0.55} />
          <span className="mt-3 block"><Bar w={150} h={9} o={0.16} /></span>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[12px] bg-ink/[0.045] p-4">
                <Bar w={58} h={7} o={0.16} />
                <span className="mt-3 block">
                  <Bar w={i === 0 ? 82 : 64} h={17} o={i === 0 ? 0.72 : 0.38} />
                </span>
                <span className="mt-2.5 block"><Bar w={40} h={6} o={0.12} /></span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex h-[190px] items-end gap-3 rounded-[12px] bg-ink/[0.035] p-5">
            {chart.map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-[4px]"
                style={{ height: `${h}px`, background: `rgb(var(--fg-rgb) / ${0.1 + i * 0.045})` }}
              />
            ))}
          </div>

          <div className="mt-4 space-y-0">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 border-t border-ink/[0.06] py-3">
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-ink/30" />
                <Bar w={120 - i * 18} h={8} o={0.2} />
                <span className="ml-auto"><Bar w={56} h={8} o={0.11} /></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhoneMock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[36px] border-[1.5px] border-ink/20 shadow-[var(--glass-shadow-lg)] ${className}`}
      style={{ background: "linear-gradient(155deg, var(--mock-phone-from) 0%, var(--mock-phone-to) 100%)", width: 258 }}
      aria-hidden="true"
    >
      <div className="px-6 pb-6 pt-4">
        <span className="mx-auto block h-1.5 w-[84px] rounded-full bg-ink/25" />

        <div className="mt-9 space-y-3">
          <Bar w={96} h={8} o={0.2} />
          <Bar w={168} h={26} o={0.85} />
          <Bar w={60} h={8} o={0.14} />
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3.5">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-[14px] p-3" style={{ background: `rgb(var(--fg-rgb) / ${i === 0 ? 0.07 : 0.05})` }}>
              <Bar w={46} h={7} o={i === 0 ? 0.2 : 0.14} />
              <span className="mt-2.5 block"><Bar w={i === 0 ? 62 : 54} h={13} o={i === 0 ? 0.6 : 0.34} /></span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[14px] bg-ink/[0.045] p-4">
          <svg viewBox="0 0 170 60" className="h-[74px] w-full" aria-hidden="true">
            <path
              d="M0 52 26 40 52 46 78 22 104 30 130 10 156 16 170 2"
              stroke="currentColor"
              strokeOpacity="0.75"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="h-[9px] w-[9px] rounded-full bg-ink/25" />
              <Bar w={104 - i * 14} h={8} o={0.22} />
              <span className="ml-auto"><Bar w={38} h={8} o={0.12} /></span>
            </div>
          ))}
        </div>

        <span className="mx-auto mt-8 block h-1 w-[120px] rounded-full bg-ink/30" />
      </div>
    </div>
  );
}

export function FlagshipShot() {
  return (
    <div
      className="grain relative isolate overflow-hidden rounded-[24px] border border-[var(--viz-edge)]"
      style={{ background: "linear-gradient(140deg, var(--viz-from) 0%, var(--viz-to) 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-1/3 left-1/3 h-[560px] w-[900px] blur-[110px]"
        style={{ background: "radial-gradient(closest-side, var(--viz-glow), transparent)" }}
      />
      <div className="relative flex items-center justify-center gap-8 px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
        <PhoneMock className="hidden shrink-0 md:block" />
        <DesktopMock className="w-full max-w-[880px]" />
      </div>
    </div>
  );
}
