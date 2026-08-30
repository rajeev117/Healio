import ScrollRevealText from "@/components/ui/ScrollRevealText";

export default function Manifesto() {
  return (
    <section className="grain relative isolate flex items-center justify-center overflow-hidden bg-[var(--ground-sunken)] px-[var(--gutter)] py-[clamp(6.5rem,14vw,13rem)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[1300px] max-w-[130vw] -translate-x-1/2 -translate-y-1/2 blur-[140px]"
        style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/[0.05] lg:block"
      />

      <div className="relative mx-auto max-w-[1080px] text-center">
        <p data-reveal className="t-eyebrow text-quaternary">
          Healio Labs — Manifesto
        </p>

        <ScrollRevealText
          as="h2"
          dimFrom={0.32}
          className="t-display-l mt-12 text-balance"
          text="Good technology solves problems. Great technology changes how people think."
        />

        <div
          data-reveal
          className="mx-auto mt-14 h-px w-40"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgb(var(--fg-rgb) / 0.5), transparent)",
          }}
        />
      </div>
    </section>
  );
}
