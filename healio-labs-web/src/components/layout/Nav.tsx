"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_LINKS, STUDIO } from "@/lib/content";
import { Arrow, Logo } from "@/components/ui/Icons";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Hysteresis: engage past 24px, release at 8px, so a nav sitting near the
  // threshold cannot flicker between states.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled((prev) => (prev ? y > 8 : y > 24));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.replace("/#", "/"));

  return (
    <>
      <header
        className={[
          "fixed inset-x-0 top-0 z-50 transition-all duration-[var(--dur-base)]",
          "[transition-timing-function:var(--ease-standard)]",
          scrolled
            ? "h-[68px] border-b border-ink/10 bg-[var(--nav-scrolled)] backdrop-blur-[28px] lg:h-[76px]"
            : "h-[68px] border-b border-transparent bg-transparent lg:h-24",
        ].join(" ")}
      >
        <nav
          aria-label="Primary"
          className="mx-auto flex h-full w-full max-w-[1440px] items-center justify-between px-[var(--gutter)]"
        >
          <Link href="/" className="rounded-md" aria-label="Healio Labs — home">
            <Logo />
          </Link>

          <ul className="hidden items-center gap-9 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className={`group flex flex-col items-center gap-[7px] text-[0.9375rem] font-medium transition-colors duration-[var(--dur-quick)] ${
                    isActive(link.href) ? "text-ink" : "text-secondary hover:text-ink"
                  }`}
                >
                  {link.label}
                  <span
                    aria-hidden="true"
                    className={`h-[3px] w-[3px] rounded-full bg-ink transition-opacity duration-[var(--dur-quick)] ${
                      isActive(link.href) ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                    }`}
                  />
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden lg:block">
              <Button href="/contact" variant="glass" size="md">
                Start a Project
              </Button>
            </span>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="glass-pill flex h-11 w-11 flex-col items-center justify-center gap-[5px] rounded-full lg:hidden"
            >
              <span className="h-[1.5px] w-4 bg-ink" />
              <span className="h-[1.5px] w-[11px] bg-ink" />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      <div
        className={[
          "fixed inset-0 z-[60] lg:hidden",
          "bg-[var(--ground-sunken)] grain",
          "transition-all duration-[var(--dur-base)] [transition-timing-function:var(--ease-standard)]",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        aria-hidden={!open}
        inert={!open}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-40 h-[520px] w-[560px] rounded-full opacity-70 blur-[120px]"
          style={{ background: "radial-gradient(circle, var(--glow), transparent 70%)" }}
        />
        <div
          className="relative flex h-full flex-col px-[var(--gutter)] pb-10 pt-[14px]"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          <div className="flex h-[54px] items-center justify-between">
            <Logo />
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="glass-pill flex h-11 w-11 items-center justify-center rounded-full"
              >
                <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                  <path d="M0 0l14 14M14 0L0 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <ul className="mt-14 flex-1">
            {NAV_LINKS.map((link, i) => (
              <li key={link.label} className="border-b border-ink/[0.08]">
                <Link
                  href={link.href}
                  className="flex items-center justify-between py-5"
                >
                  <span className="flex items-center gap-3.5">
                    <span className="t-index text-quaternary">0{i + 1}</span>
                    <span className={`t-h-l ${i === 0 ? "text-ink" : "text-secondary"}`}>
                      {link.label}
                    </span>
                  </span>
                  <Arrow className="text-ink/35" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="space-y-6">
            <Button href="/contact" fullWidth magnetic={false}>
              Start a Project
            </Button>
            <div className="space-y-1.5">
              <p className="t-body-s text-secondary">{STUDIO.email}</p>
              <p className="t-caption text-quaternary">London · Singapore · Bengaluru</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
