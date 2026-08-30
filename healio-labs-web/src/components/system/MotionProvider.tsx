"use client";

import { useEffect } from "react";

/**
 * Mounted once in the root layout. Observes every [data-reveal] and .line-mask
 * element on the page — including ones added later by client components — and
 * flips them to their settled state as they enter the viewport.
 *
 * Keeping the observer global means section markup stays server-rendered:
 * a section only needs `data-reveal` in its JSX, no client boundary.
 */
export default function MotionProvider() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reveal styles are scoped to .js so that content is never hidden by CSS
    // the page has no script to undo. Added here — after hydration, in the same
    // tick as the first visibility pass — so on-screen content never flashes.
    document.documentElement.classList.add("js");

    const targets = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-reveal], .line-mask, [data-draw], [data-pop]"));

    if (reduced) {
      targets().forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );

    const seen = new WeakSet<Element>();
    const observeAll = () => {
      for (const el of targets()) {
        if (seen.has(el)) continue;
        seen.add(el);
        // Anything already above the fold on load settles immediately.
        const box = el.getBoundingClientRect();
        if (box.top < window.innerHeight) {
          el.classList.add("is-visible");
        } else {
          io.observe(el);
        }
      }
    };

    observeAll();
    const mo = new MutationObserver(observeAll);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
