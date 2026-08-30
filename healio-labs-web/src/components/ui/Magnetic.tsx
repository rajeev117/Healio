"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Pulls its child up to 10px toward the cursor once inside a 90px radius,
 * releasing on a spring-like ease. Disabled entirely for reduced motion and
 * for coarse pointers, where there is no cursor to be magnetic toward.
 */
export default function Magnetic({
  children,
  strength = 10,
  radius = 90,
}: {
  children: ReactNode;
  strength?: number;
  radius?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const el = node.firstElementChild as HTMLElement | null;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (reduced || !fine) return;

    let frame = 0;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (dist < radius + Math.max(r.width, r.height) / 2) {
          const pull = Math.min(1, 1 - dist / (radius * 2.4));
          el.style.transition = "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)";
          el.style.transform = `translate3d(${dx * pull * (strength / 24)}px, ${
            dy * pull * (strength / 24)
          }px, 0)`;
        } else if (el.style.transform) {
          el.style.transition = "transform 500ms cubic-bezier(0.22, 1.4, 0.36, 1)";
          el.style.transform = "";
        }
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      el.style.transition = "transform 500ms cubic-bezier(0.22, 1.4, 0.36, 1)";
      el.style.transform = "";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [radius, strength]);

  // `contents` keeps this wrapper out of the layout entirely, so the button it
  // wraps is laid out directly by the parent (flex sizing, width utilities, etc.).
  return (
    <span ref={ref} className="contents">
      {children}
    </span>
  );
}
