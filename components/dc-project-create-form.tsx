"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { DeaimerSiteShell } from "@/components/deaimer-site-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  dcLanguageOptions,
  dcProjectTypeOptions,
  dcAudioFormatOptions,
  dcBitDepthOptions,
  dcSampleRateOptions,
} from "@/lib/data-collection/project-data";
import { countryOptions } from "@/lib/candidates/portal-data";
import { createDCProject } from "@/lib/firebase/data-collection";
import { getFirebaseClientServices, isFirebaseConfigured } from "@/lib/firebase/client";
import { isSuperAdminEmail } from "@/lib/auth/access-control";
import type { DCProjectInput, DCTaskTemplate, DCLanguageEntry } from "@/lib/firebase/data-collection";

// ─── Local draft types ────────────────────────────────────────────────────────

interface TaskDraft {
  id: string;
  title: string;
  guidelinesHtml: string;
  policy: string;
  prompts: string[];
  minDurationSeconds: number;
  maxDurationSeconds: number;
}

function emptyTask(): TaskDraft {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    title: "",
    guidelinesHtml: "",
    policy: "",
    prompts: [""],
    minDurationSeconds: 30,
    maxDurationSeconds: 300,
  };
}

interface FormState {
  name: string;
  client: string;
  summary: string;
  projectType: string;
  deadline: string;
  languages: DCLanguageEntry[];
  targetHours: number;
  estimatedJobs: number;
  maxQuotaHours: number;
  maxQuotaMinutes: number;
  maxQuotaSeconds: number;
  maxJobsPerTasker: number;
  totalAssetsPerJob: number;
  tatReworkHours: number;
  tatReworkMins: number;
  jobMode: "conversational" | "custom";
  jobTypeName: string;
  descriptionHtml: string;
  guidelinesHtml: string;
  submissionPolicyHtml: string;
  audioFormat: { format: string; bitDepth: string; sampleRate: string };
  transcriptionRequired: boolean;
  qaRequired: boolean;
  tasks: TaskDraft[];
}

const emptyForm = (): FormState => ({
  name: "",
  client: "",
  summary: "",
  projectType: "Data Collection: Audio",
  deadline: "",
  languages: [{ languages: [], countries: [] }],
  targetHours: 100,
  estimatedJobs: 0,
  maxQuotaHours: 2,
  maxQuotaMinutes: 0,
  maxQuotaSeconds: 0,
  maxJobsPerTasker: 1,
  totalAssetsPerJob: 0,
  tatReworkHours: 72,
  tatReworkMins: 0,
  jobMode: "custom",
  jobTypeName: "Prompted Recording",
  descriptionHtml: "",
  guidelinesHtml: "",
  submissionPolicyHtml: "",
  audioFormat: { format: "WAV", bitDepth: "16-bit PCM", sampleRate: "44.1kHz" },
  transcriptionRequired: true,
  qaRequired: true,
  tasks: [emptyTask()],
});

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/40 focus:border-primary focus:ring-1 focus:ring-primary/20";

const selectCls = inputCls + " cursor-pointer";

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="lg:pt-1">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>
        )}
      </div>
      <div className="space-y-5 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  required,
  hint,
}: {
  label: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="mb-1.5">
      <span className="text-[13px] font-medium text-ink">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      {hint && <p className="mt-0.5 text-[11px] leading-4 text-muted">{hint}</p>}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} hint={hint} />
      {children}
    </div>
  );
}

