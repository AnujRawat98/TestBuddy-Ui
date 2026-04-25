import { ClipboardList, Send, Sparkles } from 'lucide-react';
import Reveal from './Reveal';

const steps = [
  {
    icon: ClipboardList,
    title: 'Create',
    text: 'Build an assessment or AI interview for the role, topic, and difficulty.',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    iconColor: 'text-emerald-400',
    glowColor: 'group-hover:shadow-emerald-500/10',
  },
  {
    icon: Send,
    title: 'Share',
    text: 'Send secure links to candidates with a clean entry experience.',
    gradient: 'from-sky-500/20 to-sky-500/5',
    iconColor: 'text-sky-400',
    glowColor: 'group-hover:shadow-sky-500/10',
  },
  {
    icon: Sparkles,
    title: 'Evaluate',
    text: 'Review scores, transcripts, proctoring signals, and AI summaries.',
    gradient: 'from-violet-500/20 to-violet-500/5',
    iconColor: 'text-violet-400',
    glowColor: 'group-hover:shadow-violet-500/10',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-400">How it works</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Create. Share. Evaluate.
          </h2>
          <p className="mt-5 text-zinc-400">A simple workflow for assessments and AI interviews.</p>
        </Reveal>

        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          {/* Connector line (desktop only) */}
          <div className="pointer-events-none absolute left-0 right-0 top-[3.5rem] z-0 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent md:block" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} delay={`${index * 120}ms`}>
                <article className={`group relative z-10 flex h-full flex-col rounded-2xl border border-white/[0.08] bg-zinc-950/80 p-7 shadow-lg shadow-black/30 transition-all duration-300 hover:-translate-y-2 hover:border-white/[0.14] hover:shadow-xl ${step.glowColor}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold tabular-nums text-zinc-600">0{index + 1}</span>
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${step.gradient} ring-1 ring-white/[0.06] transition-colors group-hover:ring-white/[0.12]`}>
                      <Icon className={`h-5 w-5 ${step.iconColor}`} />
                    </span>
                  </div>
                  <h3 className="mt-8 text-xl font-bold text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{step.text}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
