"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts to `value` when the element scrolls into view.
 *
 * The initial state is the *final* value, so the server-rendered HTML and the
 * no-JS view both show the real number rather than a zero. The count only
 * rewinds to 0 once we know the element is off-screen and can actually be
 * animated into view — so a stat already on screen never flashes.
 *
 * Screen readers get the final value from aria-label rather than every step.
 */
export default function CountUp({
  value,
  suffix = "",
  duration = 1200,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = el.getBoundingClientRect();
    const alreadyOnScreen = rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyOnScreen) return;

    setDisplay(0);

    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(value * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} aria-label={`${value}${suffix}`}>
      <span aria-hidden="true">
        {display}
        {suffix}
      </span>
    </span>
  );
}
