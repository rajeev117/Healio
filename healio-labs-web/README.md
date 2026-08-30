# Healio Labs — corporate website

Minimalist glassmorphism + monochromatic marketing site for Healio Labs.
Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript — matching the
stack used by `healio-admin`.

> This is a separate app from `healio-website/index.html` (the existing
> green/sage single-file site). That file is untouched.

```bash
npm install
npm run dev     # http://localhost:3400
npm run build   # all routes prerender static
```

## Routes

| Route | Rendering | Notes |
|---|---|---|
| `/` | Static | Hero, statement, about, services, work showcase, process, manifesto, testimonials, clients, contact CTA |
| `/work/[slug]` | SSG (4 pages) | Full case study — hero, overview, challenge, approach, solution, results, gallery, next project |
| `/contact` | Static | Glass enquiry form + studio details |
| `/_not-found` | Static | 404 |

## Theming

The site ships **light and dark**, with a toggle in the nav (and in the mobile
menu). Three states:

| State | `data-theme` | Behaviour |
|---|---|---|
| System (default) | absent | Follows `prefers-color-scheme`, live |
| Light | `light` | Explicit, persisted |
| Dark | `dark` | Explicit, persisted |

- `ThemeScript` (`next/script`, `beforeInteractive`) applies the stored choice
  **before first contentful paint**, so there is no flash of the wrong palette.
  `<html>` carries `suppressHydrationWarning` because that script mutates an
  attribute React rendered.
- `ThemeToggle` reads the resolved theme with `useSyncExternalStore` rather than
  mirroring it into state — no `setState` in an effect, and the server snapshot
  is `null` so SSR and client markup match. Both icons stay mounted and
  cross-fade, so the control never reflows.
- With no stored choice the toggle keeps tracking the OS preference live.

## Design system

Everything lives in `src/app/globals.css`. Colour is deliberately absent —
hierarchy is made with **weight, scale, opacity and space** only.

The whole palette is **one ink colour over a ground**. Light and dark are the
same system with that relationship inverted, so components are written once
against semantic tokens and never against `white`:

- `--fg-rgb` is the ink channel (`255 255 255` dark, `12 12 14` light) and is
  exposed to Tailwind as the `ink` colour — `bg-ink/10`, `border-ink/12` and
  `text-ink/70` all flip automatically.
- `--solid-bg` / `--solid-fg` are the inverted pair used by primary buttons and
  selected chips (white-on-dark, dark-on-light).
- Surfaces that must stay a *light source* in both themes — the ambient glows
  and the bloom inside project visuals — use their own `--glow` / `--viz-glow`
  tokens rather than following the ink.
- Panel and mockup gradients (`--viz-*`, `--mock-*`) invert too, so the abstract
  case-study visuals read as light frosted panels in light mode.

- **Grounds** `--ground-sunken / base / raised / elevated`
- **Glass fills** `--glass-01…04` — white at 3.5%→13% on dark, 55%→96% on
  light — applied through the
  `.glass`, `.glass-02`, `.glass-03`, `.glass-pill` classes, each pairing a
  background blur with a 1px top inner highlight and a soft drop shadow
- **Hairlines** `--line-hairline / subtle / strong`
- **Text** `--ink-1 / 2 / 3 / 4`, surfaced as `.text-secondary`, `.text-tertiary`,
  `.text-quaternary`
- **Type ramp** `.t-display-xxl … .t-body-xs`, `.t-eyebrow`, `.t-caption`,
  `.t-index`, `.t-stat`. All display sizes are fluid (`clamp`) and
  negative-tracked. Inter for display/body, Geist Mono for eyebrows and indices.
- **Motion tokens** `--ease-standard / entrance / exit`,
  `--dur-instant … --dur-reveal`
- **Grain** `.grain` adds a noise overlay via an inline SVG `feTurbulence`

Layout uses `--gutter` (fluid 24px → 120px) and a 1200px content max-width.

## Motion architecture

`src/components/system/MotionProvider.tsx` mounts **one** IntersectionObserver
for the whole document and drives four primitives:

| Attribute | Effect |
|---|---|
| `data-reveal` | fade + rise + deblur (stagger via `--reveal-delay`) |
| `.line-mask` | per-line mask reveal for display headings |
| `data-draw` | left-to-right line draw (process rail) |
| `data-pop` | sequential node pop (`--pop-delay`) |

Because the observer is global, **sections stay server components** — they only
add an attribute, no client boundary. Client components are limited to the ones
that genuinely need interaction: `Nav`, `Projects`, `Testimonials`,
`ContactForm`, `Magnetic`, `CountUp`, `ScrollRevealText`, `HeroBackdrop`.

### Two deliberate details

- **Reveal styles are scoped to `.js`**, and `MotionProvider` adds that class
  after hydration in the same tick as the first visibility pass. Content is
  therefore never hidden by CSS the page has no script to undo — with JS off, or
  before hydration, everything renders in its final state.
- **`CountUp` initialises to the final value** and only rewinds to zero once it
  knows the element is off-screen. The SSR HTML contains the real number, not a
  placeholder `0`.

### Reduced motion

`prefers-reduced-motion: reduce` collapses every transition to a 150ms fade,
disables the panel drift, cursor parallax, magnetic buttons and gradient sweep,
and renders the scroll-linked text fully lit. Nothing is gated behind an
animation that cannot run.

## Accessibility

- Skip link, `:focus-visible` rings (2px `--ink-1`, 2px offset) on every control
- Mobile menu: focus moves to Close on open and returns to the trigger on close,
  Escape dismisses, body scroll locks, `inert` when hidden
- Horizontal showcases are **native scroll containers** (keyboard and touch
  work) rather than scroll-hijacked
- Counters expose the final value via `aria-label`, not each increment
- Decorative glass, glows and grain are `aria-hidden`
- Contrast against the page ground, both themes:

  | Token | Dark | Light |
  |---|---|---|
  | `--ink-1` | 19.7:1 | 17.2:1 |
  | `--ink-2` | 9.7:1 | 7.5:1 |
  | `--ink-3` | 4.6:1 (AA) | 4.6:1 (AA) |
  | `--ink-4` | 2.6:1 | 2.5:1 |

  `--ink-4` fails AA in both themes by design: it is used only for decorative or
  duplicated labels, never as the sole carrier of information.
- `color-scheme` flips with the theme, so form controls and scrollbars follow.

## Known gap

`src/components/contact/ContactForm.tsx` validates client-side and advances to a
confirmation state, but **does not transmit anything yet** — there is no route
handler or mail provider wired up. See the `TODO` in `onSubmit`.

## Content

All copy, projects, testimonials and studio details live in
`src/lib/content.ts`. Case studies are data-driven — adding an entry to
`PROJECTS` creates a new statically generated `/work/[slug]` page and adds it to
the home showcase and footer automatically.
