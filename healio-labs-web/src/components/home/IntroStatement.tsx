import { Container, Eyebrow, Section } from "@/components/ui/Section";
import ScrollRevealText from "@/components/ui/ScrollRevealText";

const META = [
  ["Practice", "Strategy · Design · Technology · Growth"],
  ["Founded", "2014"],
  ["Team", "60+ specialists"],
  ["Model", "Embedded partner teams"],
];

export default function IntroStatement() {
  return (
    <Section id="intro">
      <Container>
        <div data-reveal className="flex items-center justify-between gap-6">
          <Eyebrow>01 — Introduction</Eyebrow>
          <span className="t-caption text-quaternary">Our remit</span>
        </div>

        <ScrollRevealText
          as="h2"
          className="t-display-l mt-[clamp(2.5rem,5vw,4.5rem)] text-balance"
          text="We partner with ambitious organizations to transform ideas, technology, and strategy into experiences that move businesses forward."
        />

        <div className="mt-[clamp(3.5rem,6vw,6rem)] hairline" />

        <dl className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {META.map(([k, v], i) => (
            <div key={k} data-reveal style={{ ["--reveal-delay" as string]: `${i * 70}ms` }}>
              <dt className="t-caption text-quaternary">{k}</dt>
              <dd className="t-body-s text-secondary mt-3">{v}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
