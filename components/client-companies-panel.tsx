"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  VideoCompany,
  createVideoCompany,
  deleteClientCompany,
  subscribeToVideoCompanies,
  updateVideoCompanyPeople,
} from "@/lib/firebase/video-collection";

type View = "list" | "edit";

export function ClientCompaniesPanel({ activeUser }: { activeUser: User }) {
  const [view, setView] = useState<View>("list");
  const [companies, setCompanies] = useState<VideoCompany[]>([]);
  const [newName, setNewName] = useState("");
  const [editingCompany, setEditingCompany] = useState<VideoCompany | null>(null);
  const [editName, setEditName] = useState("");
  const [people, setPeople] = useState<Array<{ name: string; email: string }>>([]);
  const [personDraft, setPersonDraft] = useState({ name: "", email: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToVideoCompanies(setCompanies, (e) => setError(e.message));
  }, []);

  function openEdit(company: VideoCompany) {
    setEditingCompany(company);
    setEditName(company.name);
    setPeople(company.managers.map((m) => ({ name: m.name, email: m.email })));
    setPersonDraft({ name: "", email: "" });
    setError(null);
    setMessage(null);
    setView("edit");
  }

  function closeEdit() {
    setView("list");
    setEditingCompany(null);
    setEditName("");
    setPeople([]);
    setPersonDraft({ name: "", email: "" });
  }

  function addPerson() {
    const email = personDraft.email.trim().toLowerCase();
    if (!email) return;
    if (people.some((p) => p.email === email)) return;
    setPeople((c) => [...c, { name: personDraft.name.trim(), email }]);
    setPersonDraft({ name: "", email: "" });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await createVideoCompany(newName);
      setNewName("");
      setMessage("Company added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add company.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editingCompany) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateVideoCompanyPeople({
        companyId: editingCompany.id,
        name: editName,
        people,
        actor: activeUser,
      });
      setMessage("Company saved.");
      closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save company.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(company: VideoCompany) {
    if (!confirm(`Delete "${company.name}"? This cannot be undone.`)) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteClientCompany(company.id);
      setMessage(`"${company.name}" deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete company.");
    } finally {
      setIsSaving(false);
    }
  }

  const cls = "w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-primary";

  if (view === "edit" && editingCompany) {
    return (
      <section className="space-y-5">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
          <button type="button" onClick={closeEdit} className="text-sm font-semibold text-primary">
            ← Back to companies
          </button>
          <h2 className="mt-4 text-2xl font-semibold text-ink">Edit company</h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            Add people by name and email. People are auto-approved as clients so they can view this company&apos;s projects.
          </p>
        </div>

        {error ? <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}
        {message ? <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div> : null}

        <form onSubmit={handleSave} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 space-y-6">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Company name</span>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} required className={cls} />
          </label>

          <div>
            <p className="text-sm font-semibold text-ink">People</p>
            <div className="mt-3 space-y-2">
              {people.length === 0 ? (
                <p className="text-sm text-muted">No people added yet.</p>
              ) : (
                people.map((person) => (
                  <div key={person.email} className="flex items-center justify-between gap-3 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-ink">{person.name || person.email}</p>
                      {person.name ? <p className="text-xs text-muted">{person.email}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPeople((c) => c.filter((p) => p.email !== person.email))}
                      className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={personDraft.name}
                onChange={(e) => setPersonDraft((c) => ({ ...c, name: e.target.value }))}
                placeholder="Name"
                className="rounded-[1rem] border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              <input
                type="email"
                value={personDraft.email}
                onChange={(e) => setPersonDraft((c) => ({ ...c, email: e.target.value }))}
                placeholder="Email"
                className="rounded-[1rem] border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPerson(); } }}
              />
              <button
                type="button"
                onClick={addPerson}
                disabled={!personDraft.email.trim()}
                className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {isSaving ? "Saving..." : "Save company"}
            </button>
            <button type="button" onClick={closeEdit} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-ink">
              Cancel
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Clients</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Client companies</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Add a company, then edit it to add people (name + email). People are auto-approved as clients for their company&apos;s video projects.
        </p>
      </div>

      {error ? <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}
      {message ? <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div> : null}

      <form onSubmit={handleCreate} className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Company name</span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            placeholder="e.g. Acme AI"
            className={cls}
          />
        </label>
        <button type="submit" disabled={isSaving || !newName.trim()} className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {isSaving ? "Adding..." : "Add company"}
        </button>
      </form>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink">Companies</h2>
          <span className="text-xs text-muted">{companies.length} total</span>
        </div>
        <div className="mt-4 space-y-2">
          {companies.length === 0 ? (
            <p className="text-sm text-muted">No client companies added yet.</p>
          ) : (
            companies.map((company) => (
              <div key={company.id} className="flex items-center justify-between gap-3 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-3">
                <div>
                  <p className="font-semibold text-ink">{company.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{company.managers.length} {company.managers.length === 1 ? "person" : "people"}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(company)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-panelStrong">
                    Edit
                  </button>
                  <button type="button" onClick={() => void handleDelete(company)} disabled={isSaving} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 disabled:opacity-60 hover:bg-rose-100">
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
