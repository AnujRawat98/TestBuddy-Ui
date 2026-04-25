import { Link } from 'react-router-dom';
import Reveal from './Reveal';

export default function CTA() {
  return (
    <section className="px-5 py-24 sm:px-6 lg:px-8">
      <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/[0.08] p-8 text-center shadow-2xl shadow-black/30 sm:p-14">
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900" />
        <div className="pointer-events-none absolute -left-20 -top-20 -z-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 -z-10 h-64 w-64 rounded-full bg-sky-500/10 blur-[80px]" />

        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">Get started</p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Start building smarter evaluation workflows today.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-zinc-400">
          Launch your workspace, create your first assessment, and move candidates from test to decision faster.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="group relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-sky-500 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-emerald-500/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/35"
          >
            <span className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-emerald-400/40 to-sky-400/40 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            Start Free →
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.04] px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08]"
          >
            Sign in
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
