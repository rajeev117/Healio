export type VisualKind = "nova" | "aether" | "forma" | "helix";

export type Project = {
  slug: string;
  index: string;
  name: string;
  industry: string;
  client: string;
  year: string;
  services: string[];
  summary: string;
  description: string;
  visual: VisualKind;
  overview: string;
  challenge: string[];
  callout: { beforeLabel: string; before: string; afterLabel: string; after: string };
  approach: { index: string; title: string; body: string }[];
  solutionHeading: string;
  solution: string;
  results: { value: string; label: string; detail: string }[];
};

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/#about" },
  { label: "Services", href: "/#services" },
  { label: "Projects", href: "/#work" },
  { label: "Capabilities", href: "/#capabilities" },
  { label: "Contact", href: "/contact" },
];

export const SERVICES = [
  {
    index: "01",
    title: "Strategy",
    summary: "Digital strategy, product strategy, transformation, research.",
    detail: [
      "Market & user research",
      "Product and service strategy",
      "Transformation roadmaps",
      "Operating model design",
    ],
    icon: "strategy" as const,
  },
  {
    index: "02",
    title: "Design",
    summary: "Brand systems, UX/UI, product experiences, visual systems.",
    detail: [
      "Brand and identity systems",
      "Design systems at scale",
      "UX/UI and prototyping",
      "Motion and interaction design",
    ],
    icon: "design" as const,
  },
  {
    index: "03",
    title: "Technology",
    summary: "Web platforms, software products, AI solutions, integrations.",
    detail: [
      "Web and native platforms",
      "AI and applied ML systems",
      "Cloud architecture",
      "Integration and data layers",
    ],
    icon: "technology" as const,
  },
  {
    index: "04",
    title: "Growth",
    summary: "Optimization, analytics, experimentation, digital growth.",
    detail: [
      "Analytics and measurement",
      "CRO and experimentation",
      "Lifecycle and CRM",
      "Performance engineering",
    ],
    icon: "growth" as const,
  },
];

export const PROCESS = [
  {
    index: "01",
    title: "Discover",
    body: "Research, audits, stakeholder interviews and opportunity mapping.",
    duration: "2–4 weeks",
  },
  {
    index: "02",
    title: "Define",
    body: "Strategy, scope, architecture and the metrics that define success.",
    duration: "2 weeks",
  },
  {
    index: "03",
    title: "Design",
    body: "Systems, prototypes and validated end-to-end experiences.",
    duration: "4–8 weeks",
  },
  {
    index: "04",
    title: "Build",
    body: "Engineering, QA, integration and production hardening.",
    duration: "6–16 weeks",
  },
  {
    index: "05",
    title: "Launch",
    body: "Release, measure, iterate and scale with the in-house team.",
    duration: "Ongoing",
  },
];

export const TESTIMONIALS = [
  {
    quote:
      "Healio Labs did not just deliver a platform. They rebuilt how our product organisation makes decisions.",
    name: "Marianne Okafor",
    role: "Chief Product Officer",
    company: "Nova Financial",
  },
  {
    quote:
      "The most rigorous team we have worked with. Nothing shipped that could not be defended with evidence.",
    name: "Daniel Reyes",
    role: "VP Engineering",
    company: "Aether AI",
  },
  {
    quote:
      "They understood our practice better than agencies who had worked in architecture for a decade.",
    name: "Ines Marchetti",
    role: "Managing Partner",
    company: "Forma Architecture",
  },
  {
    quote: "Clinicians adopted it in weeks, not quarters. That is the entire story.",
    name: "Dr. Arun Prakash",
    role: "Chief Medical Information Officer",
    company: "Helix Health",
  },
];

export const CLIENTS = [
  "Nova Financial",
  "Aether AI",
  "Forma",
  "Helix Health",
  "Northlight",
  "Vantage Group",
  "Cobalt",
  "Meridian",
  "Orbit Labs",
  "Praxis",
  "Stratum",
  "Lumen",
];

export const STATS = [
  { value: 12, suffix: "+", label: "Years Experience" },
  { value: 48, suffix: "+", label: "Projects Delivered" },
  { value: 18, suffix: "", label: "Global Partners" },
];

export const STUDIO = {
  email: "hello@healiolabs.com",
  newBusiness: "newbusiness@healiolabs.com",
  phone: "+44 20 7946 0112",
  locations: [
    { city: "London", lines: ["21 Charlotte Road", "London EC2A 3PB"] },
    { city: "Singapore", lines: ["8 Marina View", "Singapore 018960"] },
    { city: "Bengaluru", lines: ["Level 9, Prestige Tower", "Bengaluru 560001"] },
  ],
  social: ["LinkedIn", "Instagram", "X / Twitter", "Dribbble"],
};

