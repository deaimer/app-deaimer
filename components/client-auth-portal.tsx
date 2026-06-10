"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  EmailAuthProvider,
  User,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import {
  ensureFirebaseAuthPersistence,
  getFirebaseClientServices,
  getFirebaseConfigError,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import {
  ClientApprovalRecord,
  getClientApproval,
} from "@/lib/firebase/client-access";
import { validatePassword, hashPassword } from "@/lib/utils/password";
import { PlatformAuthPage } from "@/components/platform-auth-page";
import { DeaimerSiteShell, type PlatformSideMenuItem } from "@/components/deaimer-site-shell";
import { ClientVideoProgressPanel } from "@/components/client-video-progress-panel";

type ClientView = "home" | "projects" | "settings";

type ClientPersonInfo = {
  name: string;
  email: string;
  companyEmail: string;
  companyName: string;
  passwordUpdated: boolean;
  active: boolean;
};

const emptyEmailForm = { email: "", password: "" };
const emptyPwForm = { password: "", confirmPassword: "" };

const fieldCls =
  "w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-100";

// ─── Force-password-change gate ───────────────────────────────────────────────

function PasswordResetGate({
  activeUser,
  passwordStep,
  currentPasswordInput,
  passwordChangeForm,
  isVerifyingPassword,
  isChangingPassword,
  passwordChangeError,
  onCurrentPasswordChange,
  onVerify,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmitNewPassword,
  onSignOut,
}: {
  activeUser: User;
  passwordStep: "verify" | "set-new";
  currentPasswordInput: string;
  passwordChangeForm: { password: string; confirmPassword: string };
  isVerifyingPassword: boolean;
  isChangingPassword: boolean;
  passwordChangeError: string | null;
  onCurrentPasswordChange: (v: string) => void;
  onVerify: (e: FormEvent<HTMLFormElement>) => void;
  onNewPasswordChange: (v: string) => void;
  onConfirmPasswordChange: (v: string) => void;
  onSubmitNewPassword: (e: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 shadow-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Client portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Set your password</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Your account was created with a temporary password. Choose a permanent one to continue.
          </p>
          <p className="mt-1 text-xs text-muted">
            Signed in as <span className="font-semibold text-ink">{activeUser.email}</span>
          </p>

          {passwordChangeError ? (
            <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {passwordChangeError}
            </div>
          ) : null}

          {passwordStep === "verify" ? (
            <form onSubmit={onVerify} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Current (temporary) password</span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPasswordInput}
                  onChange={(e) => onCurrentPasswordChange(e.target.value)}
                  placeholder="Enter your temporary password"
                  className={fieldCls}
                />
              </label>
              <button
                type="submit"
                disabled={isVerifyingPassword}
                className="mt-2 w-full rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isVerifyingPassword ? "Verifying..." : "Verify →"}
              </button>
            </form>
          ) : (
            <form onSubmit={onSubmitNewPassword} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">New password</span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={passwordChangeForm.password}
                  onChange={(e) => onNewPasswordChange(e.target.value)}
                  placeholder="8–20 characters with a number or symbol"
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Confirm new password</span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={passwordChangeForm.confirmPassword}
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  placeholder="Repeat new password"
                  className={fieldCls}
                />
              </label>
              <button
                type="submit"
                disabled={isChangingPassword}
                className="mt-2 w-full rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isChangingPassword ? "Setting password..." : "Set password & continue →"}
              </button>
            </form>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onSignOut}
              className="text-sm text-muted hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Main portal ──────────────────────────────────────────────────────────────

export function ClientAuthPortal() {
  const searchParams = useSearchParams();
  const firebaseReady = isFirebaseConfigured();
  const firebaseConfigError = getFirebaseConfigError();
  const [hasMounted, setHasMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isAuthResolving, setIsAuthResolving] = useState(false);
  const [approval, setApproval] = useState<ClientApprovalRecord | null>(null);
  const [isClientApproved, setIsClientApproved] = useState(true);
  const [emailForm, setEmailForm] = useState(emptyEmailForm);
  const [isEmailBusy, setIsEmailBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [personRecord, setPersonRecord] = useState<ClientPersonInfo | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [passwordChangeForm, setPasswordChangeForm] = useState(emptyPwForm);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [passwordStep, setPasswordStep] = useState<"verify" | "set-new">("verify");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [clientTheme, setClientTheme] = useState<"light" | "dark">("light");
  const [activeView, setActiveView] = useState<ClientView>("home");

  useEffect(() => {
    setHasMounted(true);
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("deaimer-client-theme") : null;
    if (saved === "dark" || saved === "light") setClientTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    if (searchParams.get("projects") === "1") { setActiveView("projects"); return; }
    if (searchParams.get("settings") === "1") { setActiveView("settings"); return; }
    setActiveView("home");
  }, [searchParams]);

  useEffect(() => {
    if (!hasMounted) return;
    if (!firebaseReady) {
      setAuthReady(true);
      setIsAuthResolving(false);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function initializeAuth() {
      setAuthReady(false);
      setIsAuthResolving(true);
      try { await ensureFirebaseAuthPersistence(); } catch { /* best-effort */ }
      if (cancelled) return;

      const { auth } = getFirebaseClientServices();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (cancelled) return;

        if (!user) {
          setActiveUser(null);
          setApproval(null);
          setIsClientApproved(true);
          setPersonRecord(null);
          setForcePasswordChange(false);
          setAuthReady(true);
          setIsAuthResolving(false);
          return;
        }

        setIsAuthResolving(true);
        try {
          let nextApproval: ClientApprovalRecord | null = null;
          try { nextApproval = await getClientApproval(user.email); } catch { nextApproval = null; }
          if (cancelled) return;

          if (!nextApproval) {
            const idToken = await user.getIdToken();
            const personRes = await fetch("/api/clients/person", {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            const personData = personRes.ok
              ? (await personRes.json() as { person: ClientPersonInfo | null })
              : { person: null };
            const nextPersonRecord = personData.person;
            if (cancelled) return;

            if (!nextPersonRecord) {
              setActiveUser(user);
              setApproval(null);
              setIsClientApproved(false);
              setAuthReady(true);
              setIsAuthResolving(false);
              setErrorMessage("This email is not approved for the client portal. Ask Deaimer to add it from /super first.");
              return;
            }

            try { nextApproval = await getClientApproval(nextPersonRecord.companyEmail); } catch { nextApproval = null; }
            if (cancelled) return;

            setActiveUser(user);
            setApproval(nextApproval);
            setIsClientApproved(true);
            setPersonRecord(nextPersonRecord);
            if (!nextPersonRecord.passwordUpdated) setForcePasswordChange(true);
            setAuthReady(true);
            setIsAuthResolving(false);
            setErrorMessage(null);
            return;
          }

          setActiveUser(user);
          setApproval(nextApproval);
          setIsClientApproved(true);
          setAuthReady(true);
          setIsAuthResolving(false);
          setErrorMessage(null);
        } catch (error) {
          if (cancelled) return;
          setActiveUser(user);
          setAuthReady(true);
          setIsAuthResolving(false);
          setErrorMessage(error instanceof Error ? error.message : "We could not verify client access.");
        }
      });
    }

    void initializeAuth();
    return () => { cancelled = true; unsubscribe?.(); };
  }, [firebaseReady, hasMounted]);

  async function onEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseReady) return;
    const email = emailForm.email.trim().toLowerCase();
    if (!email || !emailForm.password) { setErrorMessage("Enter your email and password."); return; }
    setIsEmailBusy(true);
    setErrorMessage(null);
    try {
      await ensureFirebaseAuthPersistence();
      const { auth } = getFirebaseClientServices();
      await signInWithEmailAndPassword(auth, email, emailForm.password);
      setEmailForm(emptyEmailForm);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign in failed. Check your email and password.");
    } finally {
      setIsEmailBusy(false);
    }
  }

  async function onSignOut() {
    if (!firebaseReady) return;
    const { auth } = getFirebaseClientServices();
    await signOut(auth);
    setActiveUser(null);
    setApproval(null);
    setIsClientApproved(true);
    setPersonRecord(null);
    setForcePasswordChange(false);
    setPasswordChangeForm(emptyPwForm);
    setCurrentPasswordInput("");
    setPasswordStep("verify");
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);
    setErrorMessage(null);
  }

  async function onVerifyCurrentPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUser || !activeUser.email) return;
    if (!currentPasswordInput) { setPasswordChangeError("Enter your current password."); return; }
    setIsVerifyingPassword(true);
    setPasswordChangeError(null);
    try {
      const credential = EmailAuthProvider.credential(activeUser.email, currentPasswordInput);
      await reauthenticateWithCredential(activeUser, credential);
      setPasswordStep("set-new");
    } catch {
      setPasswordChangeError("Current password is incorrect. Please try again.");
    } finally {
      setIsVerifyingPassword(false);
    }
  }

  async function onPasswordChangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUser) return;
    const { password, confirmPassword } = passwordChangeForm;
    const validationError = validatePassword(password);
    if (validationError) { setPasswordChangeError(validationError); return; }
    if (password !== confirmPassword) { setPasswordChangeError("Passwords do not match."); return; }

    setIsChangingPassword(true);
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);
    try {
      await updatePassword(activeUser, password);
      const hash = await hashPassword(password);
      const idToken = await activeUser.getIdToken();
      const res = await fetch("/api/clients/person", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ newPasswordHash: hash }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(typeof data.error === "string" ? data.error : "Could not save password update.");
      }
      setPersonRecord((prev) => prev ? { ...prev, passwordUpdated: true, active: true } : null);
      setForcePasswordChange(false);
      setPasswordChangeForm(emptyPwForm);
      setCurrentPasswordInput("");
      setPasswordStep("verify");
      setPasswordChangeSuccess("Password updated successfully.");
    } catch (err) {
      setPasswordChangeError(err instanceof Error ? err.message : "Could not update password. Please try again.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  function changeTheme(next: "light" | "dark") {
    setClientTheme(next);
    window.localStorage.setItem("deaimer-client-theme", next);
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (!hasMounted || !authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-panelStrong">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  // ── Not approved ──────────────────────────────────────────────────────────────
  if (activeUser && !isClientApproved) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 shadow-panel">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Client portal</p>
            <h1 className="mt-2 text-2xl font-semibold text-ink">Access not approved</h1>
            <p className="mt-3 text-sm leading-7 text-muted">
              Signed in as <span className="font-semibold text-ink">{activeUser.email}</span>. This email hasn't been approved yet — ask Deaimer to add it from <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/super</code> first.
            </p>
            {errorMessage ? (
              <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {errorMessage}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="mt-5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-panelStrong"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Force password change ─────────────────────────────────────────────────────
  if (activeUser && forcePasswordChange) {
    return (
      <PasswordResetGate
        activeUser={activeUser}
        passwordStep={passwordStep}
        currentPasswordInput={currentPasswordInput}
        passwordChangeForm={passwordChangeForm}
        isVerifyingPassword={isVerifyingPassword}
        isChangingPassword={isChangingPassword}
        passwordChangeError={passwordChangeError}
        onCurrentPasswordChange={(v) => { setCurrentPasswordInput(v); setPasswordChangeError(null); }}
        onVerify={(e) => void onVerifyCurrentPassword(e)}
        onNewPasswordChange={(v) => setPasswordChangeForm((c) => ({ ...c, password: v }))}
        onConfirmPasswordChange={(v) => setPasswordChangeForm((c) => ({ ...c, confirmPassword: v }))}
        onSubmitNewPassword={(e) => void onPasswordChangeSubmit(e)}
        onSignOut={() => void onSignOut()}
      />
    );
  }

  // ── Main portal ───────────────────────────────────────────────────────────────
  if (activeUser && isClientApproved && authReady) {
    const clientEmail = personRecord?.companyEmail || activeUser.email || null;
    const displayName = personRecord?.name || activeUser.displayName || activeUser.email?.split("@")[0] || "Client";
    const companyName = personRecord?.companyName || approval?.company || "";

    const menuItems: PlatformSideMenuItem[] = [
      { label: "Workspace", isSectionHeader: true },
      { label: "Projects", href: "/clients?projects=1", active: activeView === "projects" },
      { label: "Other", isSectionHeader: true },
      { label: "Settings", href: "/clients?settings=1", active: activeView === "settings" },
    ];

    const content = (
      <DeaimerSiteShell
        platformSideMenuItems={menuItems}
        userProfile={{
          name: displayName,
          href: "/clients",
          imageUrl: activeUser.photoURL,
        }}
        onSignOut={() => void onSignOut()}
        themeToggle={{ theme: clientTheme, onToggle: () => changeTheme(clientTheme === "dark" ? "light" : "dark") }}
      >
        <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
          {errorMessage ? (
            <div className="mb-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {errorMessage}
            </div>
          ) : null}

          {/* Home */}
          {activeView === "home" ? (
            <div className="space-y-6">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Client portal</p>
                <h1 className="mt-2 text-3xl font-semibold text-ink">
                  Welcome{displayName ? `, ${displayName}` : ""}
                </h1>
                {companyName ? (
                  <p className="mt-1 text-sm text-muted">{companyName}</p>
                ) : null}
                <p className="mt-4 text-sm leading-7 text-muted">
                  Your company's video collection projects and scheduling progress appear under Projects.
                </p>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-[1.25rem] border border-slate-200 bg-white p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Email</p>
                  <p className="mt-3 text-sm font-semibold text-ink break-all">{activeUser.email}</p>
                </article>
                {companyName ? (
                  <article className="rounded-[1.25rem] border border-slate-200 bg-white p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Company</p>
                    <p className="mt-3 text-sm font-semibold text-ink">{companyName}</p>
                  </article>
                ) : null}
              </section>
            </div>
          ) : null}

          {/* Projects */}
          {activeView === "projects" ? (
            <ClientVideoProgressPanel clientEmail={clientEmail} companyName={companyName} />
          ) : null}

          {/* Settings */}
          {activeView === "settings" ? (
            <div className="space-y-5">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Settings</p>
                <h1 className="mt-2 text-3xl font-semibold text-ink">Account settings</h1>
                <p className="mt-4 text-sm leading-7 text-muted">
                  Manage your password and account preferences.
                </p>
              </section>

              {/* Change password */}
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold text-ink">Change password</p>
                <p className="mt-1 text-xs leading-6 text-muted">
                  Must be 8–20 characters with at least one number or symbol.
                </p>

                {passwordChangeError ? (
                  <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    {passwordChangeError}
                  </div>
                ) : null}

                {passwordChangeSuccess ? (
                  <div className="mt-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    {passwordChangeSuccess}
                  </div>
                ) : null}

                {passwordStep === "verify" ? (
                  <form onSubmit={(e) => void onVerifyCurrentPassword(e)} className="mt-5 space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">Current password</span>
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={currentPasswordInput}
                        onChange={(e) => { setCurrentPasswordInput(e.target.value); setPasswordChangeError(null); }}
                        placeholder="Enter current password"
                        className={fieldCls}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isVerifyingPassword}
                      className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isVerifyingPassword ? "Verifying..." : "Verify →"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={(e) => void onPasswordChangeSubmit(e)} className="mt-5 space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">New password</span>
                      <input
                        type="password"
                        required
                        autoComplete="new-password"
                        value={passwordChangeForm.password}
                        onChange={(e) => setPasswordChangeForm((c) => ({ ...c, password: e.target.value }))}
                        placeholder="New password"
                        className={fieldCls}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">Confirm new password</span>
                      <input
                        type="password"
                        required
                        autoComplete="new-password"
                        value={passwordChangeForm.confirmPassword}
                        onChange={(e) => setPasswordChangeForm((c) => ({ ...c, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                        className={fieldCls}
                      />
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {isChangingPassword ? "Updating..." : "Update password"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordStep("verify");
                          setPasswordChangeForm(emptyPwForm);
                          setPasswordChangeError(null);
                        }}
                        className="text-sm text-muted hover:text-ink"
                      >
                        Back
                      </button>
                    </div>
                  </form>
                )}
              </section>

              {/* Account info */}
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold text-ink">Account</p>
                <dl className="mt-4 space-y-2">
                  {[
                    ["Email", activeUser.email ?? "—"],
                    ...(personRecord?.name ? [["Name", personRecord.name]] : []),
                    ...(companyName ? [["Company", companyName]] : []),
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[120px_1fr] gap-4 rounded-[0.85rem] border border-slate-100 bg-panelStrong px-4 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</dt>
                      <dd className="min-w-0 break-words text-sm font-medium text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* Appearance */}
              <div className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    {clientTheme === "dark" ? "D" : "L"}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Appearance</p>
                    <p className="text-xs text-muted">{clientTheme === "dark" ? "Dark mode" : "Light mode"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => changeTheme(clientTheme === "dark" ? "light" : "dark")}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  {clientTheme === "dark" ? "Switch to Light" : "Switch to Dark"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </DeaimerSiteShell>
    );

    return clientTheme === "dark" ? <div className="cand-dark">{content}</div> : content;
  }

  // ── Login ─────────────────────────────────────────────────────────────────────
  return (
    <PlatformAuthPage
      title="Client portal"
      subtitle="Sign in with the email and password provided by your Deaimer account manager."
      email={emailForm.email}
      password={emailForm.password}
      emailAutocomplete="email"
      passwordAutocomplete="current-password"
      submitLabel="Sign in"
      isSubmitting={isEmailBusy || isAuthResolving}
      notice={
        !hasMounted || isAuthResolving
          ? "Restoring your session..."
          : !firebaseReady
            ? (<><span className="font-semibold">Firebase setup needed</span><span className="mt-1 block">{firebaseConfigError}</span></>)
            : null
      }
      errorMessage={errorMessage}
      hideForm={!hasMounted || isAuthResolving}
      onEmailChange={(value) => setEmailForm((c) => ({ ...c, email: value }))}
      onPasswordChange={(value) => setEmailForm((c) => ({ ...c, password: value }))}
      onSubmit={(e) => void onEmailAuth(e)}
    />
  );
}
