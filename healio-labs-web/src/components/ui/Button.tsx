import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow } from "./Icons";
import Magnetic from "./Magnetic";

type Variant = "primary" | "glass" | "ghost";
type Size = "lg" | "md";

const base =
  "group relative inline-flex items-center justify-center gap-3 rounded-full font-medium " +
  "transition-[background-color,border-color,color,transform,box-shadow] duration-[var(--dur-base)] " +
  "[transition-timing-function:var(--ease-standard)] whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--solid-bg)] text-[var(--solid-fg)] hover:opacity-90",
  glass: "glass-pill text-ink hover:bg-[var(--glass-04)]",
  ghost: "text-ink hover:text-ink/80 px-0",
};

const sizes: Record<Size, string> = {
  lg: "h-14 px-8 text-[0.9375rem]",
  md: "h-11 px-[1.375rem] text-sm",
};

export type ButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  magnetic?: boolean;
  className?: string;
  type?: "button" | "submit";
  fullWidth?: boolean;
};

export default function Button({
  children,
  href,
  variant = "primary",
  size = "lg",
  arrow = true,
  magnetic = true,
  className = "",
  type = "button",
  fullWidth = false,
}: ButtonProps) {
  const cls = [
    base,
    variants[variant],
    variant === "ghost" ? (size === "lg" ? "h-14 text-[0.9375rem]" : "h-11 text-sm") : sizes[size],
    fullWidth ? "w-full" : "",
    className,
  ].join(" ");

  const inner = (
    <>
      <span>{children}</span>
      {arrow && (
        <Arrow className="transition-transform duration-[var(--dur-base)] [transition-timing-function:var(--ease-standard)] group-hover:translate-x-1.5" />
      )}
      {variant === "ghost" && (
        <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-100 bg-ink/25 transition-colors duration-[var(--dur-base)] group-hover:bg-ink/70" />
      )}
    </>
  );

  const el = href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type={type} className={cls}>
      {inner}
    </button>
  );

  return magnetic ? <Magnetic>{el}</Magnetic> : el;
}
