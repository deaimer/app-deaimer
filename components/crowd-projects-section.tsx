"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  crowdWorkCurrencyOptions,
  crowdWorkStatusOptions,
  crowdWorkTaskTypeOptions,
  deleteCrowdWorkPost,
  emptyCrowdWorkPostDraft,
  saveCrowdWorkPost,
  subscribeToCrowdWorkPosts,
  type CrowdWorkPost,
  type CrowdWorkPostDraft,
} from "@/lib/firebase/crowd-work";
import { subscribeToAdminApprovals, type AdminApprovalRecord } from "@/lib/firebase/admin-access";
import { worldLanguageOptions } from "@/lib/firebase/global-workforce-jobs";
import { countryOptions } from "@/lib/candidates/portal-data";
import { RichTextEditor } from "@/components/rich-text-editor";
import { FormattedJobDescription } from "@/components/formatted-job-description";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LoadingSpinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "Paused"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : status === "Completed"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// ─── CrowdRow — same grid / hover-reveal as JobRow ────────────────────────────

function CrowdRow({
  post,
  onView,
  onEdit,
  onDelete,
  isDeleting,
  canManage,
  approvedAdmins,
  onAssign,
}: {
  post: CrowdWorkPost;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  canManage: boolean;
  approvedAdmins?: AdminApprovalRecord[];
  onAssign?: (postId: string, emails: string[]) => Promise<void>;
}) {
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [localEmails, setLocalEmails] = useState(post.assignedAdminEmails);
  const [isSavingAssign, setIsSavingAssign] = useState(false);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalEmails(post.assignedAdminEmails); }, [post.assignedAdminEmails]);

  useEffect(() => {
    if (!isAssignOpen) return;
    function outside(e: MouseEvent) {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) setIsAssignOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [isAssignOpen]);

  async function handleToggle(email: string) {
    const next = localEmails.includes(email) ? localEmails.filter((e) => e !== email) : [...localEmails, email];
    setLocalEmails(next);
    setIsSavingAssign(true);
    try { await onAssign?.(post.id, next); } finally { setIsSavingAssign(false); }
  }

  const showAssign = canManage && approvedAdmins && approvedAdmins.length > 0;

  return (
    <article className="group relative grid w-full gap-3 rounded-[1.1rem] border border-slate-200 bg-white px-4 py-3.5 transition hover:border-slate-300 hover:bg-panelStrong md:grid-cols-[132px_minmax(0,1fr)_auto] md:items-center">
      <span className="text-sm font-semibold text-ink">{post.postId || "—"}</span>
      <span className="truncate text-sm font-medium text-ink md:text-base">{post.title || "Untitled"}</span>
      <div className={["hidden md:flex items-center gap-2 justify-end transition-opacity duration-150", isAssignOpen ? "opacity-0" : "group-hover:opacity-0"].join(" ")}>
        <StatusBadge status={post.status} />
        {post.payPerSession > 0 ? <span className="text-xs text-muted">{post.payCurrency} {post.payPerSession}/session</span> : null}
      </div>
      <div className={["flex flex-wrap items-center gap-1.5 transition-opacity duration-150 md:absolute md:inset-y-0 md:right-4 md:flex-nowrap", isAssignOpen ? "md:opacity-100" : "md:opacity-0 md:group-hover:opacity-100"].join(" ")}>
        <button type="button" onClick={onView} className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-slate-100">View</button>
        {canManage ? (
          <>
            <button type="button" onClick={onEdit} className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-slate-100">Edit</button>
            <button type="button" onClick={onDelete} disabled={isDeleting} className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60">
              {isDeleting ? "..." : "Delete"}
            </button>
            {showAssign ? (
              <div ref={flyoutRef} className="relative inline-flex items-center">
                <button type="button" onClick={() => setIsAssignOpen((v) => !v)} className={["inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition", localEmails.length > 0 ? "border-primary/40 bg-[#eef4fb] text-primary hover:bg-primary/20" : "border-slate-300 bg-white text-ink hover:bg-slate-100"].join(" ")}>
                  {isSavingAssign ? "..." : localEmails.length > 0 ? `${localEmails.length} admin${localEmails.length > 1 ? "s" : ""}` : "Assign"}
                </button>
                {isAssignOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-[1rem] border border-slate-200 bg-white py-1.5 shadow-[0_12px_36px_rgba(10,22,40,0.12)]">
                    <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Assign to admins</p>
                    {approvedAdmins?.map((admin) => {
                      const assigned = localEmails.includes(admin.email);
                      return (
                        <button key={admin.email} type="button" disabled={isSavingAssign} onClick={() => void handleToggle(admin.email)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:opacity-60">
                          <span className={["inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px] font-bold", assigned ? "border-primary bg-primary text-white" : "border-slate-300"].join(" ")}>{assigned ? "✓" : ""}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{admin.contactName || admin.email}</span>
                            {admin.contactName ? <span className="block truncate text-[11px] text-slate-400">{admin.email}</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function CrowdDetailView({
  post,
  canManage,
  isDeleting,
  onEdit,
  onDelete,
  onBack,
}: {
  post: CrowdWorkPost;
  canManage: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const detailItems = [
    { label: "Task type", value: post.taskType || "—" },
    { label: "Status", value: post.status },
    { label: "Pay / session", value: post.payPerSession > 0 ? `${post.payCurrency} ${post.payPerSession}` : "TBD" },
    { label: "Duration", value: post.estimatedMinutesPerSession > 0 ? `~${post.estimatedMinutesPerSession} min` : "TBD" },
    { label: "Sessions needed", value: post.totalSessionsNeeded > 0 ? post.totalSessionsNeeded.toLocaleString() : "TBD" },
    { label: "Countries", value: post.countries.length === 0 || post.countries.includes("Worldwide") ? "Worldwide" : post.countries.join(", ") },
    { label: "Languages", value: post.languages.length === 0 ? "All languages" : post.languages.join(", ") },
    ...(post.dialects.length > 0 ? [{ label: "Dialects", value: post.dialects.join(", ") }] : []),
    ...(post.ethnicity ? [{ label: "Ethnicity", value: post.ethnicity }] : []),
    ...(canManage && post.assignedAdminEmails.length > 0 ? [{ label: "Assigned admins", value: post.assignedAdminEmails.join(", ") }] : []),
    ...(canManage && post.assignedAdminEmails.length === 0 ? [{ label: "Assigned admins", value: "None assigned" }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-primary"
            >
              <span aria-hidden="true">←</span>
              Crowd projects
            </button>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
              {post.postId || "Crowd project"}
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold text-ink">{post.title || "Untitled"}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-300 bg-panelStrong px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                {post.status}
              </span>
              {post.taskType ? (
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {post.taskType}
                </span>
              ) : null}
            </div>
          </div>
          {canManage ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button type="button" onClick={onEdit} className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong">
                Edit
              </button>
              <button type="button" onClick={onDelete} disabled={isDeleting} className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60">
                {isDeleting ? <LoadingSpinner className="h-4 w-4 border-rose-300 border-t-rose-900" /> : null}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* Detail grid */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {detailItems.map((item) => (
          <article key={item.label} className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{item.label}</p>
            <p className="mt-1.5 text-sm font-semibold leading-6 text-ink">{item.value}</p>
          </article>
        ))}
      </section>

      {/* Description */}
      {post.description ? (
        <section className="rounded-[1.2rem] border border-slate-200 bg-panelStrong p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Description</p>
          <div className="mt-4">
            <FormattedJobDescription content={post.description} />
          </div>
        </section>
      ) : null}

      {/* Instructions */}
      {post.requirements ? (
        <section className="rounded-[1.2rem] border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Instructions</p>
          <div className="mt-4">
            <FormattedJobDescription content={post.requirements} className="job-rich-content space-y-3 text-sm leading-7 text-ink" />
          </div>
        </section>
      ) : null}

      {/* Google Form */}
      {post.googleFormUrl ? (
        <section className="rounded-[1.2rem] border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Google Form</p>
          <a
            href={post.googleFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-2 hover:text-primaryStrong"
          >
            {post.googleFormUrl}
          </a>
        </section>
      ) : null}
    </div>
  );
}

// ─── Form — single container matching job post editor ─────────────────────────

function CrowdProjectForm({
  draft,
  isSaving,
  error,
  isEditing,
  approvedAdmins,
  onDraftChange,
  onMultiChange,
  onDescriptionChange,
  onRequirementsChange,
  onSubmit,
  onCancel,
}: {
  draft: CrowdWorkPostDraft;
  isSaving: boolean;
  error: string | null;
  isEditing: boolean;
  approvedAdmins: AdminApprovalRecord[];
  onDraftChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onMultiChange: (field: keyof CrowdWorkPostDraft, values: string[]) => void;
  onDescriptionChange: (html: string) => void;
  onRequirementsChange: (html: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}) {
  const [langInput, setLangInput] = useState("");
  const [dialectInput, setDialectInput] = useState("");
  const [countryInput, setCountryInput] = useState("");

  const fc = "w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary";

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="space-y-6 rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-panel"
      >
        {/* Row 1: Post ID + Title */}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Project ID</span>
            <input
              value={isEditing ? (draft as CrowdWorkPostDraft & { postId?: string }).postId || "Assigned on save" : "Automatically assigned when saved"}
              disabled
              className="w-full rounded-[1rem] border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-muted outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Title</span>
            <input
              name="title"
              value={draft.title}
              onChange={onDraftChange}
              required
              className={fc}
              placeholder="e.g. English Audio Recording — UK Accents"
            />
          </label>
        </div>

        {/* Row 2: Task type + Status + Currency */}
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Task type</span>
            <select name="taskType" value={draft.taskType} onChange={onDraftChange} className={fc} required>
              <option value="">Select task type</option>
              {crowdWorkTaskTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Status</span>
            <select name="status" value={draft.status} onChange={onDraftChange} className={fc}>
              {crowdWorkStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Currency</span>
            <select name="payCurrency" value={draft.payCurrency} onChange={onDraftChange} className={fc}>
              {crowdWorkCurrencyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        {/* Row 3: Languages + Countries */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Languages */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-ink">
              Languages <span className="font-normal text-muted">(optional — empty = all)</span>
            </span>
            <div className="flex gap-2">
              <select value={langInput} onChange={(e) => setLangInput(e.target.value)} className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary">
                <option value="">Select a language</option>
                {worldLanguageOptions.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button type="button" onClick={() => { if (langInput && !draft.languages.includes(langInput)) { onMultiChange("languages", [...draft.languages, langInput]); } setLangInput(""); }} className="shrink-0 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong">
                Add
              </button>
            </div>
            {draft.languages.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {draft.languages.map((l) => (
                  <button key={l} type="button" onClick={() => onMultiChange("languages", draft.languages.filter((x) => x !== l))} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20">
                    {l} ×
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No languages added — open to all languages.</p>
            )}
          </div>

          {/* Countries */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-ink">
              Countries <span className="font-normal text-muted">(optional — empty = worldwide)</span>
            </span>
            <div className="flex gap-2">
              <select value={countryInput} onChange={(e) => setCountryInput(e.target.value)} className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary">
                <option value="">Select a country</option>
                <option value="Worldwide">Worldwide (all countries)</option>
                {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!countryInput) return;
                  if (countryInput === "Worldwide") { onMultiChange("countries", ["Worldwide"]); }
                  else if (!draft.countries.includes(countryInput) && !draft.countries.includes("Worldwide")) { onMultiChange("countries", [...draft.countries, countryInput]); }
                  setCountryInput("");
                }}
                className="shrink-0 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong"
              >
                Add
              </button>
            </div>
            {draft.countries.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {draft.countries.map((c) => (
                  <button key={c} type="button" onClick={() => onMultiChange("countries", draft.countries.filter((x) => x !== c))} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20">
                    {c} ×
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No countries added — open to worldwide applicants.</p>
            )}
          </div>
        </div>

        {/* Dialects + Ethnicity */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <span className="block text-sm font-medium text-ink">Dialects <span className="font-normal text-muted">(optional)</span></span>
            <div className="flex gap-2">
              <input
                value={dialectInput}
                onChange={(e) => setDialectInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (dialectInput.trim() && !draft.dialects.includes(dialectInput.trim())) { onMultiChange("dialects", [...draft.dialects, dialectInput.trim()]); setDialectInput(""); } } }}
                className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                placeholder="e.g. Scots, Cockney…"
              />
              <button type="button" onClick={() => { const v = dialectInput.trim(); if (v && !draft.dialects.includes(v)) { onMultiChange("dialects", [...draft.dialects, v]); setDialectInput(""); } }} className="shrink-0 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong">
                Add
              </button>
            </div>
            {draft.dialects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {draft.dialects.map((d) => (
                  <button key={d} type="button" onClick={() => onMultiChange("dialects", draft.dialects.filter((x) => x !== d))} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-slate-100">
                    {d} ×
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Ethnicity <span className="font-normal text-muted">(optional)</span></span>
            <input
              name="ethnicity"
              value={draft.ethnicity}
              onChange={onDraftChange}
              className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
              placeholder="e.g. South Asian, African American… (leave blank for any)"
            />
          </label>
        </div>

        {/* Description */}
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Description</span>
          <RichTextEditor
            value={draft.description}
            onChange={onDescriptionChange}
            placeholder="Describe the task, its purpose, and what workers will be doing."
          />
        </label>

        {/* Instructions */}
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Instructions</span>
          <RichTextEditor
            value={draft.requirements}
            onChange={onRequirementsChange}
            placeholder="Step-by-step instructions shown to candidates when they apply."
          />
        </label>

        {/* Google Form URL */}
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">
            Google Form URL <span className="font-normal text-muted">(optional — leave blank for direct apply)</span>
          </span>
          <input
            name="googleFormUrl"
            value={draft.googleFormUrl}
            onChange={onDraftChange}
            className={fc}
            placeholder="https://forms.gle/..."
            type="url"
          />
          <p className="mt-1 text-xs text-muted">
            If provided, candidates will be directed to this form when they apply.
          </p>
        </label>

        {/* Compensation box */}
        <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Pay per session</span>
              <input type="number" name="payPerSession" value={draft.payPerSession || ""} onChange={onDraftChange} className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" placeholder="0" min={0} step={0.01} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Est. minutes / session</span>
              <input type="number" name="estimatedMinutesPerSession" value={draft.estimatedMinutesPerSession || ""} onChange={onDraftChange} className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" placeholder="0" min={0} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Total sessions needed</span>
              <input type="number" name="totalSessionsNeeded" value={draft.totalSessionsNeeded || ""} onChange={onDraftChange} className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" placeholder="0" min={0} />
            </label>
          </div>
          {draft.payPerSession > 0 ? (
            <p className="mt-4 rounded-[0.9rem] border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-muted">
              Preview:{" "}
              <span className="font-semibold text-ink">
                {draft.payCurrency} {draft.payPerSession} / session
                {draft.estimatedMinutesPerSession > 0 ? ` · ~${draft.estimatedMinutesPerSession} min` : ""}
                {draft.totalSessionsNeeded > 0 ? ` · ${draft.totalSessionsNeeded.toLocaleString()} sessions` : ""}
              </span>
            </p>
          ) : null}
        </div>

        {/* Admin assignment */}
        {approvedAdmins.length > 0 ? (
          <div>
            <p className="mb-2 block text-sm font-medium text-ink">Assign to admins</p>
            <div className="flex flex-wrap gap-2">
              {approvedAdmins.map((admin) => {
                const assigned = draft.assignedAdminEmails.includes(admin.email);
                return (
                  <button
                    key={admin.email}
                    type="button"
                    onClick={() =>
                      onMultiChange(
                        "assignedAdminEmails",
                        assigned
                          ? draft.assignedAdminEmails.filter((e) => e !== admin.email)
                          : [...draft.assignedAdminEmails, admin.email],
                      )
                    }
                    className={["inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition", assigned ? "border-primary bg-primary/10 text-primary" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}
                  >
                    <span className={["inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[8px]", assigned ? "border-primary bg-primary text-white" : "border-slate-300"].join(" ")}>
                      {assigned ? "✓" : ""}
                    </span>
                    {admin.contactName || admin.email}
                  </button>
                );
              })}
            </div>
            {draft.assignedAdminEmails.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">No admins assigned — this project will not appear in any admin&apos;s panel.</p>
            ) : null}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? <LoadingSpinner className="h-4 w-4" /> : null}
            {isSaving ? "Saving..." : isEditing ? "Update project" : "Save project"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main exported section ────────────────────────────────────────────────────

export function CrowdProjectsSection({
  activeUser,
  canManage,
}: {
  activeUser: User;
  canManage: boolean;
}) {
  const [posts, setPosts] = useState<CrowdWorkPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approvedAdmins, setApprovedAdmins] = useState<AdminApprovalRecord[]>([]);

  const [viewingPost, setViewingPost] = useState<CrowdWorkPost | null>(null);
  const [editingPost, setEditingPost] = useState<CrowdWorkPost | null | "new">(null);

  const [draft, setDraft] = useState<CrowdWorkPostDraft>(emptyCrowdWorkPostDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    setIsLoading(true);
    return subscribeToCrowdWorkPosts(
      (data) => { setPosts(data); setIsLoading(false); },
      () => setIsLoading(false),
    );
  }, []);

  useEffect(() => {
    if (!canManage) return;
    return subscribeToAdminApprovals((records) => setApprovedAdmins(records));
  }, [canManage]);

  const filtered = posts.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (typeFilter !== "all" && p.taskType !== typeFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !p.title.toLowerCase().includes(q) && !p.postId.toLowerCase().includes(q)) return false;
    return true;
  });

  const activePosts = filtered.filter((p) => p.status === "Active");
  const otherPosts = filtered.filter((p) => p.status !== "Active");
  const activeFilterCount = [statusFilter !== "all", typeFilter !== "all"].filter(Boolean).length;

  function openNewForm() {
    setDraft(emptyCrowdWorkPostDraft());
    setEditingPost("new");
    setFormError(null);
  }

  function openEditForm(post: CrowdWorkPost) {
    setDraft({
      title: post.title,
      taskType: post.taskType,
      description: post.description,
      languages: [...post.languages],
      dialects: [...post.dialects],
      countries: [...post.countries],
      ethnicity: post.ethnicity,
      status: post.status,
      payPerSession: post.payPerSession,
      payCurrency: post.payCurrency,
      estimatedMinutesPerSession: post.estimatedMinutesPerSession,
      totalSessionsNeeded: post.totalSessionsNeeded,
      requirements: post.requirements,
      googleFormUrl: post.googleFormUrl,
      assignedAdminEmails: [...post.assignedAdminEmails],
    });
    setEditingPost(post);
    setViewingPost(null);
    setFormError(null);
  }

  function handleDraftChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setDraft((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? 0 : parseFloat(value)) : value,
    }));
  }

  function handleMultiChange(field: keyof CrowdWorkPostDraft, values: string[]) {
    setDraft((prev) => ({ ...prev, [field]: values }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      const existingId = editingPost !== "new" && editingPost ? editingPost.id : undefined;
      await saveCrowdWorkPost(draft, activeUser.email ?? "", existingId);
      setEditingPost(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(post: CrowdWorkPost) {
    if (!canManage) return;
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeletingId(post.id);
    try {
      await deleteCrowdWorkPost(post.id);
      if (viewingPost?.id === post.id) setViewingPost(null);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAssign(postId: string, emails: string[]) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    await saveCrowdWorkPost({ ...post, assignedAdminEmails: emails }, activeUser.email ?? "", postId);
  }

  // ── View routing ──────────────────────────────────────────────────────────

  if (editingPost !== null) {
    return (
      <CrowdProjectForm
        draft={draft}
        isSaving={isSaving}
        error={formError}
        isEditing={editingPost !== "new"}
        approvedAdmins={approvedAdmins}
        onDraftChange={handleDraftChange}
        onMultiChange={handleMultiChange}
        onDescriptionChange={(html) => setDraft((prev) => ({ ...prev, description: html }))}
        onRequirementsChange={(html) => setDraft((prev) => ({ ...prev, requirements: html }))}
        onSubmit={handleSubmit}
        onCancel={() => setEditingPost(null)}
      />
    );
  }

  if (viewingPost) {
    return (
      <CrowdDetailView
        post={viewingPost}
        canManage={canManage}
        isDeleting={deletingId === viewingPost.id}
        onEdit={() => openEditForm(viewingPost)}
        onDelete={() => void handleDelete(viewingPost)}
        onBack={() => setViewingPost(null)}
      />
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────

  const renderRow = (post: CrowdWorkPost) => (
    <CrowdRow
      key={post.id}
      post={post}
      onView={() => setViewingPost(post)}
      onEdit={() => openEditForm(post)}
      onDelete={() => void handleDelete(post)}
      isDeleting={deletingId === post.id}
      canManage={canManage}
      approvedAdmins={canManage ? approvedAdmins : undefined}
      onAssign={canManage ? handleAssign : undefined}
    />
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
              Global Workforce · Crowd Work
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Crowd projects</h2>
          </div>
          {canManage ? (
            <button type="button" onClick={openNewForm} className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong">
              Add project
            </button>
          ) : null}
        </div>
      </section>

      {/* Filters */}
      {!isLoading && posts.length > 0 ? (
        <section className="rounded-[1.15rem] border border-slate-200 bg-white px-4 py-3 shadow-panel space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or ID…" className="h-9 min-w-[180px] flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-primary" />
            {activeFilterCount > 0 ? (
              <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); }} className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-muted transition hover:bg-slate-100">
                Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["Status", statusFilter, setStatusFilter, [["all", "All statuses"], ...crowdWorkStatusOptions.map((s) => [s, s])]],
              ["Type", typeFilter, setTypeFilter, [["all", "All types"], ...crowdWorkTaskTypeOptions.map((t) => [t, t])]],
            ] as [string, string, (v: string) => void, string[][]][]).map(([label, value, setter, opts]) => (
              <div key={label} className="flex items-center gap-1">
                <select value={value} onChange={(e) => setter(e.target.value)} className={["h-9 rounded-full border px-3 text-xs font-semibold outline-none transition", value !== "all" ? "border-primary/40 bg-primary/5 text-primary" : "border-slate-200 bg-white text-ink hover:border-slate-300"].join(" ")}>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
          <LoadingSpinner className="h-4 w-4" />
          <span>Loading projects…</span>
        </div>
      ) : null}

      {!isLoading && posts.length === 0 ? (
        <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-5 text-sm leading-7 text-muted">
          {canManage ? "No crowd projects yet. Use the button above to add your first project." : "No crowd projects have been created yet."}
        </div>
      ) : null}

      {!isLoading && posts.length > 0 && filtered.length === 0 ? (
        <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-5 text-sm text-muted">
          No projects match your filters.
        </div>
      ) : null}

      {!isLoading && filtered.length > 0 ? (
        <div className="space-y-5">
          {activePosts.length > 0 ? <section className="space-y-3">{activePosts.map(renderRow)}</section> : null}
          {otherPosts.length > 0 ? (
            <section className="space-y-3">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Paused / completed · {otherPosts.length}</p>
              {otherPosts.map(renderRow)}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
