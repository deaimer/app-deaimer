import { servicePages } from "./service-pages";

export interface MegaMenuLink {
  title: string;
  description?: string;
  href: string;
}

export interface MegaMenuColumn {
  heading: string;
  description?: string;
  href: string;
  items: MegaMenuLink[];
}

export interface NavItem {
  label: string;
  href: string;
  hasDropdown?: boolean;
  featured?: boolean;
  columns?: MegaMenuColumn[];
}

export const siteTheme = {
  colors: {
    background: "#f7faff",
    panel: "#ffffff",
    panelStrong: "#eef4fb",
    primary: "#2b85f0",
    primaryStrong: "#1a6cd4",
    primarySoft: "#4ea3ff",
    ink: "#0a1628",
    muted: "#5a6b85",
    menuSurface: "#ffffff",
    menuText: "#0a1628",
    menuMuted: "#5a6b85",
    menuBorder: "#e5ecf5",
    menuHighlight: "#eef4fb",
  },
  fonts: {
    sans: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    heading: 'Georgia, "Times New Roman", serif',
  },
} as const;

export const siteCopy = {
  metadata: {
    title: "Deaimer | Data Collection and Annotation Services",
    description:
      "Deaimer supports AI teams with data collection, annotation, RLHF programs, and custom workflow systems.",
  },
  brand: {
    name: "Deaimer",
    tagline: "Data operations for AI teams",
    logoFileName: "DeaimerLogox.png",
    logoPath: "/branding/DeaimerLogox.png",
    logoWidth: 3200,
    logoHeight: 560,
  },
  cta: {
    label: "Contact",
    href: "/contact",
  },
  signIn: {
    label: "Sign In",
    href: "/admin",
  },
  nav: [
    {
      label: "Solutions",
      href: "/services",
      hasDropdown: true,
      columns: servicePages.map((service) => ({
        heading: service.title,
        description: service.menuDescription,
        href: `/services/${service.slug}`,
        items: service.menuItems.map((item) => ({
          title: item,
          href: `/services/${service.slug}`,
        })),
      })),
    },
    { label: "Resources", href: "/resources", hasDropdown: false },
    { label: "Company", href: "/how-we-work", hasDropdown: false },
    { label: "Platforms", href: "/platforms", hasDropdown: false },
  ] satisfies NavItem[],
  hero: {
    badge: "Managed delivery for AI data programs",
    eyebrow: "Deaimer",
    title: "From global sourcing to model-ready AI delivery.",
    description:
      "Deaimer runs the human operations layer behind collection, annotation, RLHF, evaluation, and custom infrastructure for AI teams that need dependable execution.",
    tags: [
      "Global sourcing",
      "RLHF + labeling",
      "QA-led delivery",
    ],
    primaryCta: {
      label: "Start a Conversation",
      href: "#contact",
    },
    secondaryCta: {
      label: "View Services",
      href: "#services",
    },
    stats: [
      {
        label: "Service model",
        value: "5 integrated units",
        detail: "Collection, annotation, evaluation, workforce, and infrastructure in one operating layer.",
      },
      {
        label: "Operating reach",
        value: "Global contributor coverage",
        detail: "Targeted participant sourcing and managed teams built for repeatable scale.",
      },
      {
        label: "Delivery control",
        value: "QA-led execution",
        detail: "Review, reporting, and secure project handling from intake to output.",
      },
    ],
  },
  services: {
    eyebrow: "Services",
    title: "Five operating units. One delivery system.",
    description:
      "Every engagement is built from the same five service layers so sourcing, enrichment, review, workforce management, and infrastructure stay coordinated from day one.",
    cards: servicePages.map((service) => ({
      index: service.index,
      title: service.title,
      metric: service.metric,
      description: service.description,
      tags: service.tags.slice(0, 4),
      href: `/services/${service.slug}`,
    })),
    operatingModel: {
      eyebrow: "Delivery approach",
      title: "How delivery actually runs",
      description:
        "We combine intake, execution, review, and reporting into one managed workflow so AI teams get speed without losing control.",
      steps: [
        "Define the project scope and participant requirements",
        "Run collection or annotation with managed oversight",
        "Review output through QA and reporting workflows",
      ],
    },
  },
  stack: {
    eyebrow: "Systems",
    title: "Infrastructure for the human side of AI",
    description:
      "Our platform layer connects portals, access control, workflow automation, and reporting so operational delivery stays visible and secure as programs scale.",
    tags: [
      "Next.js App Router",
      "TypeScript",
      "Tailwind CSS",
      "Firebase",
    ],
    blueprintTitle: "Implementation outline",
    blueprintItems: [
      {
        label: "Frontend",
        value: "Responsive pages and role-based portal entry points",
      },
      {
        label: "Authentication",
        value: "Google sign-in for approved user types and admin roles",
      },
      {
        label: "Data layer",
        value: "Firestore profiles and workflow records as the system expands",
      },
    ],
    cards: [
      {
        name: "Role-based access",
        description:
          "Separate entry points for super admins, admins, managers, clients, and participants.",
      },
      {
        name: "Operational tooling",
        description:
          "A foundation for dashboards, approvals, assignments, and reporting.",
      },
      {
        name: "Scalable structure",
        description:
          "A modular setup that can grow from a website into a full operations platform.",
      },
    ],
  },
  contact: {
    eyebrow: "Contact",
    title: "Tell us what you need to build",
    description:
      "If you are planning a data collection, annotation, or evaluation program, send a short brief and we can discuss the next steps.",
    highlights: [
      {
        label: "Typical projects",
        value: "Collection, annotation, evaluation, and workflow tooling",
      },
      {
        label: "Working style",
        value: "Structured delivery, managed communication, and practical reporting",
      },
    ],
    fields: [
      {
        label: "Name",
        id: "name",
        name: "name",
        placeholder: "Your name",
      },
      {
        label: "Work email",
        id: "email",
        name: "email",
        type: "email",
        placeholder: "you@company.com",
      },
      {
        label: "Company",
        id: "company",
        name: "company",
        placeholder: "Company name",
      },
    ],
    messageField: {
      label: "Project summary",
      id: "message",
      name: "message",
      placeholder: "Tell us about your project, timeline, and the kind of support you need.",
    },
    submitLabel: "Send Request",
    note: "Current form submissions are connected to the Firestore lead helper.",
  },
  footer: {
    left: "Deaimer supports data collection, annotation, evaluation, and workflow operations for AI teams.",
    right: "Professional delivery for clients, managers, admins, and participant programs.",
  },
} as const;
