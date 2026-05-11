"use client";

import Image from "next/image";
import Link from "next/link";
import { Familjen_Grotesk, Fraunces } from "next/font/google";
import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

import {
  getFirebaseClientServices,
  isFirebaseConfigured,
} from "@/lib/firebase/client";

const familjenGrotesk = Familjen_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--candidate-site-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--candidate-site-display",
});

type DropdownItem = {
  label: string;
  href: string;
  description: string;
};

export type PlatformSideMenuItem = {
  label: string;
  href?: string;
  active?: boolean;
  children?: PlatformSideMenuItem[];
  isSectionHeader?: boolean;
};

type PlatformUserProfile = {
  name: string;
  href: string;
  imageUrl?: string | null;
};

function getPlatformHomeHref(pathname: string) {
  if (pathname.startsWith("/candidates")) return "/candidates/home";
  if (pathname.startsWith("/admin")) return "/admin";
  if (pathname.startsWith("/clients")) return "/clients";
  if (pathname.startsWith("/managers")) return "/managers";
  if (pathname.startsWith("/participants")) return "/participants";
  if (pathname.startsWith("/speakers")) return "/speakers";
  if (pathname.startsWith("/super")) return "/super";
  return "/";
}

function getPlatformProfileHref(pathname: string) {
  if (pathname.startsWith("/candidates")) return "/candidates/profile";
  if (pathname.startsWith("/admin")) return "/admin/profile";
  if (pathname.startsWith("/clients")) return "/clients";
  if (pathname.startsWith("/managers")) return "/managers";
  if (pathname.startsWith("/participants")) return "/participants";
  if (pathname.startsWith("/super")) return "/super";
  return "/signin";
}

function mapFirebaseUserToProfile(user: User, pathname: string): PlatformUserProfile {
  return {
    name: user.displayName?.trim() || user.email?.split("@")[0] || "Profile",
    href: getPlatformProfileHref(pathname),
    imageUrl: user.photoURL,
  };
}

const solutionsItems: DropdownItem[] = [
  { label: "Data Collection", href: "/data-collection", description: "Text, audio, image and video sourcing" },
  { label: "Annotation & Gen AI", href: "/annotation", description: "RLHF, labeling, fine-tuning" },
  { label: "Evaluation & Transcription", href: "/evaluation", description: "Benchmarking, QA, transcription" },
  { label: "Managed Workforce", href: "/workforce", description: "Vetted contributors and managed teams" },
  { label: "Custom Software", href: "/custom-software", description: "Portals, pipelines, analytics" },
];

const industriesItems: DropdownItem[] = [
  { label: "Foundation Models", href: "/industries-foundation-models", description: "Pretraining, alignment, and safety data" },
  { label: "Enterprise AI", href: "/industries-enterprise", description: "Custom models and domain fine-tuning" },
  { label: "Autonomous Systems", href: "/industries-autonomous", description: "Self-driving, robotics, drones" },
  { label: "Healthcare", href: "/industries-healthcare", description: "Clinical NLP, medical imaging, compliance" },
  { label: "Public Sector", href: "/industries-public-sector", description: "Gov, defense, civic AI programs" },
];

const resourcesItems: DropdownItem[] = [
  { label: "Blog", href: "/blog", description: "Ideas from the Deaimer team" },
  { label: "Case Studies", href: "/case-studies", description: "How teams work with us" },
  { label: "Whitepapers", href: "/whitepapers", description: "Research and industry reports" },
  { label: "Documentation", href: "/docs", description: "Platform API and integration" },
  { label: "Status", href: "/status", description: "Platform uptime and incidents" },
];

const companyItems: DropdownItem[] = [
  { label: "About", href: "/company", description: "Our mission and leadership" },
  { label: "Careers", href: "/careers", description: "Open roles worldwide" },
  { label: "Newsroom", href: "/newsroom", description: "Press releases and news" },
  { label: "Ethics & Compliance", href: "/ethics", description: "Our worker welfare commitments" },
  { label: "Contact", href: "/contact", description: "Talk to our team" },
];

