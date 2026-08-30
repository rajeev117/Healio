import { Container, Eyebrow, Section } from "@/components/ui/Section";
import { CLIENTS } from "@/lib/content";

export default function Clients() {
  return (
    <Section ground="raised" className="!py-[clamp(4rem,8vw,9rem)]">
      <Container>
        <div data-reveal className="flex flex-wrap items-center justify-between gap-4">
          <Eyebrow>07 — Clients &amp; partners</Eyebrow>
          <span className="t-caption text-quaternary">48 projects · 11 countries</span>
        </div>

        <ul
          data-reveal
          className="mt-14 grid grid-cols-2 border-l border-t border-ink/[0.055] sm:grid-cols-3 lg:grid-cols-4"
        >
          {CLIENTS.map((name) => (
            <li key={name} className="border-b border-r border-ink/[0.055]">
              <a
                href="#"
                className="group flex h-[110px] items-center justify-center gap-3 transition-colors duration-[var(--dur-quick)] hover:bg-[var(--glass-02)] sm:h-[132px]"
                aria-label={name}
              >
                <span
                  aria-hidden="true"
                  className="relative flex h-[18px] w-[18px] items-center justify-center rounded-full border border-ink/35 transition-colors duration-[var(--dur-quick)] group-hover:border-ink"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-ink/35 transition-colors duration-[var(--dur-quick)] group-hover:bg-ink" />
                </span>
                <span className="t-h-xs font-semibold text-ink/[0.34] transition-colors duration-[var(--dur-quick)] group-hover:text-ink">
                  {name}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
