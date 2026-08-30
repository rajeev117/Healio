import Button from "@/components/ui/Button";
import { Container, Eyebrow, Section } from "@/components/ui/Section";
import { STUDIO } from "@/lib/content";

const META = [
  ["Email", STUDIO.email],
  ["Studio", "21 Charlotte Road, London EC2A 3PB"],
  ["Social", STUDIO.social.join(" · ")],
];

export default function ContactCta() {
  return (
    <Section>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[1200px] max-w-[125vw] -translate-x-1/2 -translate-y-1/2 blur-[140px]"
        style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
      />

      <Container className="relative">
        <div
          data-reveal
          className="glass-02 rounded-[32px] px-7 py-12 sm:px-12 sm:py-14 lg:px-20 lg:py-20"
        >
          <Eyebrow>08 — Contact</Eyebrow>

          <h2 className="t-display-l mt-10 max-w-[900px] text-balance">
            Have Something Worth Building?
          </h2>

          <p className="t-body-l text-secondary mt-7 max-w-[620px]">
            Tell us what you&apos;re working on and let&apos;s create something remarkable together.
          </p>

          <div className="mt-12 flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-4">
            <Button href="/contact">Start a Conversation</Button>
            <Button href={`mailto:${STUDIO.email}`} variant="ghost">
              {STUDIO.email}
            </Button>
          </div>

          <div className="mt-16 h-px w-full bg-ink/10" />

          <dl className="mt-8 grid gap-8 sm:grid-cols-3">
            {META.map(([k, v]) => (
              <div key={k}>
                <dt className="t-caption text-quaternary">{k}</dt>
                <dd className="t-body-s text-secondary mt-3 max-w-[320px]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </Section>
  );
}
