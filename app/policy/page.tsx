import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy & Data Policy — Deaimer",
  description: "Privacy and data policy for Deaimer (SMC-Private) Limited.",
};

const EFFECTIVE_DATE = "4 June 2025";
const COMPANY_FULL = "Deaimer (SMC-Private) Limited";
const COMPANY_SHORT = "Deaimer";
const CONTACT_EMAIL = "privacy@deaimer.com";

export default function PolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-sm font-semibold text-ink hover:text-primary transition">
            ← Back to Deaimer
          </Link>
          <span className="text-xs text-muted">Effective {EFFECTIVE_DATE}</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10">
          <p className="section-kicker mb-3">Legal</p>
          <h1 className="text-4xl font-semibold text-ink">Privacy &amp; Data Policy</h1>
          <p className="mt-4 text-lg leading-8 text-muted">
            This policy explains what personal data {COMPANY_FULL} collects, how we use it, and your rights as a user of our platform.
          </p>
        </div>

        <div className="space-y-10 text-sm leading-8 text-muted">

          <Section title="1. Who We Are">
            <p>
              {COMPANY_FULL} (&ldquo;{COMPANY_SHORT}&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) operates the Deaimer platform, which connects candidates with employment opportunities and crowd work tasks including data annotation, transcription, audio recording, and related services.
            </p>
            <p className="mt-3">
              For questions about this policy or your data, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          <Section title="2. Data We Collect">
            <p>When you create a profile or use our platform, we may collect:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li><strong className="text-ink">Identity data</strong> — full name, email address, date of birth, profile photo, country, city</li>
              <li><strong className="text-ink">Contact data</strong> — phone number (including WhatsApp), email</li>
              <li><strong className="text-ink">Professional data</strong> — headline, bio, years of experience, employment status, skills, languages, availability</li>
              <li><strong className="text-ink">Preference data</strong> — work type, job type, relocation preferences, crowd work opt-in status</li>
              <li><strong className="text-ink">Document data</strong> — resume or CV files you upload</li>
              <li><strong className="text-ink">Demographic data</strong> — gender, age, dialect, region (when relevant to crowd work task matching)</li>
              <li><strong className="text-ink">Usage data</strong> — how you interact with the platform, task completions, session recordings submitted as part of crowd work projects</li>
              <li><strong className="text-ink">Authentication data</strong> — login credentials managed securely via Firebase Authentication</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Data">
            <p>We use your data to:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Create and maintain your candidate profile on the Deaimer platform</li>
              <li>Match you with relevant full-time job opportunities and crowd work tasks</li>
              <li>Contact you via email or WhatsApp about roles, task assignments, application updates, and platform announcements</li>
              <li>Process your job applications and communicate them to relevant employers or clients</li>
              <li>Assign and manage crowd work tasks (audio recording, annotation, transcription, labelling) based on your profile attributes</li>
              <li>Compile anonymised or attributed datasets as part of contracted data collection projects for clients (only if you have explicitly opted in and participated)</li>
              <li>Improve our platform, services, and matching algorithms</li>
              <li>Comply with applicable legal obligations</li>
            </ul>
          </Section>

          <Section title="4. Crowd Work & Data Collection Projects">
            <p>
              If you opt in to Crowd Work, your profile information — including language, dialect, age group, gender, and region — may be used to match you to specific data collection projects on behalf of {COMPANY_SHORT}&apos;s clients. Any audio, text, or media you submit as part of a crowd work task becomes part of a licensed dataset delivered to the relevant client under a separate data supply agreement.
            </p>
            <p className="mt-3">
              You may opt out of Crowd Work at any time by editing your profile preferences. Opting out will not affect your access to full-time job listings or any previously submitted work.
            </p>
          </Section>

          <Section title="5. Data Sharing">
            <p>We do not sell your personal data. We may share it with:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li><strong className="text-ink">Employers and clients</strong> — when you apply for a role or are matched to a crowd work project, relevant profile information is shared with the hiring party</li>
              <li><strong className="text-ink">Service providers</strong> — third-party infrastructure providers (including Google Firebase and Cloudflare) used to operate the platform, bound by data processing agreements</li>
              <li><strong className="text-ink">Legal authorities</strong> — where required by applicable law or valid legal process</li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your profile data for as long as your account is active or as needed to provide services. If you request account deletion, we will remove your personally identifiable data within 30 days, subject to any legal retention obligations. Anonymised aggregate data from completed crowd work projects may be retained indefinitely as part of delivered datasets.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data (&ldquo;right to be forgotten&rdquo;)</li>
              <li>Withdraw consent for data processing at any time</li>
              <li>Object to or restrict certain types of processing</li>
              <li>Data portability — receive your data in a machine-readable format</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, alteration, disclosure, or destruction. All data is stored on Google Firebase infrastructure with access controls and encryption in transit.
            </p>
          </Section>

          <Section title="9. Cookies & Tracking">
            <p>
              The Deaimer platform uses Firebase Authentication session cookies to maintain your login state. We do not use third-party advertising trackers or sell behavioural data to any ad networks.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this policy from time to time. If we make material changes, we will notify you via email or a notice on the platform. Continued use of the platform after changes are posted constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              If you have any questions, concerns, or requests relating to this policy, please contact {COMPANY_FULL} at:
            </p>
            <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white px-5 py-4 text-ink">
              <p className="font-semibold">{COMPANY_FULL}</p>
              <p className="mt-1">
                Email:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>
              </p>
              <p className="mt-0.5 text-xs text-muted">Effective date: {EFFECTIVE_DATE}</p>
            </div>
          </Section>

        </div>
      </main>

      <footer className="mt-16 border-t border-slate-200 bg-white py-8 text-center text-xs text-muted">
        &copy; {new Date().getFullYear()} {COMPANY_FULL}. All rights reserved.
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
