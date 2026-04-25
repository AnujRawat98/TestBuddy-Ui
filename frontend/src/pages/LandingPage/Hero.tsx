import { Link } from 'react-router-dom';
import Reveal from './Reveal';

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-24 pt-24 sm:px-6 sm:pb-32 sm:pt-32 lg:px-8">
      {/* Ambient glow effects */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[600px] max-w-5xl">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="absolute right-1/4 top-20 h-80 w-80 rounded-full bg-sky-500/15 blur-[100px]" />
        <div className="absolute left-1/2 top-40 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-500/10 blur-[80px]" />
      </div>
      {/* Subtle grid overlay */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_70%,transparent_100%)]" />

      <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal>
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-300 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              AI assessments and interviews for modern hiring teams
            </span>
            <h1 className="mt-8 text-balance text-5xl font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-6xl lg:text-7xl">
              Hire smarter with{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400 bg-clip-text text-transparent">
                AI evaluation.
              </span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-zinc-400">
              Create tests, run voice interviews, and get instant candidate reports —
              all in one focused workspace designed for modern hiring teams.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/signup"
                className="group relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-sky-500 px-7 py-4 text-base font-semibold text-white shadow-xl shadow-emerald-500/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/35"
              >
                <span className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-emerald-400/40 to-sky-400/40 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-0" />
                Start Free →
              </Link>
              <a
                href="#product"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-7 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08]"
              >
                View product
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal delay="120ms">
          <div id="product" className="rounded-3xl border border-white/[0.08] bg-zinc-950/80 p-4 shadow-2xl shadow-black/60 backdrop-blur-sm">
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/80">
              {/* Top bar dots */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-orange-400" />
                  <span className="h-3 w-3 rounded-full bg-sky-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs font-medium tracking-wide text-zinc-500">Evaluation report</span>
              </div>
              {/* Panel content */}
              <div className="grid gap-4 p-5 sm:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-white/[0.06] bg-black/40 p-5">
                  <p className="text-sm font-medium text-zinc-500">Candidate readiness</p>
                  <div className="mt-6 flex h-36 items-end gap-2.5">
                    {[48, 72, 56, 86, 68, 92].map((height, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-t-xl bg-gradient-to-t from-sky-500 to-emerald-400 opacity-80 transition-all duration-500"
                        style={{ height: `${height}%`, animationDelay: `${i * 100}ms` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  {['Assessment score generated', 'Voice interview summarized', 'Strengths and risks highlighted'].map((item, i) => (
                    <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <div className="h-2 w-20 rounded-full bg-gradient-to-r from-emerald-400/60 to-sky-400/60" />
                      <p className="mt-3 text-sm font-medium text-zinc-300">{item}</p>
                      <div className="mt-3.5 h-2 rounded-full bg-white/[0.06]">
                        <div className="h-2 rounded-full bg-gradient-to-r from-white/30 to-white/50" style={{ width: `${65 + i * 12}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
