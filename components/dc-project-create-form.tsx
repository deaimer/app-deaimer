"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { DeaimerSiteShell } from "@/components/deaimer-site-shell";
import { RichTextEditor } from "@/components/rich-text-editor";
import { dcLanguageOptions } from "@/lib/data-collection/project-data";
import { countryOptions } from "@/lib/candidates/portal-data";
import {
  createDCProject,
  subscribeToDCProject,
  updateDCProject,
  type DCLanguageEntry,
  type DCProjectInput,
  type DCTaskTemplate,
  type DCPrompt,
} from "@/lib/firebase/data-collection";
import { getFirebaseClientServices, isFirebaseConfigured } from "@/lib/firebase/client";
import { isSuperAdminEmail } from "@/lib/auth/access-control";

// ─── Draft types ──────────────────────────────────────────────────────────────

interface TaskDraft {
  id: string;
  title: string;
  guidelinesHtml: string;
  policy: string;
  prompts: DCPrompt[];
  scenario: string;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  speakersRequired: number;
}

function emptyPrompt(): DCPrompt {
  return { text: "", maxSeconds: 30 };
}

function emptyTask(mode: "utterance" | "conversational"): TaskDraft {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    title: "",
    guidelinesHtml: "",
    policy: "",
    prompts: mode === "utterance" ? [emptyPrompt()] : [],
    scenario: "",
    minDurationSeconds: 600,
    maxDurationSeconds: 1200,
    speakersRequired: 2,
  };
}

interface FormState {
  recordingMode: "utterance" | "conversational";
  name: string;
  client: string;
  summary: string;
  deadline: string;
  status: "active" | "paused";
  languages: DCLanguageEntry[];
  targetHours: number;
  maxQuotaHours: number;
  maxJobsPerTasker: number;
  participants48k: number;
  participants16k: number;
  participants8k: number;
  maxPromptsPerSpeaker: number;
  tatReworkHours: number;
  transcriptionRequired: boolean;
  qaRequired: boolean;
  descriptionHtml: string;
  guidelinesHtml: string;
  submissionPolicyHtml: string;
  tasks: TaskDraft[];
}

function emptyForm(): FormState {
  return {
    recordingMode: "utterance",
    name: "",
    client: "",
    summary: "",
    deadline: "",
    status: "active",
    languages: [{ languages: [], countries: [] }],
    targetHours: 100,
    maxQuotaHours: 2,
    maxJobsPerTasker: 1,
    participants48k: 0,
    participants16k: 0,
    participants8k: 0,
    maxPromptsPerSpeaker: 0,
    tatReworkHours: 72,
    transcriptionRequired: true,
    qaRequired: true,
    descriptionHtml: "",
    guidelinesHtml: "",
    submissionPolicyHtml: "",
    tasks: [emptyTask("utterance")],
  };
}

// ─── UI primitives ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/40 focus:border-primary focus:ring-1 focus:ring-primary/20";

