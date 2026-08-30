"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TESTIMONIALS } from "@/lib/content";
import { Arrow } from "@/components/ui/Icons";
import { Eyebrow } from "@/components/ui/Section";

export default function Testimonials() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 24 : 1;
    setActive(Math.min(TESTIMONIALS.length - 1, Math.round(el.scrollLeft / step)));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 24 : el.clientWidth;
    el.scrollTo({ left: i * step, behavior: "smooth" });
  };

  return (
    <section className="relative isolate overflow-hidden bg-[var(--ground-base)] py-[clamp(5rem,11vw,11rem)]">
      <div className="mx-auto w-full max-w-[1440px] px-[var(--gutter)]">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div data-reveal>
            <Eyebrow>06 — Testimonials</Eyebrow>
            <h2 className="t-h-xl mt-8">In their words.</h2>
          </div>
          <div data-reveal className="hidden items-center gap-4 lg:flex">
            <button
              type="button"
              onClick={() => goTo(Math.max(0, active - 1))}
              aria-label="Previous testimonial"
              className="glass-pill flex items-center justify-center rounded-full transition-colors duration-[var(--dur-quick)] hover:bg-[var(--glass-04)]"
              style={{ height: 52, width: 52 }}
            >
              <Arrow flip className={active === 0 ? "text-ink/35" : "text-ink"} />
            </button>
            <button
              type="button"
              onClick={() => goTo(Math.min(TESTIMONIALS.length - 1, active + 1))}
              aria-label="Next testimonial"
              className="glass-pill flex items-center justify-center rounded-full transition-colors duration-[var(--dur-quick)] hover:bg-[var(--glass-04)]"
              style={{ height: 52, width: 52 }}
            >
              <Arrow className={active === TESTIMONIALS.length - 1 ? "text-ink/35" : "text-ink"} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        tabIndex={0}
        aria-label="Client testimonials, horizontally scrollable"
        className="no-scrollbar mt-[clamp(2.5rem,5vw,4.5rem)] flex snap-x snap-mandatory gap-6 overflow-x-auto px-[var(--gutter)] pb-2"
      >
        {TESTIMONIALS.map((t, i) => (
          <figure
            key={t.name}
            data-card
            data-reveal
            style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}
            className={`flex w-[min(520px,82vw)] shrink-0 snap-start flex-col justify-between rounded-[24px] p-8 transition-opacity duration-[var(--dur-slow)] sm:p-10 ${
              i === active ? "glass-03 opacity-100" : "glass opacity-60"
            }`}
          >
            <div>
              <span aria-hidden="true" className="t-display-l block leading-none text-ink/25">
                &ldquo;
              </span>
              <blockquote className="t-h-xs mt-3 text-balance">{t.quote}</blockquote>
            </div>
            <figcaption className="mt-10">
              <div className="h-px w-full bg-ink/10" />
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="t-body-m">{t.name}</p>
                  <p className="t-body-xs text-tertiary mt-1.5">
                    {t.role}, {t.company}
                  </p>
                </div>
                <span className="t-index text-quaternary">0{i + 1}</span>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mx-auto mt-12 flex w-full max-w-[1440px] items-center gap-2.5 px-[var(--gutter)]">
        {TESTIMONIALS.map((t, i) => (
          <button
            key={t.name}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to testimonial ${i + 1}`}
            aria-current={i === active}
            className={`h-[3px] rounded-full transition-all duration-[var(--dur-base)] ${
              i === active ? "w-7 bg-ink/85" : "w-2 bg-ink/20 hover:bg-ink/40"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
