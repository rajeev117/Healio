import { Container, Eyebrow, Section } from "@/components/ui/Section";
import CountUp from "@/components/ui/CountUp";
import { STATS } from "@/lib/content";

export default function About() {
  return (
    <Section id="about">
      <Container>
        <div className="flex flex-col gap-14 lg:flex-row lg:gap-[7.5rem]">
          {/* left — heading */}
          <div className="lg:w-[500px] lg:shrink-0">
            <div data-reveal>
              <Eyebrow>02 — About</Eyebrow>
              <h2 className="t-h-xl mt-9 text-balance">We Think Beyond The Brief.</h2>
            </div>
            <div
              data-reveal
              style={{ ["--reveal-delay" as string]: "120ms" }}
              className="mt-12 flex items-center gap-4"
            >
              <span className="h-px w-14 bg-ink/25" aria-hidden="true" />
              <span className="t-caption text-quaternary">Since 2014</span>
            </div>
          </div>

          {/* right — content */}
          <div className="flex-1">
            <p data-reveal className="t-body-l text-secondary max-w-[580px]">
              Every engagement starts with the question behind the question. We interrogate the
              brief, map the system around it, and design for the outcome — not the deliverable.
            </p>
            <p
              data-reveal
              style={{ ["--reveal-delay" as string]: "80ms" }}
              className="t-body-m text-tertiary mt-6 max-w-[580px]"
            >
              Our teams are deliberately small and deliberately senior. Strategists, designers and
              engineers work in one room, on one timeline, against a single definition of done. No
              handover walls, no translation loss, no diluted thinking.
            </p>

            <dl className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
              {STATS.map((s, i) => (
                <div key={s.label} data-reveal style={{ ["--reveal-delay" as string]: `${i * 120}ms` }}>
                  <dd className="t-stat-s">
                    <CountUp value={s.value} suffix={s.suffix} />
                  </dd>
                  <div className="my-4 h-px w-full bg-ink/[0.14]" />
                  <dt className="t-body-s text-tertiary">{s.label}</dt>
                </div>
              ))}
            </dl>

            <figure
              data-reveal
              className="glass-02 mt-16 rounded-[24px] px-8 py-9 sm:px-10 sm:py-10"
            >
              <figcaption className="t-caption text-quaternary">Design principle</figcaption>
              <blockquote className="t-h-s mt-5 text-balance">
                “Clarity is the highest form of craft. We remove until only the essential remains —
                then we make that unforgettable.”
              </blockquote>
              <div className="mt-8 h-px w-full bg-ink/10" />
              <div className="mt-5 flex items-center justify-between gap-4">
                <span className="t-body-xs text-tertiary">Healio Labs — Operating Principles</span>
                <span className="t-index text-quaternary">01 / 04</span>
              </div>
            </figure>
          </div>
        </div>
      </Container>
    </Section>
  );
}
