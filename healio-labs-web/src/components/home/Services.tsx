import { Container, Section, SectionHeader } from "@/components/ui/Section";
import { ServiceIcon, Arrow } from "@/components/ui/Icons";
import { SERVICES } from "@/lib/content";

export default function Services() {
  return (
    <Section id="services" ground="raised">
      {/* ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[620px] w-[1100px] max-w-[120vw] -translate-x-1/2 blur-[130px]"
        style={{ background: "radial-gradient(closest-side, var(--glow-soft), transparent)" }}
      />

      <Container className="relative">
        <SectionHeader
          eyebrow="03 — Capabilities"
          title="Four connected practices. One accountable team."
          lead="We do not hand work between departments. Every practice sits on the same team, against the same outcome, from first workshop to post-launch iteration."
        />

        <div id="capabilities" className="mt-[clamp(3rem,6vw,5.25rem)] grid gap-6 md:grid-cols-2">
          {SERVICES.map((s, i) => (
            <article
              key={s.index}
              data-reveal
              style={{ ["--reveal-delay" as string]: `${(i % 2) * 90}ms` }}
              className="group glass relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-[24px] p-8 transition-all duration-[var(--dur-base)] [transition-timing-function:var(--ease-standard)] hover:-translate-y-1.5 hover:border-ink/20 hover:bg-[var(--glass-03)] hover:shadow-[var(--glass-shadow-hover)] sm:min-h-[384px] sm:p-9"
            >
              <div>
                <div className="flex items-start justify-between gap-6">
                  <span className="text-ink/70 transition-colors duration-[var(--dur-base)] group-hover:text-ink">
                    <ServiceIcon name={s.icon} />
                  </span>
                  <span className="t-index text-quaternary transition-colors duration-[var(--dur-base)] group-hover:text-ink/60">
                    {s.index}
                  </span>
                </div>
                <h3 className="t-h-m mt-9">{s.title}</h3>
                <p className="t-body-s text-tertiary mt-3.5 max-w-[420px] transition-colors duration-[var(--dur-base)] group-hover:text-ink/70">
                  {s.summary}
                </p>
              </div>

              <div className="mt-8">
                <div className="h-px w-full bg-ink/[0.08] transition-colors duration-[var(--dur-base)] group-hover:bg-ink/[0.16]" />

                {/* resting affordance */}
                <div className="flex items-center justify-between pt-5 transition-all duration-[var(--dur-base)] group-hover:pointer-events-none group-hover:h-0 group-hover:-translate-y-1 group-hover:pt-0 group-hover:opacity-0">
                  <span className="t-body-s text-tertiary">Explore capability</span>
                  <Arrow className="text-ink/55" />
                </div>

                {/* revealed on interaction */}
                <ul className="grid grid-rows-[0fr] pt-0 opacity-0 transition-all duration-[var(--dur-base)] [transition-timing-function:var(--ease-standard)] group-hover:grid-rows-[1fr] group-hover:pt-5 group-hover:opacity-100 group-focus-within:grid-rows-[1fr] group-focus-within:pt-5 group-focus-within:opacity-100">
                  <div className="overflow-hidden">
                    {s.detail.map((d) => (
                      <li key={d} className="flex items-center gap-3 py-[5.5px]">
                        <span className="h-px w-2.5 shrink-0 bg-ink/30" aria-hidden="true" />
                        <span className="t-body-s text-secondary">{d}</span>
                      </li>
                    ))}
                  </div>
                </ul>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