function NumStepper({
  label,
  hint,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <FieldLabel label={label} hint={hint} />
      <div className="grid h-10 grid-cols-[36px_1fr_36px] overflow-hidden rounded-[1rem] border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="border-r border-slate-200 text-base font-medium text-muted transition hover:bg-slate-50 hover:text-ink"
        >
          −
        </button>
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
          className="w-full bg-transparent px-1 text-center text-sm text-ink outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="border-l border-slate-200 text-base font-medium text-muted transition hover:bg-slate-50 hover:text-ink"
        >
          +
        </button>
      </div>
    </div>
  );
}

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const available = options.filter((o) => !selected.includes(o));
  return (
    <div>
      <select
        className={selectCls}
        value=""
        onChange={(e) => {
          if (e.target.value) onChange([...selected, e.target.value]);
        }}
      >
        <option value="">{placeholder}</option>
        {available.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-medium text-primary"
            >
              {s}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== s))}
                className="text-primary/50 transition hover:text-primary"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  task: TaskDraft;
  index: number;
  onChange: (updated: TaskDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [open, setOpen] = useState(index === 0);

  function setField<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    onChange({ ...task, [key]: value });
  }

  function setPrompt(i: number, value: string) {
    const next = [...task.prompts];
    next[i] = value;
    onChange({ ...task, prompts: next });
  }

  function addPrompt() {
    onChange({ ...task, prompts: [...task.prompts, ""] });
  }

  function removePrompt(i: number) {
    const next = task.prompts.filter((_, idx) => idx !== i);
    onChange({ ...task, prompts: next.length ? next : [""] });
  }

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-panelStrong/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-ink">
            {task.title || `Task ${index + 1}`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {canRemove && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onRemove(); } }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
            >
              Remove
            </span>
          )}
          <span className="text-xs text-muted">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-200 bg-white px-5 pb-6 pt-5">
          <Field label="Task title" required>
            <input
              className={inputCls}
              placeholder="e.g. Read Prompted Sentences, Spontaneous Conversation"
              value={task.title}
              onChange={(e) => setField("title", e.target.value)}
            />
          </Field>

          <Field
            label="Task guidelines"
            hint="Shown to the speaker before they start this task."
          >
            <RichTextEditor
              value={task.guidelinesHtml}
              onChange={(v) => setField("guidelinesHtml", v)}
              placeholder="Describe what the speaker should do…"
            />
          </Field>

          <Field
            label="Task policy"
            hint="The speaker must accept this every time they start the task."
          >
            <textarea
              rows={4}
              className={inputCls}
              placeholder="By starting this task, I confirm that…"
              value={task.policy}
              onChange={(e) => setField("policy", e.target.value)}
            />
          </Field>

          <div>
            <FieldLabel
              label="Prompts"
              hint="Shown one-by-one to the speaker during recording."
            />
            <div className="space-y-2">
              {task.prompts.map((prompt, pi) => (
                <div key={pi} className="flex gap-2">
                  <input
                    className={inputCls}
                    placeholder={`Prompt ${pi + 1}…`}
                    value={prompt}
                    onChange={(e) => setPrompt(pi, e.target.value)}
                  />
                  {task.prompts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePrompt(pi)}
                      className="shrink-0 rounded-xl border border-slate-200 px-3 text-sm text-muted hover:border-rose-200 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addPrompt}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              + Add prompt
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Min duration (sec)">
              <input
                type="number"
                min={5}
                className={inputCls}
                value={task.minDurationSeconds}
                onChange={(e) => setField("minDurationSeconds", Number(e.target.value))}
              />
            </Field>
            <Field label="Max duration (sec)">
              <input
                type="number"
                min={10}
                className={inputCls}
                value={task.maxDurationSeconds}
                onChange={(e) => setField("maxDurationSeconds", Number(e.target.value))}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function DCProjectCreateForm() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured()) { setAuthLoading(false); return; }
    const { auth } = getFirebaseClientServices();
    return onAuthStateChanged(auth, (user) => {
      setAuthorized(!!user && isSuperAdminEmail(user.email));
      setAuthLoading(false);
    });
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setLangField(i: number, field: keyof DCLanguageEntry, value: string[]) {
    const next = [...form.languages];
    next[i] = { ...next[i], [field]: value };
    set("languages", next);
  }

  function addLangRow() {
    set("languages", [...form.languages, { languages: [], countries: [] }]);
  }

  function removeLangRow(i: number) {
    set("languages", form.languages.filter((_, idx) => idx !== i));
  }

  function setTask(i: number, updated: TaskDraft) {
    const next = [...form.tasks];
    next[i] = updated;
    set("tasks", next);
  }

  function addTask() {
    set("tasks", [...form.tasks, emptyTask()]);
  }

  function removeTask(i: number) {
    set("tasks", form.tasks.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const input: DCProjectInput = {
        name: form.name.trim(),
        client: form.client.trim(),
        description: form.summary.trim(),
        summary: form.summary.trim(),
        projectType: form.projectType,
        appsSupported: [],
        deadline: form.deadline,
        languages: form.languages.filter((l) => l.languages.length > 0),
        targetHours: form.targetHours,
        estimatedJobs: form.estimatedJobs,
        maxQuotaHours: form.maxQuotaHours,
        maxQuotaMinutes: form.maxQuotaMinutes,
        maxQuotaSeconds: form.maxQuotaSeconds,
        maxJobsPerTasker: form.maxJobsPerTasker,
        totalAssetsPerJob: form.totalAssetsPerJob || form.tasks.length,
        tatReworkHours: form.tatReworkHours,
        tatReworkMins: form.tatReworkMins,
        jobType: form.jobMode === "conversational" ? "Conversational" : form.jobTypeName.trim(),
        isConversational: form.jobMode === "conversational",
        descriptionHtml: form.descriptionHtml,
        guidelinesHtml: form.guidelinesHtml,
        submissionPolicyHtml: form.submissionPolicyHtml,
        tasks: form.tasks.map<DCTaskTemplate>((t) => ({
          id: t.id,
          title: t.title.trim(),
          guidelinesHtml: t.guidelinesHtml,
          policy: t.policy.trim(),
          prompts: t.prompts.filter(Boolean),
          minDurationSeconds: t.minDurationSeconds,
          maxDurationSeconds: t.maxDurationSeconds,
        })),
        dialect: form.languages[0]?.languages[0] ?? "",
        domainSplit: "",
        minDuration: Math.min(...form.tasks.map((t) => t.minDurationSeconds)),
        maxDuration: Math.max(...form.tasks.map((t) => t.maxDurationSeconds)),
        audioFormat: form.audioFormat,
        transcriptionRequired: form.transcriptionRequired,
        qaRequired: form.qaRequired,
        status: "active",
        promptText: form.tasks[0]?.prompts[0] ?? "",
      };
      await createDCProject(input);
      router.push("/super?view=data-collection&section=projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <DeaimerSiteShell>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
        </div>
      </DeaimerSiteShell>
    );
  }

  if (!authorized) {
    return (
      <DeaimerSiteShell>
        <div className="flex min-h-screen items-center justify-center bg-background px-6">
          <div className="max-w-sm rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-panel">
            <p className="font-semibold text-ink">Access denied</p>
            <p className="mt-2 text-sm text-muted">Only super admins can create projects.</p>
            <button
              type="button"
              onClick={() => router.push("/super?view=data-collection&section=projects")}
              className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong"
            >
              Go back
            </button>
          </div>
        </div>
      </DeaimerSiteShell>
    );
  }

  return (
    <DeaimerSiteShell>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-10">

          {/* Page header */}
          <div className="mb-10">
            <button
              type="button"
              onClick={() => router.push("/super?view=data-collection&section=projects")}
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
            >
              ← Back to Projects
            </button>
            <h1 className="text-2xl font-semibold text-ink">Create Project</h1>
            <p className="mt-1 text-sm text-muted">
              Configure all parameters before the project goes live to speakers.
            </p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">

            {error && (
              <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {error}
              </div>
            )}

            {/* ── 1. Project Info ── */}
            <FormSection
              title="Project Info"
              description="Basic identification details for this data collection project."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project name" required>
                  <input
                    className={inputCls}
                    placeholder="e.g. Urdu Conversational Speech 2025"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Client name" required>
                  <input
                    className={inputCls}
                    placeholder="e.g. Acme AI"
                    value={form.client}
                    onChange={(e) => set("client", e.target.value)}
                    required
                  />
                </Field>
              </div>

              <Field label="Project summary" hint="Brief overview shown on the project card.">
                <textarea
                  rows={3}
                  className={inputCls}
                  placeholder="Describe the project goal and scope…"
                  value={form.summary}
                  onChange={(e) => set("summary", e.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project type" required>
                  <select
                    className={selectCls}
                    value={form.projectType}
                    onChange={(e) => set("projectType", e.target.value)}
                    required
                  >
                    {dcProjectTypeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Deadline">
                  <input
                    type="date"
                    className={inputCls}
                    value={form.deadline}
                    onChange={(e) => set("deadline", e.target.value)}
                  />
                </Field>
              </div>
            </FormSection>

            {/* ── 2. Languages & Countries ── */}
            <FormSection
              title="Languages & Countries"
              description="One or more language groups required from speakers. Each group can span multiple languages and countries."
            >
              <div className="space-y-4">
                {form.languages.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-[1.25rem] border border-slate-200 bg-panelStrong/40 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Group {i + 1}
                      </span>
                      {form.languages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLangRow(i)}
                          className="text-xs font-medium text-rose-600 hover:underline"
                        >
                          Remove group
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Languages">
                        <MultiSelect
                          options={dcLanguageOptions}
                          selected={row.languages}
                          onChange={(v) => setLangField(i, "languages", v)}
                          placeholder="Add language…"
                        />
                      </Field>
                      <Field label="Countries / Regions">
                        <MultiSelect
                          options={countryOptions}
                          selected={row.countries}
                          onChange={(v) => setLangField(i, "countries", v)}
                          placeholder="Add country…"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addLangRow}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Add language group
              </button>
            </FormSection>

            {/* ── 3. Volume & Job Config ── */}
            <FormSection
              title="Volume & Job Configuration"
              description="Define collection targets, speaker quotas, and turnaround expectations."
            >
              <div className="grid gap-5 sm:grid-cols-3">
                <NumStepper
                  label="Project volume (hours)"
                  value={form.targetHours}
                  min={1}
                  onChange={(v) => set("targetHours", v)}
                />
                <NumStepper
                  label="Estimated no. of jobs"
                  value={form.estimatedJobs}
                  onChange={(v) => set("estimatedJobs", v)}
                />
                <NumStepper
                  label="Max jobs per tasker"
                  value={form.maxJobsPerTasker}
                  min={1}
                  onChange={(v) => set("maxJobsPerTasker", v)}
                />
              </div>

              <div>
                <FieldLabel label="Max quota per tasker" />
                <div className="flex items-center gap-3">
                  {(
                    [
                      { label: "H", key: "maxQuotaHours" as const, max: undefined },
                      { label: "M", key: "maxQuotaMinutes" as const, max: 59 },
                      { label: "S", key: "maxQuotaSeconds" as const, max: 59 },
                    ] as const
                  ).map(({ label, key, max }) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={max}
                        className="w-16 rounded-[0.9rem] border border-slate-200 bg-white px-2 py-2 text-center text-sm text-ink outline-none focus:border-primary"
                        value={form[key]}
                        onChange={(e) => set(key, Number(e.target.value))}
                      />
                      <span className="text-sm font-medium text-muted">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <NumStepper
                  label="Total assets per job"
                  hint="Defaults to number of tasks if left at 0."
                  value={form.totalAssetsPerJob || form.tasks.length}
                  onChange={(v) => set("totalAssetsPerJob", v)}
                />
                <div>
                  <FieldLabel label="TAT for rework on QA rejection" />
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        className="w-16 rounded-[0.9rem] border border-slate-200 bg-white px-2 py-2 text-center text-sm text-ink outline-none focus:border-primary"
                        value={form.tatReworkHours}
                        onChange={(e) => set("tatReworkHours", Number(e.target.value))}
                      />
                      <span className="text-sm font-medium text-muted">Hrs</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={59}
                        className="w-16 rounded-[0.9rem] border border-slate-200 bg-white px-2 py-2 text-center text-sm text-ink outline-none focus:border-primary"
                        value={form.tatReworkMins}
                        onChange={(e) => set("tatReworkMins", Number(e.target.value))}
                      />
                      <span className="text-sm font-medium text-muted">Mins</span>
                    </div>
                  </div>
                </div>
              </div>
            </FormSection>

            {/* ── 4. Job Type ── */}
            <FormSection
              title="Job Type"
              description="How speakers complete recordings within a single job session."
            >
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-slate-200 p-4 transition has-[:checked]:border-primary/40 has-[:checked]:bg-primary/[0.03]">
                  <input
                    type="radio"
                    name="jobMode"
                    value="conversational"
                    checked={form.jobMode === "conversational"}
                    onChange={() => set("jobMode", "conversational")}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink">Conversational</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted">
                      Two or more speakers record together in a live session.
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-slate-200 p-4 transition has-[:checked]:border-primary/40 has-[:checked]:bg-primary/[0.03]">
                  <input
                    type="radio"
                    name="jobMode"
                    value="custom"
                    checked={form.jobMode === "custom"}
                    onChange={() => set("jobMode", "custom")}
                    className="mt-0.5 accent-primary"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">Single-speaker</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted">
                      One speaker per session, reading or responding to prompts.
                    </p>
                    {form.jobMode === "custom" && (
                      <input
                        className={`${inputCls} mt-3`}
                        placeholder="Job type name (e.g. Prompted Recording, Free Speech)"
                        value={form.jobTypeName}
                        onChange={(e) => set("jobTypeName", e.target.value)}
                      />
                    )}
                  </div>
                </label>
              </div>
            </FormSection>

            {/* ── 5. Job Description ── */}
            <FormSection
              title="Job Description"
              description="Rich-text description shown to speakers on the job detail page."
            >
              <RichTextEditor
                value={form.descriptionHtml}
                onChange={(v) => set("descriptionHtml", v)}
                placeholder="Describe this data collection job in full detail…"
              />
            </FormSection>

            {/* ── 6. Job Guidelines ── */}
            <FormSection
              title="Job Guidelines"
              description="Recording best practices, do's and don'ts, shown before a speaker starts."
            >
              <RichTextEditor
                value={form.guidelinesHtml}
                onChange={(v) => set("guidelinesHtml", v)}
                placeholder="e.g. Use a quiet room, hold the device 15 cm from your mouth…"
              />
            </FormSection>

            {/* ── 7. Submission Policy ── */}
            <FormSection
              title="Submission Policy"
              description="Speakers must read and accept this every time they submit a recording."
            >
              <RichTextEditor
                value={form.submissionPolicyHtml}
                onChange={(v) => set("submissionPolicyHtml", v)}
                placeholder="e.g. By submitting, you confirm this is your original speech and consent to its use for AI training…"
              />
            </FormSection>

            {/* ── 8. Audio Format ── */}
            <FormSection
              title="Audio Format"
              description="Technical specification for all recordings in this project."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Format">
                  <select
                    className={selectCls}
                    value={form.audioFormat.format}
                    onChange={(e) => set("audioFormat", { ...form.audioFormat, format: e.target.value })}
                  >
                    {dcAudioFormatOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Bit depth">
                  <select
                    className={selectCls}
                    value={form.audioFormat.bitDepth}
                    onChange={(e) => set("audioFormat", { ...form.audioFormat, bitDepth: e.target.value })}
                  >
                    {dcBitDepthOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Sample rate">
                  <select
                    className={selectCls}
                    value={form.audioFormat.sampleRate}
                    onChange={(e) => set("audioFormat", { ...form.audioFormat, sampleRate: e.target.value })}
                  >
                    {dcSampleRateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
            </FormSection>

            {/* ── 9. Tasks ── */}
            <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
              <div className="lg:pt-1">
                <h2 className="text-sm font-semibold text-ink">Tasks ({form.tasks.length})</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  Define each task a speaker must complete within a job. Each task has its own guidelines, policy, and prompts.
                </p>
              </div>
              <div className="space-y-3">
                {form.tasks.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    onChange={(updated) => setTask(i, updated)}
                    onRemove={() => removeTask(i)}
                    canRemove={form.tasks.length > 1}
                  />
                ))}
                <button
                  type="button"
                  onClick={addTask}
                  className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/5"
                >
                  + Add task
                </button>
              </div>
            </div>

            {/* ── 10. Processing ── */}
            <FormSection
              title="Processing Settings"
              description="Post-collection processing requirements for this project."
            >
              <div className="flex flex-wrap gap-6">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.transcriptionRequired}
                    onChange={(e) => set("transcriptionRequired", e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Transcription required
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.qaRequired}
                    onChange={(e) => set("qaRequired", e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  QA review required
                </label>
              </div>
            </FormSection>

            {/* ── Actions ── */}
            <div className="flex items-center justify-end gap-4 border-t border-slate-200 pt-6 pb-10">
              <button
                type="button"
                onClick={() => router.push("/super?view=data-collection&section=projects")}
                className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-medium text-muted transition hover:border-slate-300 hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-primary px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create Project"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </DeaimerSiteShell>
  );
}
