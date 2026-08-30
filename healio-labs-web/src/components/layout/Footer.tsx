import Link from "next/link";
import { NAV_LINKS, PROJECTS, STUDIO } from "@/lib/content";
import { Logo } from "@/components/ui/Icons";
import Button from "@/components/ui/Button";

export default function Footer() {
  return (
    <footer className="relative isolate overflow-hidden bg-[var(--ground-sunken)] pb-11 pt-[clamp(4rem,8vw,7rem)]">
      {/* animated gradient rule sweeping the top edge */}
      <div className="sweep absolute inset-x-0 top-0 h-px" aria-hidden="true" />

      <div className="mx-auto w-full max-w-[1440px] px-[var(--gutter)]">
        <div className="flex flex-col gap-14 lg:flex-row lg:justify-between lg:gap-20">
          <div data-reveal className="max-w-[300px] space-y-7">
            <Logo />
            <p className="t-body-s text-tertiary">
              Technology and design for organisations that refuse to stand still.
            </p>
            <Button href="/contact" variant="ghost" size="md">
              Start a Project
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:gap-[4.5rem]">
            <FooterColumn title="Sitemap">
              {NAV_LINKS.map((l) => (
                <Link key={l.label} href={l.href} className="footer-link">
                  {l.label}
                </Link>
              ))}
            </FooterColumn>

            <FooterColumn title="Selected work">
              {PROJECTS.map((p) => (
                <Link key={p.slug} href={`/work/${p.slug}`} className="footer-link">
                  {p.name}
                </Link>
              ))}
            </FooterColumn>

            <FooterColumn title="Connect">
              {STUDIO.social.map((s) => (
                <a key={s} href="#" className="footer-link">
                  {s}
                </a>
              ))}
            </FooterColumn>

            <FooterColumn title="Studio">
              <a href={`mailto:${STUDIO.email}`} className="footer-link">
                {STUDIO.email}
              </a>
              <a href={`tel:${STUDIO.phone.replace(/\s/g, "")}`} className="footer-link">
                {STUDIO.phone}
              </a>
              <span className="footer-link">21 Charlotte Road</span>
              <span className="footer-link">London EC2A 3PB</span>
            </FooterColumn>
          </div>
        </div>

        {/* oversized watermark */}
        <p
          aria-hidden="true"
          className="t-display-xxl mt-[clamp(3.5rem,7vw,6rem)] mb-10 w-full select-none font-bold leading-none text-ink/[0.045]"
          style={{ fontSize: "clamp(3rem, 12.6vw, 11.6rem)" }}
        >
          HEALIO LABS
        </p>

        <div className="hairline" />

        <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="t-body-xs text-quaternary">© 2026 Healio Labs. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-5 sm:gap-7">
            {["Privacy", "Terms", "Cookies"].map((l) => (
              <a key={l} href="#" className="t-body-xs text-tertiary transition-colors hover:text-ink">
                {l}
              </a>
            ))}
            <span className="hidden h-3 w-px bg-ink/15 sm:block" aria-hidden="true" />
            <span className="t-caption text-quaternary">London 51.52°N / 0.08°W</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div data-reveal className="flex flex-col gap-[18px]">
      <h3 className="t-caption text-quaternary">{title}</h3>
      {children}
    </div>
  );
}
