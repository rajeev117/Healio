"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";

const PROJECT_TYPES = ["Digital Product", "Brand & Design", "AI & Data", "Platform Build", "Growth"];
const BUDGETS = ["£50–100k", "£100–250k", "£250–500k", "£500k+"];

type Errors = Partial<Record<"name" | "email" | "message", string>>;

export default function ContactForm() {
  const [type, setType] = useState(PROJECT_TYPES[0]);
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    const next: Errors = {};
    if (!name) next.name = "Please tell us your name.";
    if (!email) next.email = "We need an email to reply to.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "That email doesn't look right.";
    if (!message) next.message = "A sentence or two is plenty.";

    setErrors(next);
    if (Object.keys(next).length) {
      const first = document.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`);
      first?.focus();
      return;
    }

    // TODO: wire to a real endpoint (route handler + transactional mail provider).
    // Nothing is transmitted yet — this only advances the local UI state.
    setSent(true);
  };

  if (sent) {
    return (
      <div className="glass-02 rounded-[28px] px-7 py-14 text-center sm:px-14 sm:py-20">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-ink/30">
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <path d="M4 10.5 8 14.5 16 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </span>
        <h2 className="t-h-m mt-8">Thanks — that&apos;s with us.</h2>
        <p className="t-body-m text-secondary mx-auto mt-4 max-w-[420px]">
          A senior member of the team will reply within two working days. If it&apos;s urgent, call
          the studio directly.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="t-body-s text-tertiary mt-9 underline underline-offset-4 transition-colors hover:text-ink"
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="glass-02 rounded-[28px] px-6 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-14"
    >
      <p className="t-caption text-quaternary">Project enquiry</p>

      <div className="mt-9 grid gap-6 sm:grid-cols-2">
        <Field label="Name" name="name" placeholder="Priya Raghunathan" error={errors.name} />
        <Field
          label="Email"
          name="email"
          type="email"
          placeholder="you@company.com"
          error={errors.email}
        />
      </div>

      <div className="mt-6">
        <Field label="Company" name="company" placeholder="Nova Financial Group" optional />
      </div>

      <ChipGroup
        label="Project type"
        name="projectType"
        options={PROJECT_TYPES}
        value={type}
        onChange={setType}
        className="mt-9"
      />
      <ChipGroup
        label="Budget"
        name="budget"
        options={BUDGETS}
        value={budget}
        onChange={setBudget}
        className="mt-8"
      />

      <div className="mt-9">
        <Field
          label="Message"
          name="message"
          textarea
          placeholder="Tell us about the problem, the timeline and what success looks like."
          error={errors.message}
        />
      </div>

      <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
        <Button type="submit" magnetic={false}>
          Start a Conversation
        </Button>
        <p className="t-body-xs text-tertiary max-w-[240px]">
          We reply within two working days.
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  textarea = false,
  optional = false,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
  optional?: boolean;
  error?: string;
}) {
  const id = `field-${name}`;
  const base =
    "mt-3 w-full rounded-[12px] border bg-[var(--glass-01)] px-5 py-4 t-body-m text-ink " +
    "placeholder:text-[var(--ink-4)] transition-colors duration-[var(--dur-base)] " +
    "focus:border-ink/45 focus:bg-[var(--glass-03)] focus:outline-none " +
    (error ? "border-ink/50" : "border-[var(--line-subtle)]");

  return (
    <div>
      <label htmlFor={id} className="t-caption text-quaternary">
        {label}
        {optional && <span className="ml-2 normal-case tracking-normal opacity-70">(optional)</span>}
      </label>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          rows={5}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${base} resize-y`}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={base}
        />
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="t-body-xs mt-2.5 text-ink/80">
          {error}
        </p>
      )}
    </div>
  );
}

function ChipGroup({
  label,
  name,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  name: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="t-caption text-quaternary">{label}</legend>
      <input type="hidden" name={name} value={value} />
      <div className="mt-4 flex flex-wrap gap-2.5">
        {options.map((o) => {
          const active = o === value;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              aria-pressed={active}
              className={`rounded-full px-4 py-2.5 transition-all duration-[var(--dur-quick)] ${
                active
                  ? "bg-[var(--solid-bg)] text-[var(--solid-fg)]"
                  : "border border-[var(--line-subtle)] bg-[var(--glass-01)] text-secondary hover:border-ink/30 hover:text-ink"
              }`}
            >
              <span className="t-body-s">{o}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
