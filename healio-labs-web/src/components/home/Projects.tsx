"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PROJECTS } from "@/lib/content";
import { Arrow } from "@/components/ui/Icons";
import { Eyebrow as EyebrowLabel } from "@/components/ui/Section";
import ProjectVisual from "@/components/visuals/ProjectVisual";

export default function Projects() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(0);

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const p = max > 0 ? el.scrollLeft / max : 0;
    setProgress(p);
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 32 : 1;
    setActive(Math.min(PROJECTS.length - 1, Math.round(el.scrollLeft / step)));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [onScroll]);

  const nudge = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 32 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <section id="work" className="relative isolate overflow-hidden bg-[var(--ground-base)] py-[clamp(5rem,11vw,11rem)]">
      <div className="mx-auto w-full max-w-[1440px] px-[var(--gutter)]">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div data-reveal>
            <EyebrowLabel>04 — Selected work</EyebrowLabel>
            <h2 className="t-h-xl mt-8 text-balance">Work that earns its place.</h2>
          </div>

          <div data-reveal className="hidden items-center gap-4 lg:flex">
            <span className="t-index text-tertiary tabular-nums">
              0{active + 1} / 0{PROJECTS.length}
            </span>
            <button
              type="button"
              onClick={() => nudge(-1)}
              aria-label="Previous project"
              className="glass-pill flex items-center justify-center rounded-full transition-colors duration-[var(--dur-quick)] hover:bg-[var(--glass-04)]"
              style={{ height: 52, width: 52 }}
            >
              <Arrow flip className={progress <= 0.01 ? "text-ink/35" : "text-ink"} />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              aria-label="Next project"
              className="glass-pill flex items-center justify-center rounded-full transition-colors duration-[var(--dur-quick)] hover:bg-[var(--glass-04)]"
              style={{ height: 52, width: 52 }}
            >
              <Arrow className={progress >= 0.99 ? "text-ink/35" : "text-ink"} />
            </button>
          </div>
        </div>
      </div>

      {/* track — native horizontal scroll with snap on desktop, stacked on mobile */}
      <div
        ref={trackRef}
        className="no-scrollbar mt-[clamp(2.5rem,5vw,4.75rem)] flex flex-col gap-14 px-[var(--gutter)] lg:snap-x lg:snap-mandatory lg:flex-row lg:gap-8 lg:overflow-x-auto lg:pb-2"
        tabIndex={0}
        aria-label="Selected work, horizontally scrollable"
      >
        {PROJECTS.map((p) => (
          <article
            key={p.slug}
            data-card
            data-reveal
            className="group w-full shrink-0 lg:w-[720px] lg:snap-start"
          >
            <Link href={`/work/${p.slug}`} className="block rounded-[20px]">
              <div className="overflow-hidden rounded-[20px]">
                <div className="transition-transform duration-[var(--dur-slow)] [transition-timing-function:var(--ease-standard)] group-hover:scale-[1.04]">
                  <ProjectVisual kind={p.visual} />
                </div>
              </div>

              <div className="mt-7 flex items-center justify-between">
                <span className="t-index text-quaternary">{p.index}</span>
                <span className="t-caption text-quaternary">{p.year}</span>
              </div>

              <h3 className="t-h-l mt-4 transition-transform duration-[var(--dur-slow)] [transition-timing-function:var(--ease-standard)] group-hover:-translate-y-1">
                {p.name}
              </h3>
              <p className="t-body-m text-secondary mt-2.5">{p.industry}</p>
              <p className="t-body-s text-tertiary mt-4 max-w-[560px]">{p.description}</p>

              <ul className="mt-6 flex flex-wrap gap-2.5">
                {p.services.map((s) => (
                  <li
                    key={s}
                    className="rounded-full border border-ink/10 bg-[var(--glass-02)] px-4 py-2"
                  >
                    <span className="t-body-xs text-secondary">{s}</span>
                  </li>
                ))}
              </ul>

              <span className="mt-7 inline-flex items-center gap-3">
                <span className="t-body-s">View case study</span>
                <Arrow className="transition-transform duration-[var(--dur-base)] [transition-timing-function:var(--ease-standard)] group-hover:translate-x-1.5" />
              </span>
            </Link>
          </article>
        ))}
      </div>

      {/* scroll progress */}
      <div className="mx-auto mt-14 hidden w-full max-w-[1440px] items-center gap-7 px-[var(--gutter)] lg:flex">
        <div className="h-0.5 flex-1 overflow-hidden bg-ink/[0.09]">
          <div
            className="h-full bg-ink/75 transition-[width] duration-150 ease-out"
            style={{ width: `${Math.max(12, progress * 100)}%` }}
          />
        </div>
        <span className="t-caption text-quaternary">Drag or scroll</span>
      </div>
    </section>
  );
}