export const PROJECTS: Project[] = [
  {
    slug: "nova-financial",
    index: "01",
    name: "Nova Financial",
    industry: "Digital banking platform",
    client: "Nova Financial Group",
    year: "2025",
    services: ["Strategy", "UX", "Technology"],
    summary:
      "A ground-up retail banking platform for 4.2 million customers — rebuilt around clarity, speed and trust, and migrated without a day of downtime.",
    description:
      "A ground-up retail banking experience for 4.2 million customers, rebuilt around clarity, speed and trust.",
    visual: "nova",
    overview:
      "Nova Financial asked us to rebuild their retail banking experience end to end — brand, product and platform — without interrupting service for 4.2 million existing customers. The engagement ran for fourteen months across three offices, with our strategists, designers and engineers embedded alongside Nova's own product organisation from week one.",
    challenge: [
      "Nova's app had grown by acquisition. Four codebases, three design languages, and a support queue where 38% of tickets came from people who simply could not find something.",
      "Onboarding was the sharpest edge: fourteen steps, six of them redundant, and 61% of new customers abandoning before their first transaction. Every quarter of delay cost more than the rebuild itself.",
    ],
    callout: {
      beforeLabel: "Before",
      before: "14 steps to open an account",
      afterLabel: "After",
      after: "5 steps, 4 minutes median",
    },
    approach: [
      {
        index: "01",
        title: "Ground truth",
        body: "Six weeks of branch shadowing, forty customer interviews and a full audit of the legacy stack before a single wireframe.",
      },
      {
        index: "02",
        title: "A system, not screens",
        body: "A token-driven design system covering 240 components, shipped and documented before feature design began.",
      },
      {
        index: "03",
        title: "Ship, measure, repeat",
        body: "Weekly releases behind feature flags, with a live experiment running on every critical funnel.",
      },
    ],
    solutionHeading: "An account view that answers the only question most people open the app to ask.",
    solution:
      "A single React Native and web platform sharing one token-driven design system. Onboarding reduced from fourteen steps to five. A home screen that leads with balance, movement and next action — and nothing else.",
    results: [
      { value: "+42%", label: "Conversion", detail: "Applications completed vs. legacy flow" },
      { value: "2.4×", label: "Engagement", detail: "Weekly active sessions per customer" },
      { value: "31%", label: "Faster Onboarding", detail: "Median time to first transaction" },
      { value: "4.2M", label: "Customers Migrated", detail: "Zero unplanned downtime" },
    ],
  },
  {
    slug: "aether-ai",
    index: "02",
    name: "Aether AI",
    industry: "AI-powered enterprise platform",
    client: "Aether Intelligence",
    year: "2025",
    services: ["Brand", "Product Design", "Development"],
    summary:
      "An enterprise intelligence layer that turns fragmented operational data into decisions teams actually trust.",
    description:
      "An enterprise intelligence layer that turns fragmented operational data into decisions teams actually trust.",
    visual: "aether",
    overview:
      "Aether had a genuinely strong model and almost no way for a non-technical operator to act on it. We built the brand, the product language and the front end of an enterprise platform now deployed across eleven industrial clients.",
    challenge: [
      "The output was accurate and unusable. Predictions arrived as dense tables with no provenance, so operations managers quietly ignored them and kept working from spreadsheets.",
      "Trust was the real product problem. Any interface that could not show its reasoning would be overridden within a fortnight, regardless of how good the underlying model was.",
    ],
    callout: {
      beforeLabel: "Before",
      before: "Predictions overridden in 71% of shifts",
      afterLabel: "After",
      after: "Accepted in 84% of shifts",
    },
    approach: [
      {
        index: "01",
        title: "Explain every number",
        body: "Every prediction carries its confidence, its inputs and the three factors that moved it most — one tap away, always.",
      },
      {
        index: "02",
        title: "Design for the floor",
        body: "Built and tested on plant-floor tablets in gloves and bad light, not on a designer's colour-calibrated monitor.",
      },
      {
        index: "03",
        title: "A language for uncertainty",
        body: "A visual system that distinguishes a confident forecast from a provisional one without a single colour cue.",
      },
    ],
    solutionHeading: "An intelligence layer that shows its work.",
    solution:
      "A monochrome, density-first interface built around a single decision surface. Confidence is expressed structurally rather than chromatically, and every recommendation is one interaction away from the evidence behind it.",
    results: [
      { value: "84%", label: "Recommendation Uptake", detail: "Up from 29% on the legacy dashboard" },
      { value: "11", label: "Industrial Clients", detail: "Deployed in the first year post-launch" },
      { value: "−38%", label: "Time to Decision", detail: "Median shift-planning cycle" },
      { value: "3.1×", label: "Daily Active Use", detail: "Sessions per operations manager" },
    ],
  },
  {
    slug: "forma-architecture",
    index: "03",
    name: "Forma Architecture",
    industry: "Digital experience for a global architecture studio",
    client: "Forma Partnership",
    year: "2024",
    services: ["Strategy", "Web", "Experience"],
    summary:
      "A portfolio platform where the architecture — not the interface — does the talking.",
    description:
      "A portfolio platform where the architecture — not the interface — does the talking.",
    visual: "forma",
    overview:
      "Forma builds at civic scale across nine countries. Their previous site treated a 400,000 square metre transit hub and a private house as identical thumbnails in identical grids. We rebuilt the platform around the work itself.",
    challenge: [
      "Forma were losing competitive pitches to studios with weaker portfolios. Their projects were extraordinary; the presentation of them was a content management system with a logo on top.",
      "The practice also needed the site to work as a recruitment instrument. The best graduates were choosing rivals whose digital presence suggested more ambition than Forma's did.",
    ],
    callout: {
      beforeLabel: "Before",
      before: "Uniform grid, 9s average visit",
      afterLabel: "After",
      after: "Editorial sequencing, 4m 12s average",
    },
    approach: [
      {
        index: "01",
        title: "Scale is the story",
        body: "Every project page is composed around the drawing that best explains it, at the size it deserves.",
      },
      {
        index: "02",
        title: "Restraint as identity",
        body: "One typeface, one grid, no colour. The interface recedes so the buildings can carry the page.",
      },
      {
        index: "03",
        title: "Built for the archive",
        body: "A content model that handles thirty years of drawings, models and photography without a redesign.",
      },
    ],
    solutionHeading: "A platform built to disappear behind the work.",
    solution:
      "Editorially sequenced project pages, a full-bleed image pipeline serving art-directed crops at every breakpoint, and an archive that curators and recruiters can both navigate. The interface never competes with the drawing.",
    results: [
      { value: "4m 12s", label: "Average Visit", detail: "Up from 9 seconds on the previous site" },
      { value: "+64%", label: "Pitch Shortlists", detail: "Competitive invitations year on year" },
      { value: "2.9×", label: "Graduate Applications", detail: "First full recruitment cycle" },
      { value: "0.9s", label: "Largest Contentful Paint", detail: "Median, image-heavy pages" },
    ],
  },
  {
    slug: "helix-health",
    index: "04",
    name: "Helix Health",
    industry: "Connected healthcare platform",
    client: "Helix Health Network",
    year: "2024",
    services: ["Product", "UX", "Technology"],
    summary:
      "One record, every clinician, zero friction. Connected care across a forty-hospital network.",
    description:
      "One record, every clinician, zero friction — connected care for a forty-hospital network.",
    visual: "helix",
    overview:
      "Helix runs forty hospitals and more than three hundred clinics. A patient moving between two of them effectively started over. We designed and built the clinical layer that made one record real across the whole network.",
    challenge: [
      "Nine separate record systems, no shared patient identity, and clinicians who had learned to work around the software rather than with it. Every previous rollout had failed at adoption, not at engineering.",
      "The margin for error was not commercial. A slow or confusing interface in a clinical setting is a safety problem, and any design that added a step to a handover would be abandoned by the second week.",
    ],
    callout: {
      beforeLabel: "Before",
      before: "9 systems, 6 logins per shift",
      afterLabel: "After",
      after: "One record, one sign-on",
    },
    approach: [
      {
        index: "01",
        title: "Shadow the shift",
        body: "Two hundred hours observing handovers, ward rounds and night shifts before proposing anything.",
      },
      {
        index: "02",
        title: "Fewest possible steps",
        body: "Every clinical task was measured in taps and seconds, then rebuilt until it beat the paper workflow.",
      },
      {
        index: "03",
        title: "Roll out by ward",
        body: "Ward-by-ward release with embedded clinical leads, so adoption was earned rather than mandated.",
      },
    ],
    solutionHeading: "A record that keeps up with a ward round.",
    solution:
      "A single longitudinal record with one sign-on, offline-tolerant handover, and a task surface designed around the ninety seconds a clinician actually has. Built to be faster than the paper it replaced, on the hardware already on the ward.",
    results: [
      { value: "94%", label: "Clinician Adoption", detail: "Within eight weeks of ward rollout" },
      { value: "−41%", label: "Handover Time", detail: "Median shift handover duration" },
      { value: "40", label: "Hospitals Live", detail: "Plus 312 connected clinics" },
      { value: "−27%", label: "Duplicate Tests", detail: "Across the network, year one" },
    ],
  },
];

export function getProject(slug: string) {
  return PROJECTS.find((p) => p.slug === slug);
}

export function getNextProject(slug: string) {
  const i = PROJECTS.findIndex((p) => p.slug === slug);
  return PROJECTS[(i + 1) % PROJECTS.length];
}
