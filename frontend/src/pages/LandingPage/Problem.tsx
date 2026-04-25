import { AlertCircle, Clock3, FileSearch } from 'lucide-react';
import Reveal from './Reveal';

const problems = [
  {
    icon: Clock3,
    title: 'Manual screening takes too long',
    text: 'Teams lose hours creating tests, scheduling interviews, and consolidating feedback.',
    accent: 'from-orange-500/20 to-orange-500/5',
    iconColor: 'text-orange-400',
  },
  {
    icon: FileSearch,
    title: 'Reports are scattered',
    text: 'Scores, transcripts, notes, and integrity signals rarely live in one decision-ready view.',
    accent: 'from-sky-500/20 to-sky-500/5',
    iconColor: 'text-sky-400',
  },
  {
    icon: AlertCircle,
    title: 'Evaluation quality is hard to trust',
    text: 'Without structured workflows, every candidate experience becomes inconsistent.',
    accent: 'from-violet-500/20 to-violet-500/5',
    iconColor: 'text-violet-400',
  },
];

export default function Problem() {
  return (
    <section className="px-5 py-20 sm:px-6 lg:px-8">
      <Reveal className="mx-auto max-w-7xl rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 shadow-2xl shadow-black/30 backdrop-blur-sm sm:p-10">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-400">The problem</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              Hiring workflows should not feel stitched together.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {problems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.title} delay={`${index * 100}ms`}>
                  <div className="group flex h-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:shadow-xl hover:shadow-black/20">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent}`}>
                      <Icon className={`h-5 w-5 ${item.iconColor}`} />
                    </div>
                    <h3 className="mt-5 text-base font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
