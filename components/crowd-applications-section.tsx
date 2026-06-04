"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  crowdWorkApplicationStatusOptions,
  subscribeToCrowdWorkAllApplications,
  subscribeToCrowdWorkApplicationsByPosts,
  subscribeToCrowdWorkPostsByAdmin,
  updateCrowdWorkApplicationStatus,
  type CrowdWorkApplication,
  type CrowdWorkApplicationStatus,
  type CrowdWorkPost,
} from "@/lib/firebase/crowd-work";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(createdAt: unknown): string {
  if (!createdAt || typeof createdAt !== "object") return "—";
  const ts = createdAt as { toDate?: () => Date; seconds?: number };
  const date = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : null;
  if (!date) return "—";
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

const statusLabels: Record<CrowdWorkApplicationStatus, string> = {
  viewed: "Viewed",
  applied: "Applied",
  "under-review": "Under Review",
  approved: "Approved",
};

const statusBadgeClass: Record<CrowdWorkApplicationStatus, string> = {
  viewed: "border-slate-200 bg-slate-50 text-slate-600",
  applied: "border-amber-200 bg-amber-50 text-amber-900",
  "under-review": "border-sky-200 bg-sky-50 text-sky-900",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

function StatusBadge({ status }: { status: CrowdWorkApplicationStatus }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusBadgeClass[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function CrowdAppDrawer({
  application,
  onClose,
  canManage,
}: {
  application: CrowdWorkApplication;
  onClose: () => void;
  canManage: boolean;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<CrowdWorkApplicationStatus>(application.status);

  useEffect(() => { setCurrentStatus(application.status); }, [application.status]);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleStatus(status: CrowdWorkApplicationStatus) {
    setIsUpdating(true);
    setCurrentStatus(status);
    try {
      await updateCrowdWorkApplicationStatus(application.id, status);
    } catch {
      setCurrentStatus(application.status);
    } finally {
      setIsUpdating(false);
    }
  }

  const details = [
    { label: "Name", value: application.applicantName || "—" },
    { label: "Email", value: application.applicantEmail || "—" },
    { label: "WhatsApp", value: application.applicantWhatsapp || "—" },
    { label: "Project ID", value: application.postId || "—" },
    { label: "Project", value: application.postTitle || "—" },
    { label: "Submitted", value: formatTimestamp(application.createdAt) },
  ];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={[
        "absolute flex flex-col overflow-hidden bg-white",
        "bottom-0 left-0 right-0 max-h-[88vh] rounded-t-[1.5rem] shadow-[0_-20px_60px_rgba(10,22,40,0.22)]",
        "lg:bottom-0 lg:left-auto lg:right-0 lg:top-0 lg:h-full lg:w-[480px] lg:max-h-full lg:rounded-none lg:rounded-l-[1.5rem] lg:shadow-[-24px_0_60px_rgba(10,22,40,0.14)]",
      ].join(" ")}>
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-slate-200 lg:hidden" />

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-3 lg:pt-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
                Crowd applicant
              </p>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                Crowd
              </span>
            </div>
            <h2 className="mt-1 text-xl font-semibold text-ink">
              {application.applicantName || "Applicant"}
            </h2>
            <div className="mt-2">
              <StatusBadge status={currentStatus} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
          {canManage ? (
            <select
              value={currentStatus}
              onChange={(e) => void handleStatus(e.target.value as CrowdWorkApplicationStatus)}
              disabled={isUpdating}
              className="h-9 rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-ink outline-none transition hover:border-primary/40 focus:border-primary/40 disabled:opacity-60"
            >
              {crowdWorkApplicationStatusOptions.map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          ) : null}
          {application.applicantWhatsapp ? (
            <a
              href={`https://wa.me/${application.applicantWhatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              WhatsApp
            </a>
          ) : null}
          {application.applicantEmail ? (
            <a
              href={`mailto:${application.applicantEmail}`}
              className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 transition hover:bg-sky-100"
            >
              Email
            </a>
          ) : null}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            {details.map(({ label, value }) => (
              <div key={label} className="rounded-[1rem] border border-slate-100 bg-panelStrong px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
                <p className="mt-1 text-sm font-medium text-ink">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export function CrowdApplicationsSection({
  activeUser,
  canManage = false,
  isSuperAdmin = false,
}: {
  activeUser: User;
  canManage?: boolean;
  isSuperAdmin?: boolean;
}) {
  const [applications, setApplications] = useState<CrowdWorkApplication[]>([]);
  const [adminPosts, setAdminPosts] = useState<CrowdWorkPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [drawerApp, setDrawerApp] = useState<CrowdWorkApplication | null>(null);
  const filtersScrollRef = useRef<HTMLDivElement | null>(null);

  // Load admin's assigned posts (non-super only)
  useEffect(() => {
    if (isSuperAdmin) return;
    const email = activeUser.email ?? "";
    return subscribeToCrowdWorkPostsByAdmin(email, setAdminPosts, () => {});
  }, [activeUser.email, isSuperAdmin]);

  // Load applications
  useEffect(() => {
    setIsLoading(true);
    if (isSuperAdmin) {
      return subscribeToCrowdWorkAllApplications((apps) => {
        setApplications(apps);
        setIsLoading(false);
      }, () => setIsLoading(false));
    } else {
      const postDocIds = adminPosts.map((p) => p.id);
      return subscribeToCrowdWorkApplicationsByPosts(postDocIds, (apps) => {
        setApplications(apps);
        setIsLoading(false);
      }, () => setIsLoading(false));
    }
  }, [isSuperAdmin, adminPosts]);

  const viewedCount = applications.filter((a) => a.status === "viewed").length;
  const appliedCount = applications.filter((a) => a.status === "applied").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;

  const projectOptions = Array.from(
    new Map(applications.map((a) => [a.postDocId, a.postTitle || a.postId])).entries()
  );

  const filtered = applications.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (projectFilter !== "all" && a.postDocId !== projectFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !a.applicantName.toLowerCase().includes(q) &&
        !a.applicantEmail.toLowerCase().includes(q) &&
        !a.postId.toLowerCase().includes(q) &&
        !a.postTitle.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  function scrollFilters(direction: "left" | "right") {
    filtersScrollRef.current?.scrollBy({ left: direction === "left" ? -320 : 320, behavior: "smooth" });
  }

  const filterInputClass = (isActive: boolean, extra = "") =>
    [
      "h-11 rounded-full border px-4 text-sm font-medium outline-none transition",
      isActive
        ? "border-primary/30 bg-primary/10 text-primary placeholder:text-primary/70"
        : "border-slate-300 bg-white text-ink placeholder:text-muted",
      extra,
    ].filter(Boolean).join(" ");

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
          Global workforce
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Crowd</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Candidates who applied to crowd work projects. Use the status dropdown to manage each application.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-muted">
            {viewedCount} viewed
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
            {appliedCount} applied
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
            {approvedCount} approved
          </span>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {filtered.length} shown
          </span>
        </div>
      </section>

      {applications.length === 0 && !isLoading ? (
        <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-14 text-center shadow-panel">
          <p className="text-sm font-semibold text-ink">No applications yet</p>
          <p className="mt-1 text-sm text-muted">Applications will appear here once candidates start applying to crowd projects.</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white shadow-panel">
          {/* Filter bar */}
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <div className="mb-2.5 sm:hidden">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={filterInputClass(Boolean(searchQuery), "w-full")}
                placeholder="Search applicants"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => scrollFilters("left")}
                aria-label="Scroll left"
                className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-ink shadow-sm transition hover:border-primary/30 hover:bg-panelStrong sm:inline-flex"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div
                ref={filtersScrollRef}
                className="overflow-x-auto py-1 sm:px-14 [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none" }}
              >
                <div className="flex min-w-max items-center gap-2.5">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={filterInputClass(Boolean(searchQuery), "hidden w-[220px] sm:block")}
                    placeholder="Search applicants"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={filterInputClass(statusFilter !== "all", "min-w-[140px]")}
                  >
                    <option value="all">Status</option>
                    {crowdWorkApplicationStatusOptions.map((s) => (
                      <option key={s} value={s}>{statusLabels[s]}</option>
                    ))}
                  </select>
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className={filterInputClass(projectFilter !== "all", "min-w-[200px]")}
                  >
                    <option value="all">Project</option>
                    {projectOptions.map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setStatusFilter("all"); setProjectFilter("all"); }}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-panelStrong"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => scrollFilters("right")}
                aria-label="Scroll right"
                className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-ink shadow-sm transition hover:border-primary/30 hover:bg-panelStrong sm:inline-flex"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M7.5 5 12.5 10l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            <span>Name · Email</span>
            <span className="hidden sm:block">Project ID · Status</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <div className="px-4 py-5 text-sm text-muted">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-5 text-sm leading-7 text-muted">
                No applicants match your current filters.
              </div>
            ) : (
              filtered.map((app) => (
                <article
                  key={app.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDrawerApp(app)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDrawerApp(app); }
                  }}
                  className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {app.applicantName || "Applicant"}
                    </p>
                    <p className="truncate text-xs text-muted sm:hidden">{app.applicantEmail}</p>
                  </div>
                  <span className="hidden shrink-0 max-w-[180px] truncate text-xs text-muted sm:block">
                    {app.applicantEmail}
                  </span>
                  <span className="hidden shrink-0 font-mono text-[11px] text-muted sm:block">
                    {app.postId}
                  </span>
                  <StatusBadge status={app.status} />
                  <svg className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {drawerApp ? (
        <CrowdAppDrawer
          application={drawerApp}
          onClose={() => setDrawerApp(null)}
          canManage={canManage}
        />
      ) : null}
    </div>
  );
}
