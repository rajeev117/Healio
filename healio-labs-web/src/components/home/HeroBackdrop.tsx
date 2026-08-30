"use client";

import { useEffect, useRef } from "react";

/**
 * Layered translucent panels behind the hero. They drift on a slow loop and
 * lean toward the cursor by depth — nearest panel moves most. Both behaviours
 * are dropped for reduced motion and coarse pointers.
 */
export default function HeroBackdrop() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (reduced || !fine) return;

    const panels = Array.from(el.querySelectorAll<HTMLElement>("[data-depth]"));
    let frame = 0;

    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const p of panels) {
          const depth = Number(p.dataset.depth ?? 1);
          p.style.transform = `translate3d(${nx * -20 * depth}px, ${ny * -12 * depth}px, 0)`;
        }
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      {/* architectural column rules */}
      <div className="absolute inset-0 mx-auto max-w-[1440px]">
        {[8, 22, 36, 50, 64, 78, 92].map((left, i) => (
          <span
            key={left}
            className="absolute top-0 h-full w-px"
            style={{
              left: `${left}%`,
              background: i === 0 || i === 6 ? "rgb(var(--fg-rgb) / 0.055)" : "rgb(var(--fg-rgb) / 0.032)",
            }}
          />
        ))}
      </div>

      {/* ambient glows */}
      <div
        className="absolute -top-[22%] left-[26%] h-[880px] w-[1320px] max-w-[110vw] blur-[130px]"
        style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
      />
      <div
        className="absolute -bottom-[10%] left-1/2 h-[420px] w-[1700px] max-w-[160vw] -translate-x-1/2 blur-[130px]"
        style={{ background: "radial-gradient(closest-side, var(--glow-soft), transparent)" }}
      />

      {/* layered glass cluster */}
      <div className="absolute right-[-8%] top-[18%] hidden h-[620px] w-[620px] lg:block xl:right-[2%]">
        <div data-depth="0.4" className="absolute left-[30%] top-0 transition-transform duration-500 [transition-timing-function:var(--ease-standard)]">
          <div className="drift glass h-[300px] w-[430px] rounded-[28px] opacity-85" style={{ animationDelay: "0s" }} />
        </div>
        <div data-depth="0.7" className="absolute left-[10%] top-[110px] transition-transform duration-500 [transition-timing-function:var(--ease-standard)]">
          <div className="drift glass h-[250px] w-[360px] rounded-[26px]" style={{ animationDelay: "-2.2s" }} />
        </div>
        <div data-depth="1.1" className="absolute left-[34%] top-[225px] transition-transform duration-500 [transition-timing-function:var(--ease-standard)]">
          <div className="drift glass-02 h-[270px] w-[400px] rounded-[28px]" style={{ animationDelay: "-4.4s" }} />
        </div>
        <div data-depth="1.6" className="absolute left-0 top-[360px] transition-transform duration-500 [transition-timing-function:var(--ease-standard)]">
          <div className="drift glass-03 h-[200px] w-[300px] rounded-[24px]" style={{ animationDelay: "-6.6s" }} />
        </div>
        <span className="absolute left-[76%] top-[76%] h-[148px] w-[148px] rounded-full border border-ink/20" />
      </div>
    </div>
  );
}
