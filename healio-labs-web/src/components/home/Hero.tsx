import Button from "@/components/ui/Button";
import { Eyebrow, MaskedHeading } from "@/components/ui/Section";
import HeroBackdrop from "./HeroBackdrop";

export default function Hero() {
  return (
    <section className="grain relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden bg-[var(--ground-sunken)] pb-36 pt-36 lg:pb-32 lg:pt-40">
      <HeroBackdrop />

      <div className="mx-auto w-full max-w-[1440px] px-[var(--gutter)]">
        <div className="max-w-[920px]">
          <span data-reveal className="inline-block">
            <Eyebrow>We build what&apos;s next</Eyebrow>
          </span>

          <MaskedHeading
            as="h1"
            className="t-display-xl mt-9 text-balance"
            lines={["Turning Complex Ideas", "Into Remarkable", "Digital Experiences."]}
          />

          <p
            data-reveal
            style={{ ["--reveal-delay" as string]: "360ms" }}
            className="t-body-l text-secondary mt-9 max-w-[600px]"
          >
            Healio Labs is a technology and design studio building products, platforms and brand
            systems for organisations that refuse to stand still. Strategy, design and engineering
            under one roof.
          </p>

          <div
            data-reveal
            style={{ ["--reveal-delay" as string]: "480ms" }}
            className="mt-11 flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-4"
          >
            <Button href="/#work" className="w-full sm:w-auto">
              Explore Our Work
            </Button>
            <Button href="/contact" variant="glass" className="w-full sm:w-auto">
              Start a Conversation
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-9 mx-auto w-full max-w-[1440px] px-[var(--gutter)] lg:bottom-11">
        <div
          data-reveal
          style={{ ["--reveal-delay" as string]: "640ms" }}
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <span className="t-caption text-quaternary">Est. 2014</span>
            <span className="h-2.5 w-px bg-ink/15" aria-hidden="true" />
            <span className="t-caption text-tertiary">London · Singapore · Bengaluru</span>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="t-caption text-tertiary">Scroll to explore</span>
            <span
              aria-hidden="true"
              className="h-px w-16"
              style={{ background: "linear-gradient(90deg, rgb(var(--fg-rgb) / 0.45), transparent)" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
