import { CheckCircle2 } from 'lucide-react';
import Reveal from './Reveal';

const benefits = [
  'One workflow for tests, interviews, proctoring, and reports',
  'Less manual evaluation work for hiring and assessment teams',
  'Cleaner candidate experiences with secure links and guided flow',
  'Decision-ready summaries that help teams act with confidence',
];

export default function WhyMazeAI() {
  return (
    <section className="px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-400">Why MazeAI</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl lg:leading-[1.1]">
            Built for teams that need signal, not more tabs.
          </h2>
          <p className="mt-5 max-w-md text-zinc-400">
            Stop switching between spreadsheets, video calls, and scattered notes. MazeAI brings it all together.
          </p>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2">
          {benefits.map((benefit, index) => (
            <Reveal key={benefit} delay={`${index * 90}ms`}>
              <div className="group flex h-full gap-4 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:shadow-xl hover:shadow-black/20">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-sky-500/20 ring-1 ring-white/[0.08]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-sm leading-relaxed text-zinc-300">{benefit}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
