import { Container, Eyebrow, Section } from "@/components/ui/Section";
import { PROCESS } from "@/lib/content";

export default function Process() {
  return (
    <Section id="process" ground="raised">
      <Container>
        <div data-reveal>
          <Eyebrow>05 — Process</Eyebrow>
        </div>
        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <h2 data-reveal className="t-h-xl max-w-[620px] text-balance">
            How the work gets made.
          </h2>
          <p data-reveal className="t-body-m text-tertiary max-w-[400px]">
            A single sequence, run transparently. Every stage has an owner, a deliverable and a
            decision gate.
          </p>
        </div>

        {/* desktop rail */}
        <div className="relative mt-[clamp(3.5rem,7vw,6.5rem)] hidden lg:block">
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink/10" />
            <div
              data-draw
              className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2"
              style={{
                background: "linear-gradient(90deg, rgb(var(--fg-rgb) / 0.85), rgb(var(--fg-rgb) / 0.28))",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-between">
              {PROCESS.map((s, i) => (
                <span
                  key={s.index}
                  data-pop
                  style={{ ["--pop-delay" as string]: `${i * 220}ms` }}
                  className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border border-ink/90"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-ink" />
                </span>
              ))}
            </div>
          </div>

          <ol className="mt-11 flex justify-between gap-6">
            {PROCESS.map((s, i) => (
              <li
                key={s.index}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${i * 110}ms` }}
                className="w-[200px]"
              >
                <StepBody {...s} />
              </li>
            ))}
          </ol>
        </div>

        {/* mobile: vertical rail */}
        <ol className="mt-14 lg:hidden">
          {PROCESS.map((s, i) => (
            <li key={s.index} data-reveal className="flex gap-5 pb-7">
              <div className="relative flex w-4 shrink-0 flex-col items-center">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-ink/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink" />
                </span>
                {i < PROCESS.length - 1 && <span className="mt-1 w-px flex-1 bg-ink/25" />}
              </div>
              <div className="-mt-1 flex-1">
                <StepBody {...s} />
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}

function StepBody({
  index,
  title,
  body,
  duration,
}: {
  index: string;
  title: string;
  body: string;
  duration: string;
}) {
  return (
    <>
      <div className="flex items-center gap-3 lg:block">
        <span className="t-index text-ink/70">{index}</span>
        <h3 className="t-h-s lg:mt-4">{title}</h3>
      </div>
      <p className="t-body-s text-tertiary mt-3.5">{body}</p>
      <p className="t-caption text-quaternary mt-5">{duration}</p>
    </>
  );
}
