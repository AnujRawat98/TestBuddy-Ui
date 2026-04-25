import { Bot, FileCheck2, Mic2, MonitorCheck, ShieldCheck, UsersRound } from 'lucide-react';
import Reveal from './Reveal';

const features = [
  {
    icon: Bot,
    title: 'AI-generated assessments',
    text: 'Create topic, level, and format-aware tests without starting from a blank page.',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    iconColor: 'text-emerald-400',
  },
  {
    icon: Mic2,
    title: 'Voice AI interviews',
    text: 'Run guided interviews with live assistant playback and transcript capture.',
    gradient: 'from-orange-500/20 to-orange-500/5',
    iconColor: 'text-orange-400',
  },
  {
    icon: FileCheck2,
    title: 'Instant reports',
    text: 'Turn exam results and interview sessions into clear recommendations.',
    gradient: 'from-sky-500/20 to-sky-500/5',
    iconColor: 'text-sky-400',
  },
  {
    icon: ShieldCheck,
    title: 'Proctoring signals',
    text: 'Review snapshots, screen activity, and integrity events in context.',
    gradient: 'from-violet-500/20 to-violet-500/5',
    iconColor: 'text-violet-400',
  },
  {
    icon: UsersRound,
    title: 'Candidate links',
    text: 'Manage secure assessment and interview links from one admin workspace.',
    gradient: 'from-pink-500/20 to-pink-500/5',
    iconColor: 'text-pink-400',
  },
  {
    icon: MonitorCheck,
    title: 'Unified operations',
    text: 'Keep creation, delivery, monitoring, and reporting in a single flow.',
    gradient: 'from-amber-500/20 to-amber-500/5',
    iconColor: 'text-amber-400',
  },
];

export default function Features() {
  return (
    <section id="features" className="px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-400">Features</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Everything your evaluation team needs.
          </h2>
          <p className="mt-5 max-w-xl text-zinc-400">
            A comprehensive toolkit designed to streamline every step of candidate evaluation.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delay={`${(index % 3) * 90}ms`}>
                <article className="group flex h-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-6 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-2 hover:border-white/[0.14] hover:shadow-xl hover:shadow-black/30">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} ring-1 ring-white/[0.06] transition-all group-hover:ring-white/[0.12]`}>
                    <Icon className={`h-5 w-5 ${feature.iconColor}`} />
                  </span>
                  <h3 className="mt-6 text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{feature.text}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
