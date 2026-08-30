import type { Metadata } from "next";
import { Container, Eyebrow, MaskedHeading } from "@/components/ui/Section";
import { Arrow } from "@/components/ui/Icons";
import ContactForm from "@/components/contact/ContactForm";
import { STUDIO } from "@/lib/content";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Tell us what you're working on and let's create something remarkable together. Healio Labs — London, Singapore, Bengaluru.",
};

export default function ContactPage() {
  return (
    <section className="grain relative isolate overflow-hidden bg-[var(--ground-sunken)] pb-[clamp(5rem,10vw,10rem)] pt-40 lg:pt-52">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-1/4 left-1/2 h-[820px] w-[1300px] max-w-[130vw] -translate-x-1/2 blur-[150px]"
        style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 mx-auto max-w-[1440px]">
        {[8, 36, 64, 92].map((left) => (
          <span
            key={left}
            className="absolute top-0 h-full w-px bg-ink/[0.03]"
            style={{ left: `${left}%` }}
          />
        ))}
      </div>

      <Container className="relative">
        <div data-reveal>
          <Eyebrow>Contact</Eyebrow>
        </div>

        <MaskedHeading
          as="h1"
          className="t-display-xl mt-9 max-w-[1040px]"
          lines={["Have Something", "Worth Building?"]}
        />

        <p data-reveal className="t-body-l text-secondary mt-8 max-w-[620px]">
          Tell us what you&apos;re working on and let&apos;s create something remarkable together.
        </p>

        <div className="mt-[clamp(3rem,6vw,5.5rem)] flex flex-col gap-12 lg:flex-row lg:gap-20">
          <div data-reveal className="min-w-0 flex-1">
            <ContactForm />
          </div>

          <aside data-reveal style={{ ["--reveal-delay" as string]: "120ms" }} className="lg:w-[300px] lg:shrink-0">
            <span className="glass-pill inline-flex items-center gap-3 rounded-full px-5 py-3.5">
              <span className="h-[7px] w-[7px] rounded-full bg-ink" />
              <span className="t-body-s text-secondary">Booking Q1 2027</span>
            </span>

            <dl className="mt-12 space-y-8">
              <div>
                <dt className="t-caption text-quaternary">Email</dt>
                <dd className="mt-3 space-y-1.5">
                  <a href={`mailto:${STUDIO.email}`} className="t-body-m text-secondary block transition-colors hover:text-ink">
                    {STUDIO.email}
                  </a>
                  <a href={`mailto:${STUDIO.newBusiness}`} className="t-body-m text-secondary block transition-colors hover:text-ink">
                    {STUDIO.newBusiness}
                  </a>
                </dd>
              </div>

              <div>
                <dt className="t-caption text-quaternary">Phone</dt>
                <dd className="mt-3">
                  <a href={`tel:${STUDIO.phone.replace(/\s/g, "")}`} className="t-body-m text-secondary transition-colors hover:text-ink">
                    {STUDIO.phone}
                  </a>
                </dd>
              </div>

              {STUDIO.locations.map((loc) => (
                <div key={loc.city}>
                  <dt className="t-caption text-quaternary">{loc.city}</dt>
                  <dd className="t-body-m text-secondary mt-3">
                    {loc.lines.map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 h-px w-full bg-ink/10" />

            <p className="t-caption text-quaternary mt-7">Social</p>
            <ul className="mt-4">
              {STUDIO.social.map((s) => (
                <li key={s}>
                  <a
                    href="#"
                    className="group flex items-center justify-between py-2.5 transition-colors hover:text-ink"
                  >
                    <span className="t-body-s text-secondary group-hover:text-ink">{s}</span>
                    <Arrow className="text-ink/35 transition-transform duration-[var(--dur-base)] group-hover:translate-x-1" />
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Container>
    </section>
  );
}
