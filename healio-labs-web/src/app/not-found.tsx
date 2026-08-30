import Link from "next/link";
import { Container } from "@/components/ui/Section";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="grain relative isolate flex min-h-[80svh] items-center overflow-hidden bg-[var(--ground-sunken)] py-40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[1000px] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 blur-[140px]"
        style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
      />
      <Container className="relative">
        <p className="t-eyebrow text-tertiary">Error 404</p>
        <h1 className="t-display-l mt-8 max-w-[760px] text-balance">
          This page isn&apos;t part of the work.
        </h1>
        <p className="t-body-l text-secondary mt-7 max-w-[520px]">
          The link may be out of date. Head back to the studio, or look through selected work.
        </p>
        <div className="mt-11 flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-4">
          <Button href="/">Back to home</Button>
          <Button href="/#work" variant="glass">
            Selected work
          </Button>
        </div>
        <p className="t-caption text-quaternary mt-14">
          Or <Link href="/contact" className="underline underline-offset-4">tell us what you were looking for</Link>
        </p>
      </Container>
    </section>
  );
}
