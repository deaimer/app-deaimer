"use client";

import { FormEvent, ReactNode } from "react";

type PlatformAuthPageProps = {
  title: string;
  subtitle?: string;
  email: string;
  password: string;
  confirmPassword?: string;
  emailAutocomplete?: string;
  passwordAutocomplete?: string;
  submitLabel: string;
  isSubmitting?: boolean;
  errorMessage?: ReactNode;
  successMessage?: ReactNode;
  notice?: ReactNode;
  oauthAction?: ReactNode;
  secondaryAction?: ReactNode;
  hideForm?: boolean;
  hideEmailField?: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange?: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function PlatformAuthPage({
  title,
  subtitle,
  email,
  password,
  confirmPassword,
  emailAutocomplete = "email",
  passwordAutocomplete = "current-password",
  submitLabel,
  isSubmitting = false,
  errorMessage,
  successMessage,
  notice,
  oauthAction,
  secondaryAction,
  hideForm = false,
  hideEmailField = false,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: PlatformAuthPageProps) {
  return (
    <main className="grid min-h-screen overflow-hidden bg-white text-[#0a1628] md:grid-cols-2">
      <section
        className="relative min-h-[200px] overflow-hidden bg-[#eaf3ff] [clip-path:polygon(0_0,100%_0,100%_88%,0_100%)] md:min-h-screen md:[clip-path:polygon(0_0,100%_0,88%_100%,0_100%)]"
      >
        <svg
          viewBox="0 0 800 1000"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="authWaveStroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2b85f0" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#7eb8ff" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <g stroke="url(#authWaveStroke)" strokeWidth="0.7" fill="none" opacity="0.7">
            {Array.from({ length: 25 }).map((_, index) => {
              const y = 600 + index * 15;
              return (
                <path
                  key={`wave-${index}`}
                  d={`M -100 ${y} Q ${100 + index * 10} ${400 + index * 15}, ${300 + index * 5} ${550 + index * 10} T ${700 + index * 5} ${480 + index * 10} T 1000 ${520 + index * 10}`}
                />
              );
            })}
            {Array.from({ length: 15 }).map((_, index) => {
              const x = 50 + index * 30;
              return (
                <path
                  key={`cross-${index}`}
                  d={`M ${x} ${300 - Math.min(index, 8) * 10} Q ${x + 200} ${500 + Math.max(0, index - 12) * 10}, ${x + 170} 750 T ${x + 130} 1100`}
                  opacity="0.5"
                />
              );
            })}
          </g>
        </svg>
        <a href="/" className="absolute left-6 top-6 z-10 md:left-10 md:top-9">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reference-site/deaimer-logo.png"
            alt="Deaimer"
            className="h-[26px] w-auto"
          />
        </a>
      </section>

      <section className="flex items-center justify-center px-6 py-10 md:min-h-screen md:px-10">
        <div className="w-full max-w-[380px]">
          <h1 className="mb-2 text-center font-[var(--font-display)] text-[30px] font-normal leading-[1.1] text-[#0a1628]">
            {title}
          </h1>

          {subtitle ? (
            <p className="mb-8 text-center text-sm leading-6 text-[#6b7c93]">{subtitle}</p>
          ) : (
            <div className="mb-8" />
          )}

          {notice ? (
            <div className="mb-5 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {notice}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mb-5 rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
              {successMessage}
            </div>
          ) : null}

          {oauthAction ? (
            <>
              <div className="mb-5">{oauthAction}</div>
              {!hideForm && (
                <div className="mb-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-[#e5ecf3]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a9bb0]">
                    or
                  </span>
                  <span className="h-px flex-1 bg-[#e5ecf3]" />
                </div>
              )}
            </>
          ) : null}

          {!hideForm && <form onSubmit={onSubmit}>
            {!hideEmailField && (
              <label className="mb-[18px] block">
                <span className="mb-[7px] block text-[13px] font-medium text-[#1f3045]">
                  Email <span className="text-[#2b85f0]">*</span>
                </span>
                <input
                  type="email"
                  required
                  autoComplete={emailAutocomplete}
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  className="w-full rounded-[10px] border border-[#e5ecf3] bg-white px-[14px] py-3 text-sm text-[#0a1628] outline-none transition placeholder:text-[#c4cfdb] focus:border-[#4ea3ff] focus:shadow-[0_0_0_3px_rgba(43,133,240,0.12)]"
                />
              </label>
            )}

            <label className="mb-[18px] block">
              <span className="mb-[7px] block text-[13px] font-medium text-[#1f3045]">
                Password <span className="text-[#2b85f0]">*</span>
              </span>
              <input
                type="password"
                required
                autoComplete={passwordAutocomplete}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                className="w-full rounded-[10px] border border-[#e5ecf3] bg-white px-[14px] py-3 text-sm text-[#0a1628] outline-none transition placeholder:text-[#c4cfdb] focus:border-[#4ea3ff] focus:shadow-[0_0_0_3px_rgba(43,133,240,0.12)]"
              />
            </label>

            {typeof confirmPassword === "string" && onConfirmPasswordChange ? (
              <label className="mb-[18px] block">
                <span className="mb-[7px] block text-[13px] font-medium text-[#1f3045]">
                  Confirm password <span className="text-[#2b85f0]">*</span>
                </span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => onConfirmPasswordChange(event.target.value)}
                  className="w-full rounded-[10px] border border-[#e5ecf3] bg-white px-[14px] py-3 text-sm text-[#0a1628] outline-none transition placeholder:text-[#c4cfdb] focus:border-[#4ea3ff] focus:shadow-[0_0_0_3px_rgba(43,133,240,0.12)]"
                />
              </label>
            ) : null}

            <div className="mb-[22px] flex justify-end">
              {secondaryAction}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-[10px] bg-[#2b85f0] px-4 py-[13px] text-sm font-semibold text-white transition hover:bg-[#1f6dd1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Working..." : submitLabel}
            </button>
          </form>}
        </div>
      </section>
    </main>
  );
}
