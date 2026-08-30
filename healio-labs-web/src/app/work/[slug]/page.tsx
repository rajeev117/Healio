import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PROJECTS, getNextProject, getProject } from "@/lib/content";
import { Container, Eyebrow, MaskedHeading, Section } from "@/components/ui/Section";
import { Arrow } from "@/components/ui/Icons";
import ProjectVisual from "@/components/visuals/ProjectVisual";
import { FlagshipShot, DesktopMock, PhoneMock } from "@/components/visuals/DeviceShowcase";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: `${project.name} — ${project.industry}`,
    description: project.summary,
    openGraph: { title: `${project.name} — Healio Labs`, description: project.summary },
  };
}

export default async function CaseStudyPage({ params }: Params) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  const next = getNextProject(slug);

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="grain relative isolate overflow-hidden bg-[var(--ground-sunken)] pb-16 pt-40 lg:pb-24 lg:pt-52">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-1/3 left-1/2 h-[760px] w-[1250px] max-w-[130vw] -translate-x-1/2 blur-[140px]"
          style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
        />
        <Container className="relative">
          <Link
            href="/#work"
            data-reveal
            className="inline-flex items-center gap-3 text-tertiary transition-colors hover:text-ink"
          >
            <Arrow flip />
            <span className="t-body-s">All work</span>
          </Link>

          <div data-reveal className="mt-14">
            <Eyebrow>Case study — {project.index}</Eyebrow>
          </div>

          <MaskedHeading as="h1" className="t-display-xl mt-9" lines={[project.name]} />

          <p data-reveal className="t-body-l text-secondary mt-8 max-w-[760px]">
            {project.summary}
          </p>

          <dl className="mt-[clamp(3rem,5vw,4.5rem)] grid grid-cols-2 gap-8 lg:grid-cols-4">
            {[
              ["Client", project.client],
              ["Industry", project.industry],
              ["Year", project.year],
              ["Services", project.services.join(" · ")],
            ].map(([k, v], i) => (
              <div key={k} data-reveal style={{ ["--reveal-delay" as string]: `${i * 70}ms` }}>
                <dt className="t-caption text-quaternary">{k}</dt>
                <div className="my-3.5 h-px w-full bg-ink/10" />
                <dd className="t-body-s text-secondary">{v}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* ---------- immersive visual ---------- */}
      <section className="bg-[var(--ground-sunken)] pb-[clamp(3rem,6vw,6rem)]">
        <Container>
          <div data-reveal>
            <FlagshipShot />
          </div>
        </Container>
      </section>

      {/* ---------- overview ---------- */}
      <Narrative label="Overview" heading="The engagement" body={[project.overview]} />

      {/* ---------- challenge ---------- */}
      <Section ground="raised">
        <Container>
          <div className="flex flex-col gap-12 lg:flex-row lg:gap-[7.5rem]">
            <div data-reveal className="lg:w-[300px] lg:shrink-0">
              <Eyebrow>Challenge</Eyebrow>
            </div>
            <div className="flex-1">
              <h2 data-reveal className="t-h-l max-w-[760px] text-balance">
                What stood in the way
              </h2>
              {project.challenge.map((p, i) => (
                <p
                  key={i}
                  data-reveal
                  className={`max-w-[760px] ${i === 0 ? "t-body-l text-secondary mt-8" : "t-body-m text-tertiary mt-5"}`}
                >
                  {p}
                </p>
              ))}

              <div
                data-reveal
                className="glass mt-12 flex flex-col gap-6 rounded-[20px] px-8 py-8 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="t-caption text-quaternary">{project.callout.beforeLabel}</p>
                  <p className="t-body-m text-secondary mt-2">{project.callout.before}</p>
                </div>
                <Arrow className="hidden shrink-0 text-ink/50 sm:block" />
                <div>
                  <p className="t-caption text-quaternary">{project.callout.afterLabel}</p>
                  <p className="t-body-m mt-2">{project.callout.after}</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ---------- approach ---------- */}
      <Section>
        <Container>
          <div data-reveal>
            <Eyebrow>Approach</Eyebrow>
            <h2 className="t-h-xl mt-9 max-w-[900px] text-balance">
              Evidence first. Systems second. Screens last.
            </h2>
          </div>
          <div className="mt-[clamp(3rem,5vw,5rem)] grid gap-6 md:grid-cols-3">
            {project.approach.map((a, i) => (
              <article
                key={a.index}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${i * 100}ms` }}
                className="glass rounded-[20px] p-8"
              >
                <span className="t-index text-quaternary">{a.index}</span>
                <h3 className="t-h-s mt-7">{a.title}</h3>
                <p className="t-body-s text-tertiary mt-3.5">{a.body}</p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------- solution ---------- */}
      <Section ground="raised">
        <Container>
          <div data-reveal>
            <Eyebrow>Solution</Eyebrow>
            <h2 className="t-h-xl mt-9 max-w-[1000px] text-balance">{project.solutionHeading}</h2>
            <p className="t-body-l text-secondary mt-7 max-w-[760px]">{project.solution}</p>
          </div>

          <div className="mt-[clamp(3rem,5vw,5rem)] grid gap-6 md:grid-cols-2">
            <div data-reveal className="glass flex items-center justify-center rounded-[20px] p-8">
              <PhoneMock />
            </div>
            <div data-reveal style={{ ["--reveal-delay" as string]: "100ms" }} className="glass overflow-hidden rounded-[20px] p-8">
              <DesktopMock />
            </div>
          </div>
        </Container>
      </Section>

      {/* ---------- results ---------- */}
      <Section ground="sunken" grain>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-[600px] w-[1200px] max-w-[125vw] -translate-x-1/2 blur-[140px]"
          style={{ background: "radial-gradient(closest-side, var(--glow-soft), transparent)" }}
        />
        <Container className="relative">
          <div data-reveal>
            <Eyebrow>Results</Eyebrow>
            <h2 className="t-h-xl mt-9">Twelve months after launch.</h2>
          </div>
          <dl className="mt-[clamp(3.5rem,6vw,6rem)] grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            {project.results.map((r, i) => (
              <div key={r.label} data-reveal style={{ ["--reveal-delay" as string]: `${i * 110}ms` }}>
                <dd className="t-stat">{r.value}</dd>
                <div className="my-5 h-px w-full bg-ink/[0.14]" />
                <dt className="t-h-xs">{r.label}</dt>
                <p className="t-body-s text-tertiary mt-2.5">{r.detail}</p>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      {/* ---------- gallery ---------- */}
      <Section>
        <Container>
          <div data-reveal>
            <Eyebrow>Gallery</Eyebrow>
          </div>
          <div data-reveal className="mt-12">
            <ProjectVisual kind={project.visual} />
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div data-reveal className="glass flex aspect-[3/2] items-center justify-center rounded-[20px] p-10">
              <span className="t-display-xxl leading-none text-ink/90">Aa</span>
            </div>
            <div data-reveal style={{ ["--reveal-delay" as string]: "90ms" }} className="glass relative flex aspect-[3/2] items-center justify-center overflow-hidden rounded-[20px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="absolute rounded-full border border-ink/25"
                  style={{
                    height: `${56 + i * 64}px`,
                    width: `${56 + i * 64}px`,
                    opacity: 0.9 - i * 0.16,
                  }}
                />
              ))}
              <span className="h-3 w-3 rounded-full bg-ink" />
            </div>
          </div>
        </Container>
      </Section>

      {/* ---------- next project ---------- */}
      <section className="grain relative isolate overflow-hidden bg-[var(--ground-sunken)]">
        <Link href={`/work/${next.slug}`} className="group block">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-1/3 right-0 h-[660px] w-[1100px] blur-[140px]"
            style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
          />
          <div className="relative mx-auto flex min-h-[560px] w-full max-w-[1440px] flex-col justify-center px-[var(--gutter)] py-24">
            <div className="pointer-events-none absolute right-[6%] top-1/2 hidden -translate-y-1/2 lg:block">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full border border-ink/15"
                  style={{ height: `${170 + i * 130}px`, width: `${170 + i * 130}px`, right: 0, marginRight: `${-((170 + i * 130) / 2)}px` }}
                />
              ))}
            </div>
            <p data-reveal className="t-eyebrow text-tertiary">
              Next project
            </p>
            <h2 data-reveal className="t-display-xl mt-6 transition-transform duration-[var(--dur-slow)] [transition-timing-function:var(--ease-standard)] group-hover:translate-x-2">
              {next.name}
            </h2>
            <p data-reveal className="t-body-m text-tertiary mt-6 max-w-[640px]">
              {next.industry} · {next.services.join(" · ")}
            </p>
            <span data-reveal className="mt-10 inline-flex items-center gap-3.5">
              <span className="t-body-m">View case study</span>
              <Arrow className="transition-transform duration-[var(--dur-base)] group-hover:translate-x-2" />
            </span>
          </div>
        </Link>
      </section>
    </>
  );
}

function Narrative({
  label,
  heading,
  body,
}: {
  label: string;
  heading: string;
  body: string[];
}) {
  return (
    <Section>
      <Container>
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-[7.5rem]">
          <div data-reveal className="lg:w-[300px] lg:shrink-0">
            <Eyebrow>{label}</Eyebrow>
          </div>
          <div className="flex-1">
            <h2 data-reveal className="t-h-l max-w-[760px] text-balance">
              {heading}
            </h2>
            {body.map((p, i) => (
              <p key={i} data-reveal className="t-body-l text-secondary mt-8 max-w-[760px]">
                {p}
              </p>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
