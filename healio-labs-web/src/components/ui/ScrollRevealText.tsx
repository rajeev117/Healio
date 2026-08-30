"use client";

import { useEffect, useRef } from "react";

/**
 * Progressive per-word reveal bound to scroll position. Words light from
 * `dimFrom` to full white as the block travels through the viewport.
 *
 * The text is fully present in the DOM at all times — this only changes colour,
 * so it stays readable and selectable even before the reveal completes, and it
 * renders fully lit under prefers-reduced-motion.
 */
export default function ScrollRevealText({
  text,
  className = "",
  dimFrom = 0.22,
  as: Tag = "p",
}: {
  text: string;
  className?: string;
  dimFrom?: number;
  as?: "p" | "h2";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = Array.from(el.querySelectorAll<HTMLElement>("[data-word]"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      words.forEach((w) => (w.style.color = "rgb(var(--fg-rgb) / 1)"));
      return;
    }

    let frame = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the block's top reaches 82% down the viewport,
      // 1 by the time its bottom passes 45%.
      const start = vh * 0.82;
      const end = vh * 0.45;
      const span = start - end + rect.height;
      const progress = Math.min(1, Math.max(0, (start - rect.top) / span));
      const lit = progress * words.length;
      words.forEach((w, i) => {
        const t = Math.min(1, Math.max(0, lit - i));
        const alpha = dimFrom + (1 - dimFrom) * t;
        w.style.color = `rgb(var(--fg-rgb) / ${alpha.toFixed(3)})`;
      });
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [dimFrom, text]);

  const words = text.split(" ");

  return (
    <Tag ref={ref as never} className={className}>
      {words.map((w, i) => (
        <span
          key={i}
          data-word
          style={{
            color: `rgb(var(--fg-rgb) / ${dimFrom})`,
            transition: "color 260ms linear",
          }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}
