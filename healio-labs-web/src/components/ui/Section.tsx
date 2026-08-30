import type { ReactNode } from "react";

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3.5 ${className}`}>
      <span className="h-px w-[30px] bg-ink/35" aria-hidden="true" />
      <span className="t-eyebrow text-tertiary">{children}</span>
    </span>
  );
}

export function Container({
  children,
  className = "",
  bleed = false,
}: {
  children: ReactNode;
  className?: string;
  bleed?: boolean;
}) {
  if (bleed) return <div className={className}>{children}</div>;
  return (
    <div className={`mx-auto w-full max-w-[var(--max)] px-[var(--gutter)] ${className}`}>
      {children}
    </div>
  );
}

export function Section({
  id,
  children,
  ground = "base",
  className = "",
  grain = false,
}: {
  id?: string;
  children: ReactNode;
  ground?: "base" | "raised" | "sunken";
  className?: string;
  grain?: boolean;
}) {
  const bg =
    ground === "raised"
      ? "bg-[var(--ground-raised)]"
      : ground === "sunken"
        ? "bg-[var(--ground-sunken)]"
        : "bg-[var(--ground-base)]";
  return (
    <section
      id={id}
      className={`relative isolate overflow-hidden ${bg} ${grain ? "grain" : ""} py-[clamp(5rem,11vw,11rem)] ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  lead,
  aside,
  className = "",
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div data-reveal className="max-w-[660px]">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="t-h-xl mt-8 text-balance">{title}</h2>
      </div>
      {lead && (
        <p data-reveal style={{ ["--reveal-delay" as string]: "90ms" }} className="t-body-m text-tertiary max-w-[400px]">
          {lead}
        </p>
      )}
      {aside}
    </div>
  );
}

/** Splits a heading into lines so each can rise out of its own mask. */
export function MaskedHeading({
  lines,
  as: Tag = "h1",
  className = "",
}: {
  lines: string[];
  as?: "h1" | "h2" | "p";
  className?: string;
}) {
  return (
    <Tag className={`line-mask ${className}`}>
      {lines.map((line, i) => (
        <span key={i}>
          <span style={{ ["--line-delay" as string]: `${i * 90}ms` }}>{line}</span>
        </span>
      ))}
    </Tag>
  );
}
