import Reveal from './Reveal';

export default function ProductPreview() {
  return (
    <section className="px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-zinc-950 via-zinc-900/80 to-zinc-950 p-6 shadow-2xl shadow-black/50 md:p-10 lg:p-12">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-400">Product preview</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                A calmer workspace for high-stakes decisions.
              </h2>
              <p className="mt-5 text-sm leading-7 text-zinc-400">
                MazeAI keeps candidate progress, reports, and review signals close together so teams can move from data to decision faster.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-5 backdrop-blur-sm">
              <div className="grid gap-4 md:grid-cols-3">
                {/* Sidebar */}
                <div className="rounded-2xl bg-white/[0.04] p-4 md:col-span-1">
                  <div className="h-3 w-24 rounded-full bg-gradient-to-r from-white/20 to-white/10" />
                  <div className="mt-6 space-y-2.5">
                    {['Assessment', 'Interview', 'Report'].map((item, index) => (
                      <div
                        key={item}
                        className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                          index === 1
                            ? 'bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow-md shadow-emerald-500/20'
                            : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-300'
                        }`}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Main content panel */}
                <div className="rounded-2xl bg-white/[0.04] p-5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-3 w-28 rounded-full bg-gradient-to-r from-white/20 to-white/10" />
                      <div className="mt-3 h-2 w-40 rounded-full bg-white/[0.06]" />
                    </div>
                    <div className="rounded-full bg-emerald-400/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-400/20">
                      Ready
                    </div>
                  </div>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {['Transcript captured', 'Score calculated', 'Integrity reviewed', 'Recommendation ready'].map((item, i) => (
                      <div key={item} className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 transition-all duration-200 hover:border-white/[0.12]">
                        <div className="h-2 w-16 rounded-full bg-gradient-to-r from-orange-400/60 to-orange-300/40" />
                        <p className="mt-4 text-sm font-medium text-zinc-300">{item}</p>
                        <div className="mt-3 h-1.5 rounded-full bg-white/[0.06]">
                          <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500/70 to-sky-500/70"
                            style={{ width: `${60 + i * 10}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
