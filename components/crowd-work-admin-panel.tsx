"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  crowdWorkCurrencyOptions,
  crowdWorkStatusOptions,
  crowdWorkTaskTypeOptions,
  deleteCrowdWorkPost,
  emptyCrowdWorkPostDraft,
  saveCrowdWorkPost,
  subscribeToCrowdWorkPosts,
  subscribeToCrowdWorkPostsByAdmin,
  type CrowdWorkPost,
  type CrowdWorkPostDraft,
} from "@/lib/firebase/crowd-work";
import { worldLanguageOptions } from "@/lib/firebase/global-workforce-jobs";

const fieldClass =
  "w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary";

function LoadingSpinner({ className = "h-5 w-5 border-current border-r-transparent" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-flex animate-spin rounded-full border-2 ${className}`} />;
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

function PostRow({
  post,
  isSelected,
  onSelect,
}: {
  post: CrowdWorkPost;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "block w-full border-b border-slate-100 px-4 py-3.5 text-left transition",
        isSelected ? "bg-[#eaf4ff]" : "bg-white hover:bg-slate-50",
      ].join(" ")}
    >
      <article className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[13px] font-bold text-primary">
          {post.title.slice(0, 1).toUpperCase() || "C"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{post.title || "Untitled"}</p>
            <StatusBadge status={post.status} />
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {post.taskType || "—"} · {post.payPerSession > 0 ? `${post.payCurrency} ${post.payPerSession}/session` : "Pay TBD"}
          </p>
        </div>
      </article>
    </button>
  );
}

function PostForm({
  draft,
  isSaving,
  error,
  isSuperAdmin,
  onDraftChange,
  onMultiChange,
  onSubmit,
  onCancel,
  isEditing,
}: {
  draft: CrowdWorkPostDraft;
  isSaving: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  onDraftChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onMultiChange: (field: keyof CrowdWorkPostDraft, values: string[]) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  const [langInput, setLangInput] = useState("");
  const [dialectInput, setDialectInput] = useState("");
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [hasGoogleForm, setHasGoogleForm] = useState(Boolean(draft.googleFormUrl));

  function handleGoogleFormToggle(e: ChangeEvent<HTMLSelectElement>) {
    const yes = e.target.value === "yes";
    setHasGoogleForm(yes);
    if (!yes) {
      onDraftChange({ target: { name: "googleFormUrl", value: "", type: "text" } } as ChangeEvent<HTMLInputElement>);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">{isEditing ? "Edit post" : "New crowd work post"}</h2>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-muted transition hover:border-slate-300 hover:bg-slate-50 hover:text-ink"
        >
          Cancel
        </button>
      </div>

      {error ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">Title</label>
          <input name="title" value={draft.title} onChange={onDraftChange} className={fieldClass} placeholder="e.g. English Audio Recording — UK Accents" required />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Task type</label>
          <select name="taskType" value={draft.taskType} onChange={onDraftChange} className={fieldClass} required>
            <option value="">Select task type</option>
            {crowdWorkTaskTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Status</label>
          <select name="status" value={draft.status} onChange={onDraftChange} className={fieldClass}>
            {crowdWorkStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Pay per session</label>
          <input
            type="number"
            name="payPerSession"
            value={draft.payPerSession || ""}
            onChange={onDraftChange}
            className={fieldClass}
            min="0"
            step="0.01"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Currency</label>
          <select name="payCurrency" value={draft.payCurrency} onChange={onDraftChange} className={fieldClass}>
            {crowdWorkCurrencyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Est. minutes per session</label>
          <input
            type="number"
            name="estimatedMinutesPerSession"
            value={draft.estimatedMinutesPerSession || ""}
            onChange={onDraftChange}
            className={fieldClass}
            min="0"
            placeholder="15"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Total sessions needed</label>
          <input
            type="number"
            name="totalSessionsNeeded"
            value={draft.totalSessionsNeeded || ""}
            onChange={onDraftChange}
            className={fieldClass}
            min="0"
            placeholder="100"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">Description</label>
          <textarea
            name="description"
            value={draft.description}
            onChange={onDraftChange}
            rows={4}
            className={`${fieldClass} resize-y`}
            placeholder="Describe the task in detail — what participants will do, how long, what's required."
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">Instructions</label>
          <textarea
            name="requirements"
            value={draft.requirements}
            onChange={onDraftChange}
            rows={3}
            className={`${fieldClass} resize-y`}
            placeholder="Instructions shown to the candidate when they apply — steps, environment, device requirements, etc."
          />
        </div>

        {/* Google Form */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Google Form</label>
          <select
            value={hasGoogleForm ? "yes" : "no"}
            onChange={handleGoogleFormToggle}
            className={fieldClass}
          >
            <option value="no">No Google Form</option>
            <option value="yes">Yes — attach a Google Form</option>
          </select>
        </div>

        {hasGoogleForm ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Google Form URL</label>
            <input
              type="url"
              name="googleFormUrl"
              value={draft.googleFormUrl}
              onChange={onDraftChange}
              className={fieldClass}
              placeholder="https://forms.gle/..."
            />
          </div>
        ) : null}

        {/* Languages */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">Languages required</label>
          <div className="flex gap-2">
            <select
              value={langInput}
              onChange={(e) => setLangInput(e.target.value)}
              className={`${fieldClass} flex-1`}
            >
              <option value="">Select language to add</option>
              {worldLanguageOptions.filter((l) => !draft.languages.includes(l)).map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (langInput && !draft.languages.includes(langInput)) {
                  onMultiChange("languages", [...draft.languages, langInput]);
                  setLangInput("");
                }
              }}
              className="inline-flex h-[46px] items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primaryStrong"
            >
              Add
            </button>
          </div>
          {draft.languages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {draft.languages.map((l) => (
                <span key={l} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {l}
                  <button type="button" onClick={() => onMultiChange("languages", draft.languages.filter((x) => x !== l))} className="text-primary/60 hover:text-primary">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Dialects */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">Dialects (optional)</label>
          <div className="flex gap-2">
            <input
              value={dialectInput}
              onChange={(e) => setDialectInput(e.target.value)}
              className={`${fieldClass} flex-1`}
              placeholder="e.g. British English, Punjabi (Lahori), etc."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = dialectInput.trim();
                  if (v && !draft.dialects.includes(v)) {
                    onMultiChange("dialects", [...draft.dialects, v]);
                    setDialectInput("");
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                const v = dialectInput.trim();
                if (v && !draft.dialects.includes(v)) {
                  onMultiChange("dialects", [...draft.dialects, v]);
                  setDialectInput("");
                }
              }}
              className="inline-flex h-[46px] items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primaryStrong"
            >
              Add
            </button>
          </div>
          {draft.dialects.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {draft.dialects.map((d) => (
                <span key={d} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-muted">
                  {d}
                  <button type="button" onClick={() => onMultiChange("dialects", draft.dialects.filter((x) => x !== d))} className="text-muted/60 hover:text-muted">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Assigned admin emails — super admin only */}
        {isSuperAdmin && (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-ink">Assigned admins</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                className={`${fieldClass} flex-1`}
                placeholder="admin@deaimer.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = adminEmailInput.trim().toLowerCase();
                    if (v && !draft.assignedAdminEmails.includes(v)) {
                      onMultiChange("assignedAdminEmails", [...draft.assignedAdminEmails, v]);
                      setAdminEmailInput("");
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const v = adminEmailInput.trim().toLowerCase();
                  if (v && !draft.assignedAdminEmails.includes(v)) {
                    onMultiChange("assignedAdminEmails", [...draft.assignedAdminEmails, v]);
                    setAdminEmailInput("");
                  }
                }}
                className="inline-flex h-[46px] items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primaryStrong"
              >
                Add
              </button>
            </div>
            {draft.assignedAdminEmails.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {draft.assignedAdminEmails.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-muted">
                    {e}
                    <button type="button" onClick={() => onMultiChange("assignedAdminEmails", draft.assignedAdminEmails.filter((x) => x !== e))} className="text-muted/60 hover:text-muted">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <LoadingSpinner className="h-4 w-4 border-white/30 border-t-white" /> : null}
          {isSaving ? "Saving..." : isEditing ? "Save changes" : "Create post"}
        </button>
      </div>
    </form>
  );
}

function PostDetailPanel({
  post,
  isSuperAdmin,
  isDeleting,
  onEdit,
  onDelete,
}: {
  post: CrowdWorkPost;
  isSuperAdmin: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {post.taskType && (
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                {post.taskType}
              </span>
            )}
            <StatusBadge status={post.status} />
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{post.title || "Untitled"}</h2>
          {post.postId && (
            <p className="mt-1 text-xs text-muted">{post.postId}</p>
          )}
        </div>
        {isSuperAdmin && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-muted transition hover:border-slate-300 hover:bg-slate-50 hover:text-ink"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              {isDeleting ? <LoadingSpinner className="h-3.5 w-3.5 border-rose-300 border-t-rose-600" /> : null}
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-[10px] uppercase tracking-widest text-muted">Pay / session</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {post.payPerSession > 0 ? `${post.payCurrency} ${post.payPerSession}` : "TBD"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-[10px] uppercase tracking-widest text-muted">Duration</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {post.estimatedMinutesPerSession > 0 ? `~${post.estimatedMinutesPerSession} min` : "TBD"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-[10px] uppercase tracking-widest text-muted">Sessions needed</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {post.totalSessionsNeeded > 0 ? post.totalSessionsNeeded.toLocaleString() : "TBD"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-[10px] uppercase tracking-widest text-muted">Languages</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {post.languages.length > 0 ? post.languages.length : "Any"}
          </p>
        </div>
      </div>

      {post.description && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Description</p>
          <p className="mt-2 text-sm leading-7 text-ink whitespace-pre-wrap">{post.description}</p>
        </div>
      )}

      {post.requirements && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Instructions</p>
          <p className="mt-2 text-sm leading-7 text-ink whitespace-pre-wrap">{post.requirements}</p>
        </div>
      )}

      {post.googleFormUrl && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Google Form</p>
          <a
            href={post.googleFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2 transition hover:text-primaryStrong"
          >
            {post.googleFormUrl}
          </a>
        </div>
      )}

      {post.languages.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Languages required</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {post.languages.map((l) => (
              <span key={l} className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {post.dialects.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Dialects</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {post.dialects.map((d) => (
              <span key={d} className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-muted">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {isSuperAdmin && post.assignedAdminEmails.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Assigned admins</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {post.assignedAdminEmails.map((e) => (
              <span key={e} className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-muted">
                {e}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function CrowdWorkAdminPanel({
  activeUser,
  isSuperAdmin,
}: {
  activeUser: User;
  isSuperAdmin: boolean;
}) {
  const [posts, setPosts] = useState<CrowdWorkPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CrowdWorkPostDraft>(emptyCrowdWorkPostDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setIsLoading(true);
    const sub = isSuperAdmin
      ? subscribeToCrowdWorkPosts(
          (data) => { setPosts(data); setIsLoading(false); },
          () => setIsLoading(false),
        )
      : subscribeToCrowdWorkPostsByAdmin(
          activeUser.email ?? "",
          (data) => { setPosts(data); setIsLoading(false); },
          () => setIsLoading(false),
        );
    return sub;
  }, [activeUser.email, isSuperAdmin]);

  const filteredPosts = posts.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    return !q || [p.title, p.taskType, p.postId].some((f) => f.toLowerCase().includes(q));
  });

  const selectedPost = filteredPosts.find((p) => p.id === selectedId) ?? filteredPosts[0] ?? null;

  function openNewForm() {
    setDraft(emptyCrowdWorkPostDraft());
    setEditingId(null);
    setIsFormOpen(true);
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
    setEditingId(post.id);
    setIsFormOpen(true);
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
    if (!draft.title.trim()) { setFormError("Title is required."); return; }
    if (!draft.taskType) { setFormError("Select a task type."); return; }
    setIsSaving(true);
    setFormError(null);
    try {
      const id = await saveCrowdWorkPost(draft, activeUser.email ?? "", editingId ?? undefined);
      setIsFormOpen(false);
      setSelectedId(id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(post: CrowdWorkPost) {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeletingId(post.id);
    try {
      await deleteCrowdWorkPost(post.id);
      if (selectedId === post.id) setSelectedId(null);
    } catch {
      // silently ignore
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
            {isSuperAdmin ? "All crowd work posts" : "Your crowd work posts"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Crowd Work</h1>
        </div>
        {isSuperAdmin && !isFormOpen && (
          <button
            type="button"
            onClick={openNewForm}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong"
          >
            + New post
          </button>
        )}
      </div>

      {/* Form panel */}
      {isFormOpen && isSuperAdmin && (
        <PostForm
          draft={draft}
          isSaving={isSaving}
          error={formError}
          isSuperAdmin={isSuperAdmin}
          onDraftChange={handleDraftChange}
          onMultiChange={handleMultiChange}
          onSubmit={handleSubmit}
          onCancel={() => setIsFormOpen(false)}
          isEditing={editingId !== null}
        />
      )}

      {/* Board */}
      {!isFormOpen && (
        <div className="overflow-hidden rounded-[1.85rem] border border-slate-200 bg-white">
          {/* Search */}
          <div className="border-b border-slate-100 bg-white px-4 py-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={[
                "h-11 w-full rounded-full border px-4 text-sm font-medium outline-none transition",
                searchQuery
                  ? "border-primary/30 bg-primary/10 text-primary placeholder:text-primary/70"
                  : "border-slate-300 bg-white text-ink placeholder:text-muted",
              ].join(" ")}
              placeholder="Search posts…"
            />
          </div>

          <div className="grid lg:grid-cols-[minmax(260px,0.42fr)_minmax(0,1fr)]">
            {/* List */}
            <aside className="flex flex-col border-slate-100 lg:max-h-[calc(100vh-18rem)] lg:border-r">
              <div className="shrink-0 border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-muted/70 lg:px-5">
                {isLoading ? "Loading…" : `${filteredPosts.length} post${filteredPosts.length !== 1 ? "s" : ""}`}
              </div>
              <div className="flex-1 lg:overflow-y-auto">
                {isLoading && (
                  <div className="px-5 py-8 text-sm text-muted flex items-center gap-3">
                    <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
                    Loading posts…
                  </div>
                )}
                {!isLoading && filteredPosts.length === 0 && (
                  <div className="px-5 py-8 text-sm leading-7 text-muted">
                    {isSuperAdmin
                      ? "No crowd work posts yet. Create the first one above."
                      : "No crowd work posts have been assigned to you yet."}
                  </div>
                )}
                {filteredPosts.map((p) => (
                  <PostRow
                    key={p.id}
                    post={p}
                    isSelected={selectedPost?.id === p.id}
                    onSelect={() => setSelectedId(p.id)}
                  />
                ))}
              </div>
            </aside>

            {/* Detail */}
            <section className="hidden bg-white lg:block lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto">
              <div className="p-5 sm:p-6">
                {isLoading && !selectedPost && (
                  <div className="flex min-h-[280px] items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5 text-sm text-muted shadow-panel">
                    <div className="flex items-center gap-3">
                      <LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" />
                      Loading…
                    </div>
                  </div>
                )}
                {!isLoading && !selectedPost && (
                  <div className="flex min-h-[280px] items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5 text-sm leading-7 text-muted shadow-panel">
                    Select a post from the list to see its details.
                  </div>
                )}
                {selectedPost && (
                  <PostDetailPanel
                    post={selectedPost}
                    isSuperAdmin={isSuperAdmin}
                    isDeleting={deletingId === selectedPost.id}
                    onEdit={() => openEditForm(selectedPost)}
                    onDelete={() => handleDelete(selectedPost)}
                  />
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