const mobileLinks = [
  { label: "Solutions", href: "/solutions" },
  { label: "Industries", href: "/industries-foundation-models" },
  { label: "Resources", href: "/resources" },
  { label: "Platform", href: "/platform" },
  { label: "Company", href: "/company" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
];

function DropdownMenu({ label, href, items }: { label: string; href: string; items: DropdownItem[] }) {
  return (
    <div className="group relative">
      <a
        href={href}
        className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white"
      >
        {label}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 transition group-hover:rotate-180">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>
      <div className="invisible absolute left-1/2 top-full z-40 w-[360px] -translate-x-1/2 translate-y-2 rounded-[1.2rem] border border-slate-200 bg-white p-3 opacity-0 shadow-[0_22px_60px_rgba(10,22,40,0.12)] transition-all duration-200 group-hover:visible group-hover:translate-y-3 group-hover:opacity-100">
        {items.map((item) => (
          <a key={item.href} href={item.href} className="block rounded-[0.95rem] px-4 py-3 transition hover:bg-slate-50">
            <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function DeaimerSiteShell({
  children,
  platformSideMenuItems,
  platformSideMenuTitle = "Menu",
  userProfile,
  onSignOut,
}: {
  children: ReactNode;
  platformSideMenuItems?: PlatformSideMenuItem[];
  platformSideMenuTitle?: string;
  userProfile?: PlatformUserProfile;
  onSignOut?: () => void;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authUserProfile, setAuthUserProfile] = useState<PlatformUserProfile | null>(userProfile ?? null);
  const [isAuthProfileLoading, setIsAuthProfileLoading] = useState(!userProfile);
  const [hoveredSideMenuLabel, setHoveredSideMenuLabel] = useState<string | null>(null);
  const [activeFlyoutTop, setActiveFlyoutTop] = useState(0);
  const hasPlatformSideMenu = Boolean(platformSideMenuItems?.length);
  const pathname = usePathname();
  const resolvedUserProfile = userProfile ?? authUserProfile;
  const platformHomeHref = getPlatformHomeHref(pathname);
  const sideMenuViewportRef = useRef<HTMLDivElement | null>(null);
  const sideMenuListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (userProfile) {
      setAuthUserProfile(userProfile);
      setIsAuthProfileLoading(false);
      return;
    }

    if (!isFirebaseConfigured()) {
      setAuthUserProfile(null);
      setIsAuthProfileLoading(false);
      return;
    }

    try {
      const { auth } = getFirebaseClientServices();
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setAuthUserProfile(user ? mapFirebaseUserToProfile(user, pathname) : null);
        setIsAuthProfileLoading(false);
      });
      return unsubscribe;
    } catch {
      setAuthUserProfile(null);
      setIsAuthProfileLoading(false);
      return;
    }
  }, [pathname, userProfile]);

  const activeFlyoutParent = useMemo(() => {
    if (!platformSideMenuItems?.length || !hoveredSideMenuLabel) return null;
    return platformSideMenuItems.find((item) => item.label === hoveredSideMenuLabel && item.children?.length) ?? null;
  }, [hoveredSideMenuLabel, platformSideMenuItems]);

  function handleSideMenuParentHover(label: string, event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) {
    const viewport = sideMenuViewportRef.current;
    const list = sideMenuListRef.current;
    if (!viewport || !list) {
      setHoveredSideMenuLabel(label);
      return;
    }
    const rowRect = event.currentTarget.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    setActiveFlyoutTop(rowRect.top - viewportRect.top + list.scrollTop);
    setHoveredSideMenuLabel(label);
  }

  async function handlePlatformSignOut() {
    if (onSignOut) { onSignOut(); return; }
    if (!isFirebaseConfigured()) return;
    try {
      const { auth } = getFirebaseClientServices();
      await signOut(auth);
    } catch { return; }
  }

  const fontVars = {
    "--font-sans": "var(--candidate-site-sans)",
    "--font-display": "var(--candidate-site-display)",
  } as CSSProperties;

  // ─── PLATFORM LAYOUT (persistent sidebar) ───────────────────────────────────
  if (hasPlatformSideMenu) {
    return (
      <div className={`${familjenGrotesk.variable} ${fraunces.variable} min-h-screen bg-[#f7faff] text-ink`} style={fontVars}>

        {/* Mobile overlay */}
        <div
          className={[
            "fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm transition lg:hidden",
            isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* ── Persistent sidebar ─────────────────────────────────────────────── */}
        <aside
          className={[
            "fixed left-0 top-0 z-50 flex h-full w-[220px] flex-col border-r border-slate-200 bg-white transition-transform duration-300",
            "lg:translate-x-0 lg:shadow-none",
            isMobileMenuOpen
              ? "translate-x-0 shadow-[0_20px_60px_rgba(10,22,40,0.18)]"
              : "-translate-x-full",
          ].join(" ")}
        >
          {/* Logo row */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <Link href={platformHomeHref} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center">
              <Image
                src="/reference-site/deaimer-logo.png"
                alt="Deaimer"
                width={130}
                height={22}
                className="h-[18px] w-auto"
                priority
              />
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 lg:hidden"
              aria-label="Close menu"
            >
              ×
            </button>
          </div>

          {/* Nav list */}
          <div
            ref={sideMenuViewportRef}
            className="relative flex-1 overflow-visible"
            onMouseLeave={() => setHoveredSideMenuLabel(null)}
          >
            <div ref={sideMenuListRef} className="h-full overflow-y-auto px-2 py-2">
              {platformSideMenuItems?.map((item) => {
                if (item.isSectionHeader) {
                  return (
                    <div
                      key={`${item.label}-section`}
                      className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400"
                    >
                      {item.label}
                    </div>
                  );
                }

                const isActive = item.active ?? (item.href ? pathname === item.href : false);
                const hasChildren = Boolean(item.children?.length);

                if (hasChildren) {
                  const trigger = (
                    <>
                      <span>{item.label}</span>
                      <span className="text-[10px] text-slate-400">›</span>
                    </>
                  );
                  const triggerClass = [
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive ? "bg-[#eef4fb] text-[#1a6cd4]" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ");

                  return (
                    <div key={`${item.label}-group`}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          onClick={(e) => {
                            if (window.innerWidth < 1024) {
                              e.preventDefault();
                              setHoveredSideMenuLabel(hoveredSideMenuLabel === item.label ? null : item.label);
                            } else {
                              setIsMobileMenuOpen(false);
                            }
                          }}
                          onMouseEnter={(e) => handleSideMenuParentHover(item.label, e)}
                          onFocus={(e) => handleSideMenuParentHover(item.label, e)}
                          className={triggerClass}
                        >
                          {trigger}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.innerWidth < 1024) {
                              setHoveredSideMenuLabel(hoveredSideMenuLabel === item.label ? null : item.label);
                            }
                          }}
                          onMouseEnter={(e) => handleSideMenuParentHover(item.label, e)}
                          onFocus={(e) => handleSideMenuParentHover(item.label, e)}
                          className={triggerClass}
                        >
                          {trigger}
                        </button>
                      )}
                    </div>
                  );
                }

                return item.href ? (
                  <Link
                    key={`${item.label}-${item.href}`}
                    href={item.href}
                    onClick={() => { setHoveredSideMenuLabel(null); setIsMobileMenuOpen(false); }}
                    onMouseEnter={() => setHoveredSideMenuLabel(null)}
                    onFocus={() => setHoveredSideMenuLabel(null)}
                    className={[
                      "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive ? "bg-[#eef4fb] text-[#1a6cd4]" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div
                    key={`${item.label}-placeholder`}
                    onMouseEnter={() => setHoveredSideMenuLabel(null)}
                    className="px-3 py-2 text-sm font-medium text-slate-400"
                  >
                    {item.label}
                  </div>
                );
              })}
            </div>

            {/* Desktop flyout for children */}
            {activeFlyoutParent ? (
              <div
                className="absolute left-full z-20 hidden w-[260px] -translate-x-px border-y border-r border-slate-200 bg-white shadow-[0_18px_50px_rgba(10,22,40,0.12)] lg:block"
                style={{ top: activeFlyoutTop }}
              >
                {activeFlyoutParent.children?.map((child) => {
                  const isChildActive = child.active ?? (child.href ? pathname === child.href : false);
                  return child.href ? (
                    <Link
                      key={`${activeFlyoutParent.label}-${child.label}`}
                      href={child.href}
                      onClick={() => { setHoveredSideMenuLabel(null); setIsMobileMenuOpen(false); }}
                      className={[
                        "block border-b border-slate-100 px-5 py-3.5 text-sm font-medium transition last:border-b-0",
                        isChildActive ? "bg-[#eef4fb] text-[#1a6cd4]" : "text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {child.label}
                    </Link>
                  ) : (
                    <div
                      key={`${activeFlyoutParent.label}-${child.label}`}
                      className="border-b border-slate-100 px-5 py-3.5 text-sm font-medium text-slate-400 last:border-b-0"
                    >
                      {child.label}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Mobile inline children */}
            {activeFlyoutParent ? (
              <div className="border-y border-slate-100 bg-slate-50 lg:hidden">
                {activeFlyoutParent.children?.map((child) => {
                  const isChildActive = child.active ?? (child.href ? pathname === child.href : false);
                  return child.href ? (
                    <Link
                      key={`mobile-${activeFlyoutParent.label}-${child.label}`}
                      href={child.href}
                      onClick={() => { setHoveredSideMenuLabel(null); setIsMobileMenuOpen(false); }}
                      className={[
                        "block border-b border-slate-100 py-3 pl-9 pr-5 text-sm font-medium transition last:border-b-0",
                        isChildActive ? "bg-[#eef4fb] text-[#1a6cd4]" : "text-slate-700 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      {child.label}
                    </Link>
                  ) : (
                    <div
                      key={`mobile-${activeFlyoutParent.label}-${child.label}`}
                      className="border-b border-slate-100 py-3 pl-9 pr-5 text-sm font-medium text-slate-400 last:border-b-0"
                    >
                      {child.label}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Bottom: profile + sign out */}
          {resolvedUserProfile || onSignOut || authUserProfile ? (
            <div className="border-t border-slate-200 px-2 py-2.5">
              {resolvedUserProfile ? (
                <Link
                  href={resolvedUserProfile.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-slate-100"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0b4f73] text-xs font-semibold text-white">
                    {resolvedUserProfile.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolvedUserProfile.imageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      resolvedUserProfile.name.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{resolvedUserProfile.name}</p>
                    <p className="text-[11px] text-slate-400">View profile</p>
                  </div>
                </Link>
              ) : null}
              {resolvedUserProfile || onSignOut ? (
                <button
                  type="button"
                  onClick={() => { setIsMobileMenuOpen(false); void handlePlatformSignOut(); }}
                  className="mt-0.5 flex w-full items-center rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  Sign out
                </button>
              ) : null}
            </div>
          ) : null}
        </aside>

        {/* ── Thin top bar — fixed, offset by sidebar on lg+ ─────────────────── */}
        <header className="fixed left-0 right-0 top-0 z-30 flex h-11 items-center border-b border-slate-200 bg-white/95 backdrop-blur-sm lg:left-[220px]">
          <div className="flex flex-1 items-center gap-2 px-3">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center text-slate-500 transition hover:text-slate-900 lg:hidden"
              aria-label="Open menu"
            >
              <span className="space-y-[4px]">
                <span className="block h-[1.5px] w-[18px] rounded-full bg-current" />
                <span className="block h-[1.5px] w-[18px] rounded-full bg-current" />
                <span className="block h-[1.5px] w-[18px] rounded-full bg-current" />
              </span>
            </button>
            {/* Logo — mobile only (desktop sidebar has it) */}
            <Link href={platformHomeHref} className="flex items-center lg:hidden">
              <Image
                src="/reference-site/deaimer-logo.png"
                alt="Deaimer"
                width={120}
                height={20}
                className="h-[17px] w-auto"
                priority
              />
            </Link>
          </div>

          {/* Profile — top right */}
          <div className="flex items-center pr-3">
            {resolvedUserProfile ? (
              <Link
                href={resolvedUserProfile.href}
                className="flex items-center gap-2 rounded-full px-2.5 py-1 transition hover:bg-slate-100"
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0b4f73] text-xs font-semibold text-white">
                  {resolvedUserProfile.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolvedUserProfile.imageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    resolvedUserProfile.name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="hidden max-w-[130px] truncate text-sm font-medium text-slate-700 sm:block">
                  {resolvedUserProfile.name}
                </span>
              </Link>
            ) : isAuthProfileLoading ? (
              <div className="h-7 w-[100px] rounded-full bg-slate-100" />
            ) : null}
          </div>
        </header>

        {/* ── Content + footer — offset by sidebar on lg+ ────────────────────── */}
        <div className="flex min-h-screen flex-col lg:pl-[220px]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(78,163,255,0.14),transparent_42%),linear-gradient(180deg,rgba(27,79,117,0.08)_0%,rgba(247,250,255,1)_58%,rgba(255,255,255,1)_100%)]" />
          <div className="relative z-10 flex-1 pt-11">{children}</div>
          <footer className="relative z-10 border-t border-slate-200 bg-white px-4 py-4 text-[#5a6b85] sm:px-6">
            <div className="mx-auto max-w-[1600px] text-sm text-slate-400">
              © 2026 Deaimer (SMC-Private) Limited. All rights reserved.
            </div>
          </footer>
        </div>
      </div>
    );
  }

  // ─── MARKETING / NON-PLATFORM LAYOUT (unchanged) ────────────────────────────
  return (
    <div
      className={`${familjenGrotesk.variable} ${fraunces.variable} flex min-h-screen flex-col bg-[#f7faff] text-ink`}
      style={fontVars}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(78,163,255,0.14),transparent_42%),linear-gradient(180deg,rgba(27,79,117,0.08)_0%,rgba(247,250,255,1)_58%,rgba(255,255,255,1)_100%)]" />

      <header className="sticky top-0 z-30 flex h-11 items-center border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="flex flex-1 items-center px-3">
          <Link href={platformHomeHref} className="flex items-center transition hover:opacity-90">
            <Image
              src="/reference-site/deaimer-logo.png"
              alt="Deaimer"
              width={120}
              height={20}
              className="h-[17px] w-auto"
              priority
            />
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex-1 pt-6">{children}</div>

      <footer className="relative z-10 mt-auto border-t border-slate-200 bg-white px-4 py-4 text-[#5a6b85] sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1600px] text-sm text-slate-400">
          © 2026 Deaimer (SMC-Private) Limited. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
