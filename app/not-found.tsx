import { siteCopy } from "@/lib/site-config";

export default function NotFound() {
  return (
    <main className="grid min-h-screen overflow-hidden bg-white text-[#0a1628] md:grid-cols-2">
      {/* Left decorative panel — same as auth and home */}
      <section className="relative min-h-[220px] overflow-hidden bg-[#eaf3ff] [clip-path:polygon(0_0,100%_0,100%_88%,0_100%)] md:min-h-screen md:[clip-path:polygon(0_0,100%_0,88%_100%,0_100%)]">
        <svg
          viewBox="0 0 800 1000"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="notFoundWave" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2b85f0" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#7eb8ff" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <g stroke="url(#notFoundWave)" strokeWidth="0.7" fill="none" opacity="0.7">
            {Array.from({ length: 25 }).map((_, i) => {
              const y = 600 + i * 15;
              return (
                <path
                  key={`w${i}`}
                  d={`M -100 ${y} Q ${100 + i * 10} ${400 + i * 15}, ${300 + i * 5} ${550 + i * 10} T ${700 + i * 5} ${480 + i * 10} T 1000 ${520 + i * 10}`}
                />
              );
            })}
            {Array.from({ length: 15 }).map((_, i) => {
              const x = 50 + i * 30;
              return (
                <path
                  key={`c${i}`}
                  d={`M ${x} ${300 - Math.min(i, 8) * 10} Q ${x + 200} ${500 + Math.max(0, i - 12) * 10}, ${x + 170} 750 T ${x + 130} 1100`}
                  opacity="0.5"
                />
              );
            })}
          </g>
        </svg>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/reference-site/deaimer-logo.png"
          alt="Deaimer"
          className="absolute left-6 top-6 z-10 h-[26px] w-auto md:left-10 md:top-9"
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center px-10 pb-10 md:pb-0">
          <span
            className="text-[6rem] font-bold leading-none tracking-tight text-[#2b85f0] opacity-20"
            aria-hidden="true"
          >
            404
          </span>
        </div>
      </section>

      {/* Right content */}
      <section className="relative flex items-center justify-center px-8 py-14 md:min-h-screen md:px-14">
        <div className="w-full max-w-[380px]">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2b85f0]">
            Page not found
          </p>

          <h1
            className="mb-6 text-[2.4rem] leading-[1.15] text-[#0a1628]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            This page doesn&apos;t exist.
          </h1>

          <p className="mb-10 text-[0.9rem] leading-[1.7] text-[#5a6b85]">
            The link may be broken, or the page may have been removed. Head back
            to the homepage to find your way.
          </p>

          <a
            href="/"
            className="group inline-flex items-center gap-3 rounded-full bg-[#2b85f0] px-7 py-3.5 text-[0.85rem] font-semibold text-white shadow-[0_4px_20px_rgba(43,133,240,0.35)] transition-all duration-200 hover:bg-[#1a6cd4] hover:shadow-[0_6px_28px_rgba(43,133,240,0.45)] hover:gap-4"
          >
            Back to home
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            >
              <path
                d="M1 7h12M8 2l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>

        <p className="absolute bottom-6 right-8 text-[11px] text-[#b8c8d8] md:right-10">
          &copy; {new Date().getFullYear()} {siteCopy.brand.name}
        </p>
      </section>
    </main>
  );
}