const selectCls = inputCls + " cursor-pointer";

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
      <div className="mb-1.5">
        <span className="text-[13px] font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-primary">*</span>}
        </span>
        {hint && <p className="mt-0.5 text-[11px] leading-4 text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="h-3.5 w-[3px] shrink-0 rounded-full bg-primary" />
          <div>
            <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
            {description && (
              <p className="mt-0.5 text-[11px] leading-4 text-muted">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-5 p-6">{children}</div>
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
  const [pickKey, setPickKey] = useState(0);
  return (
    <div>
      <select
        key={pickKey}
        className={selectCls}
        defaultValue=""
        onChange={(e) => {
          const val = e.target.value;
          if (val && !selected.includes(val)) {
            onChange([...selected, val]);
            setPickKey((k) => k + 1);
          }
        }}
      >
        <option value="">{placeholder}</option>
        {options
          .filter((o) => !selected.includes(o))
          .map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
      </select>
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1 text-[11px] font-medium text-primary"
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

// ─── Mode selector cards ──────────────────────────────────────────────────────

function ModeCard({
  mode,
  selected,
  disabled,
  onSelect,
}: {
  mode: "utterance" | "conversational";
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const isUtterance = mode === "utterance";
  const tags = isUtterance
    ? ["Solo recording", "Prompt-by-prompt", "Per-prompt time cap"]
    : ["Multi-device", "Like a phone call", "Hour-based progress"];

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      className={[
        "relative flex flex-1 flex-col items-start gap-3 rounded-[1.5rem] border-2 p-5 text-left transition",
        selected
          ? "border-primary bg-primary/[0.04] shadow-[0_0_0_1px_rgba(43,133,240,0.12)]"
          : disabled
            ? "cursor-default border-slate-100 bg-slate-50 opacity-60"
            : "border-slate-200 bg-white hover:border-slate-300 cursor-pointer",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-11 w-11 items-center justify-center rounded-xl text-xl",
          selected ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500",
        ].join(" ")}
      >
        {isUtterance ? "🎙" : "🗣"}
      </div>

      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">
          {isUtterance ? "Utterance" : "Conversational"}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted">
          {isUtterance
            ? "One speaker reads prompts individually. Progress tracked by prompt count."
            : "2+ speakers talk to each other across devices. Progress tracked by hours."}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={[
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              selected ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500",
            ].join(" ")}
          >
            {tag}
          </span>
        ))}
      </div>

      {selected && (
        <div className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
          ✓
        </div>
      )}
    </button>
  );
}

// ─── Utterance task card ──────────────────────────────────────────────────────

function UtteranceTaskCard({
  task,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  task: TaskDraft;
  index: number;
  onChange: (t: TaskDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [open, setOpen] = useState(index === 0);

  function setPrompt(i: number, field: keyof DCPrompt, value: string | number) {
    const next = [...task.prompts];
    next[i] = { ...next[i], [field]: value };
    onChange({ ...task, prompts: next });
  }

  function addPrompt() {
    onChange({ ...task, prompts: [...task.prompts, emptyPrompt()] });
  }

  function removePrompt(i: number) {
    const next = task.prompts.filter((_, idx) => idx !== i);
    onChange({ ...task, prompts: next.length ? next : [emptyPrompt()] });
  }

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-50/40">
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
          <span className="text-xs text-muted">
            {task.prompts.length} prompt{task.prompts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
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
              placeholder="e.g. Read Prompted Sentences"
              value={task.title}
              onChange={(e) => onChange({ ...task, title: e.target.value })}
            />
          </Field>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-ink">Prompts</p>
                <p className="text-[11px] text-muted">
                  Shown one-by-one to the speaker. Set a max duration per prompt.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                {task.prompts.length} total
              </span>
            </div>

            <div className="space-y-2">
              {task.prompts.map((p, pi) => (
                <div key={pi} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-muted">
                    {pi + 1}
                  </span>
                  <input
                    className={inputCls + " flex-1"}
                    placeholder="Prompt text…"
                    value={p.text}
                    onChange={(e) => setPrompt(pi, "text", e.target.value)}
                  />
                  <div className="flex shrink-0 items-center gap-1 rounded-[1rem] border border-slate-200 bg-white px-2.5 py-1">
                    <span className="text-[11px] text-muted">max</span>
                    <input
                      type="number"
                      min={5}
                      max={600}
                      className="w-12 bg-transparent text-center text-sm text-ink outline-none"
                      value={p.maxSeconds}
                      onChange={(e) =>
                        setPrompt(pi, "maxSeconds", Math.max(5, Number(e.target.value)))
                      }
                    />
                    <span className="text-[11px] text-muted">s</span>
                  </div>
                  {task.prompts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePrompt(pi)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-sm text-muted hover:border-rose-200 hover:text-rose-600"
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
              className="mt-3 text-xs font-semibold text-primary hover:underline"
            >
              + Add prompt
            </button>
          </div>

          <details className="group">
            <summary className="cursor-pointer list-none text-[12px] font-medium text-muted transition hover:text-ink">
              ▸ Advanced (guidelines, policy)
            </summary>
            <div className="mt-4 space-y-4">
              <Field label="Task guidelines" hint="Shown to speaker before starting this task.">
                <RichTextEditor
                  value={task.guidelinesHtml}
                  onChange={(v) => onChange({ ...task, guidelinesHtml: v })}
                  placeholder="Describe what the speaker should do…"
                />
              </Field>
              <Field label="Task policy" hint="Speaker must accept before each task.">
                <textarea
                  rows={3}
                  className={inputCls}
                  placeholder="By starting this task, I confirm that…"
                  value={task.policy}
                  onChange={(e) => onChange({ ...task, policy: e.target.value })}
                />
              </Field>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ─── Conversational task card ─────────────────────────────────────────────────

function ConversationalTaskCard({
  task,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  task: TaskDraft;
  index: number;
  onChange: (t: TaskDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [open, setOpen] = useState(index === 0);
  const minMin = Math.round(task.minDurationSeconds / 60);
  const maxMin = Math.round(task.maxDurationSeconds / 60);

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-50/40">
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
          <span className="text-xs text-muted">
            {minMin}–{maxMin} min · {task.speakersRequired} speakers
          </span>
        </div>
        <div className="flex items-center gap-2">
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
              placeholder="e.g. Customer Support Call, Cricket Debate"
              value={task.title}
              onChange={(e) => onChange({ ...task, title: e.target.value })}
            />
          </Field>

          <Field
            label="Scenario / Prompt"
            hint="Shown to all speakers before they start. Describe what they should talk about."
          >
            <textarea
              rows={3}
              className={inputCls}
              placeholder="e.g. You are two cricket fans debating the best player of all time. Speaker A supports Babar Azam, Speaker B supports Virat Kohli…"
              value={task.scenario}
              onChange={(e) => onChange({ ...task, scenario: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Min duration" hint="Minutes">
              <input
                type="number"
                min={1}
                className={inputCls}
                value={Math.round(task.minDurationSeconds / 60)}
                onChange={(e) =>
                  onChange({ ...task, minDurationSeconds: Math.max(60, Number(e.target.value) * 60) })
                }
              />
            </Field>
            <Field label="Max duration" hint="Minutes">
              <input
                type="number"
                min={1}
                className={inputCls}
                value={Math.round(task.maxDurationSeconds / 60)}
                onChange={(e) =>
                  onChange({ ...task, maxDurationSeconds: Math.max(60, Number(e.target.value) * 60) })
                }
              />
            </Field>
            <Field label="Speakers required">
              <input
                type="number"
                min={2}
                max={10}
                className={inputCls}
                value={task.speakersRequired}
                onChange={(e) =>
                  onChange({ ...task, speakersRequired: Math.max(2, Number(e.target.value)) })
                }
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function DCProjectCreateForm({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const isEdit = !!projectId;

  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [projectLoading, setProjectLoading] = useState(isEdit);
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

  useEffect(() => {
    if (!projectId) return;
    return subscribeToDCProject(projectId, (project) => {
      if (!project) { setProjectLoading(false); return; }
      setForm({
        recordingMode: project.recordingMode,
        name: project.name,
        client: project.client,
        summary: project.summary,
        deadline: project.deadline,
        status: project.status === "paused" ? "paused" : "active",
        languages: project.languages.length ? project.languages : [{ languages: [], countries: [] }],
        targetHours: project.targetHours,
        maxQuotaHours: project.maxQuotaHours,
        maxJobsPerTasker: project.maxJobsPerTasker,
        participants48k: project.participants48k,
        participants16k: project.participants16k,
        participants8k: project.participants8k,
        maxPromptsPerSpeaker: project.maxPromptsPerSpeaker,
        tatReworkHours: project.tatReworkHours,
        transcriptionRequired: project.transcriptionRequired,
        qaRequired: project.qaRequired,
        descriptionHtml: project.descriptionHtml,
        guidelinesHtml: project.guidelinesHtml,
        submissionPolicyHtml: project.submissionPolicyHtml,
        tasks: project.tasks.length
          ? project.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              guidelinesHtml: t.guidelinesHtml,
              policy: t.policy,
              prompts: t.prompts,
              scenario: t.scenario,
              minDurationSeconds: t.minDurationSeconds,
              maxDurationSeconds: t.maxDurationSeconds,
              speakersRequired: t.speakersRequired,
            }))
          : [emptyTask(project.recordingMode)],
      });
      setProjectLoading(false);
    });
  }, [projectId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setMode(mode: "utterance" | "conversational") {
    setForm((f) => ({ ...f, recordingMode: mode, tasks: [emptyTask(mode)] }));
  }

  function setLangField(i: number, field: keyof DCLanguageEntry, value: string[]) {
    const next = [...form.languages];
    next[i] = { ...next[i], [field]: value };
    set("languages", next);
  }

  function setTask(i: number, updated: TaskDraft) {
    const next = [...form.tasks];
    next[i] = updated;
    set("tasks", next);
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
        projectType:
          form.recordingMode === "conversational"
            ? "Data Collection: Conversational Audio"
            : "Data Collection: Audio",
        appsSupported: [],
        deadline: form.deadline,
        languages: form.languages.filter((l) => l.languages.length > 0),
        targetHours: form.targetHours,
        estimatedJobs: 0,
        maxQuotaHours: form.maxQuotaHours,
        maxQuotaMinutes: 0,
        maxQuotaSeconds: 0,
        maxJobsPerTasker: form.maxJobsPerTasker,
        participants48k: form.participants48k,
        participants16k: form.participants16k,
        participants8k: form.participants8k,
        maxPromptsPerSpeaker: form.maxPromptsPerSpeaker,
        totalAssetsPerJob: form.tasks.length,
        tatReworkHours: form.tatReworkHours,
        tatReworkMins: 0,
        jobType: form.recordingMode === "conversational" ? "Conversational" : "Utterance",
        isConversational: form.recordingMode === "conversational",
        recordingMode: form.recordingMode,
        descriptionHtml: form.descriptionHtml,
        guidelinesHtml: form.guidelinesHtml,
        submissionPolicyHtml: form.submissionPolicyHtml,
        tasks: form.tasks.map<DCTaskTemplate>((t) => ({
          id: t.id,
          title: t.title.trim(),
          guidelinesHtml: t.guidelinesHtml,
          policy: t.policy.trim(),
          prompts:
            form.recordingMode === "utterance"
              ? t.prompts.filter((p) => p.text.trim())
              : [],
          scenario: form.recordingMode === "conversational" ? t.scenario.trim() : "",
          minDurationSeconds: t.minDurationSeconds,
          maxDurationSeconds: t.maxDurationSeconds,
          speakersRequired: form.recordingMode === "conversational" ? t.speakersRequired : 1,
        })),
        dialect: form.languages[0]?.languages[0] ?? "",
        domainSplit: "",
        minDuration: Math.min(...form.tasks.map((t) => t.minDurationSeconds)),
        maxDuration: Math.max(...form.tasks.map((t) => t.maxDurationSeconds)),
        audioFormat: { format: "WAV", bitDepth: "16-bit PCM", sampleRate: "48kHz" },
        transcriptionRequired: form.transcriptionRequired,
        qaRequired: form.qaRequired,
        status: form.status,
        promptText:
          form.recordingMode === "utterance"
            ? (form.tasks[0]?.prompts[0]?.text ?? "")
            : (form.tasks[0]?.scenario ?? ""),
      };

      if (isEdit && projectId) {
        await updateDCProject(projectId, input);
      } else {
        await createDCProject(input);
      }
      router.push("/super?view=data-collection&section=projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project.");
      setSaving(false);
    }
  }

  if (authLoading || projectLoading) {
    return (
      <DeaimerSiteShell>
        <div className="flex min-h-screen items-center justify-center">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
        </div>
      </DeaimerSiteShell>
    );
  }

  if (!authorized) {
    return (
      <DeaimerSiteShell>
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-sm rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-panel">
            <p className="font-semibold text-ink">Access denied</p>
            <p className="mt-2 text-sm text-muted">Only super admins can manage projects.</p>
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
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">

          {/* Page header */}
          <div className="mb-8">
            <button
              type="button"
              onClick={() => router.push("/super?view=data-collection&section=projects")}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
            >
              ← Back to Projects
            </button>
            <h1 className="text-2xl font-semibold text-ink">
              {isEdit ? `Edit: ${form.name || "Project"}` : "Create Project"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {isEdit
                ? "Changes are saved immediately and visible to assigned speakers."
                : "Configure your speech data collection project before assigning speakers."}
            </p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">

            {error && (
              <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {error}
              </div>
            )}

            {/* ── Recording Mode ── */}
            <Card
              title="Recording Mode"
              description="Determines how speakers record and how progress is tracked. Cannot be changed after creation."
            >
              <div className="flex gap-3">
                <ModeCard
                  mode="utterance"
                  selected={form.recordingMode === "utterance"}
                  disabled={isEdit}
                  onSelect={() => setMode("utterance")}
                />
                <ModeCard
                  mode="conversational"
                  selected={form.recordingMode === "conversational"}
                  disabled={isEdit}
                  onSelect={() => setMode("conversational")}
                />
              </div>
              {isEdit && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                  Recording mode is locked after creation because it affects how sessions are stored and progress is calculated.
                </p>
              )}
            </Card>

            {/* ── Project Info ── */}
            <Card title="Project Info">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project name" required>
                  <input
                    className={inputCls}
                    placeholder="e.g. Urdu Speech Collection 2025"
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
                  rows={2}
                  className={inputCls}
                  placeholder="Describe the goal and scope…"
                  value={form.summary}
                  onChange={(e) => set("summary", e.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Deadline">
                  <input
                    type="date"
                    className={inputCls}
                    value={form.deadline}
                    onChange={(e) => set("deadline", e.target.value)}
                  />
                </Field>
                <Field label="Status">
                  <select
                    className={selectCls}
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as "active" | "paused")}
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </Field>
              </div>
            </Card>

            {/* ── Languages & Countries ── */}
            <Card
              title="Languages & Countries"
              description="One or more language groups required from speakers."
            >
              <div className="space-y-3">
                {form.languages.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-[1.25rem] border border-slate-200 bg-slate-50/40 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Group {i + 1}
                      </span>
                      {form.languages.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            set("languages", form.languages.filter((_, idx) => idx !== i))
                          }
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
                onClick={() =>
                  set("languages", [...form.languages, { languages: [], countries: [] }])
                }
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Add language group
              </button>
            </Card>

            {/* ── Tasks ── */}
            <Card
              title={form.recordingMode === "utterance" ? "Tasks & Prompts" : "Tasks & Scenarios"}
              description={
                form.recordingMode === "utterance"
                  ? "Each task contains prompts shown one-by-one. Speakers must complete all prompts before submitting."
                  : "Each task has one scenario for speakers to act out together. Duration is hour-based."
              }
            >
              <div className="space-y-3">
                {form.tasks.map((task, i) =>
                  form.recordingMode === "utterance" ? (
                    <UtteranceTaskCard
                      key={task.id}
                      task={task}
                      index={i}
                      onChange={(t) => setTask(i, t)}
                      onRemove={() => set("tasks", form.tasks.filter((_, idx) => idx !== i))}
                      canRemove={form.tasks.length > 1}
                    />
                  ) : (
                    <ConversationalTaskCard
                      key={task.id}
                      task={task}
                      index={i}
                      onChange={(t) => setTask(i, t)}
                      onRemove={() => set("tasks", form.tasks.filter((_, idx) => idx !== i))}
                      canRemove={form.tasks.length > 1}
                    />
                  ),
                )}
              </div>
              <button
                type="button"
                onClick={() => set("tasks", [...form.tasks, emptyTask(form.recordingMode)])}
                className="flex w-full items-center justify-center gap-2 rounded-[1.25rem] border-2 border-dashed border-slate-200 py-3.5 text-sm font-semibold text-muted transition hover:border-primary hover:text-primary"
              >
                + Add task
              </button>
            </Card>

            {/* ── Volume & Quota ── */}
            <Card
              title="Volume & Quota"
              description="Set collection targets and per-speaker limits."
            >
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Target volume" hint="Total hours to collect.">
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    value={form.targetHours}
                    onChange={(e) => set("targetHours", Number(e.target.value))}
                  />
                </Field>
                <Field label="Quota per speaker" hint="Max hours one speaker can contribute.">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={form.maxQuotaHours}
                    onChange={(e) => set("maxQuotaHours", Number(e.target.value))}
                  />
                </Field>
                <Field label="Max tasks per speaker">
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    value={form.maxJobsPerTasker}
                    onChange={(e) => set("maxJobsPerTasker", Number(e.target.value))}
                  />
                </Field>
              </div>

              {form.recordingMode === "utterance" && (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Speaker tiers — fill 48kHz first, then 16kHz, then 8kHz</p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Speakers at 48kHz" hint="Filled first.">
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        value={form.participants48k}
                        onChange={(e) => set("participants48k", Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Speakers at 16kHz" hint="Filled after 48kHz.">
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        value={form.participants16k}
                        onChange={(e) => set("participants16k", Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Speakers at 8kHz" hint="Filled last.">
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        value={form.participants8k}
                        onChange={(e) => set("participants8k", Number(e.target.value))}
                      />
                    </Field>
                  </div>
                  <Field label="Max prompts per speaker" hint="0 = unlimited. Speakers cannot exceed this across all tasks.">
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={form.maxPromptsPerSpeaker}
                      onChange={(e) => set("maxPromptsPerSpeaker", Number(e.target.value))}
                    />
                  </Field>
                </>
              )}

              <Field label="TAT rework window (hours)" hint="Time given to fix a rejected session.">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.tatReworkHours}
                  onChange={(e) => set("tatReworkHours", Number(e.target.value))}
                />
              </Field>

              <div className="flex flex-wrap gap-6 pt-1">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={form.transcriptionRequired}
                    onChange={(e) => set("transcriptionRequired", e.target.checked)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span className="text-sm text-ink">Transcription required</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={form.qaRequired}
                    onChange={(e) => set("qaRequired", e.target.checked)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span className="text-sm text-ink">QA review required</span>
                </label>
              </div>
            </Card>

            {/* ── Rich content (optional, collapsible) ── */}
            <Card
              title="Rich Content"
              description="Optional — HTML shown to speakers inside the project."
            >
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-medium text-muted transition hover:text-ink">
                  ▸ Project description
                </summary>
                <div className="mt-3">
                  <RichTextEditor
                    value={form.descriptionHtml}
                    onChange={(v) => set("descriptionHtml", v)}
                    placeholder="Full project description…"
                  />
                </div>
              </details>
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-medium text-muted transition hover:text-ink">
                  ▸ Recording guidelines
                </summary>
                <div className="mt-3">
                  <RichTextEditor
                    value={form.guidelinesHtml}
                    onChange={(v) => set("guidelinesHtml", v)}
                    placeholder="Guidelines for the speaker…"
                  />
                </div>
              </details>
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-medium text-muted transition hover:text-ink">
                  ▸ Submission policy
                </summary>
                <div className="mt-3">
                  <RichTextEditor
                    value={form.submissionPolicyHtml}
                    onChange={(v) => set("submissionPolicyHtml", v)}
                    placeholder="Policy the speaker agrees to on every submission…"
                  />
                </div>
              </details>
            </Card>

            {/* ── Footer actions ── */}
            <div className="flex items-center justify-between gap-4 pb-8 pt-2">
              <button
                type="button"
                onClick={() => router.push("/super?view=data-collection&section=projects")}
                className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-muted hover:bg-slate-50 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-primary px-8 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(43,133,240,0.3)] hover:bg-primaryStrong disabled:opacity-60 active:scale-[0.98]"
              >
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Project →"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </DeaimerSiteShell>
  );
}
