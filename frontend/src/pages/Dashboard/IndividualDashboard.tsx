import { BookOpen, BrainCircuit, CalendarClock, GraduationCap, Sparkles, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { individualApi } from '../../services/api';

const cards = [
  {
    title: 'Practice Hub',
    copy: 'Work from one focused workspace for AI guidance, revision notes, planning, and progress tracking.',
    icon: GraduationCap,
    href: '/practice',
  },
  {
    title: 'AI Teacher',
    copy: 'Start explain, doubt-solving, revision, or deeper guidance sessions in your own tenant.',
    icon: BrainCircuit,
    href: '/practice/buddy',
  },
  {
    title: 'Study Planner',
    copy: 'Break study work into small sessions and mark them complete as you go.',
    icon: CalendarClock,
    href: '/practice/planner',
  },
  {
    title: 'Analytics',
    copy: 'Track XP, streak, badges, and the momentum you are building in this practice space.',
    icon: BookOpen,
    href: '/practice/analytics',
  },
];

export default function IndividualDashboard() {
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    void individualApi.getOverview().then((res) => setOverview(res.data)).catch(() => setOverview(null));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-1 py-1">
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(16,185,129,0.1),rgba(10,10,10,0.95))] p-8 text-white shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-200">
          <Sparkles size={15} />
          Individual learning workspace
        </div>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight">Welcome to your practice hub</h1>
        <p className="mt-3 max-w-3xl text-[1rem] leading-7 text-zinc-200/80">
          Your individual account now lands in a learning-focused workspace. Org-only flows like assessment creation,
          interview setup, and hiring tools stay out of the way here so the product feels built around your own study loop.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold text-zinc-300">Schema type</div>
            <div className="mt-2 text-2xl font-bold text-white">INDIVIDUAL</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold text-zinc-300">Workspace shape</div>
            <div className="mt-2 text-2xl font-bold text-white">Practice + Buddy + Analytics</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold text-zinc-300">Access model</div>
            <div className="mt-2 inline-flex items-center gap-2 text-2xl font-bold text-white">
              <Target size={20} />
              Individual
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500">Buddy Sessions</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{overview?.counts?.buddySessionCount ?? 0}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500">Saved Notes</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{overview?.counts?.noteCount ?? 0}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500">Planner Items</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{overview?.counts?.plannerCount ?? 0}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500">XP</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{overview?.xp?.totalXP ?? 0}</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Recent AI sessions</h2>
              <p className="mt-1 text-sm text-slate-500">Pick up a conversation or start a new one with the AI teacher.</p>
            </div>
            <Link to="/practice/buddy" className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
              Open AI Teacher
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {(overview?.recentSessions ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                No sessions yet. Start with a topic you want explained and build momentum from there.
              </div>
            ) : (
              overview.recentSessions.map((session: any) => (
                <div key={session.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-base font-semibold text-slate-900">{session.mode}</div>
                    <div className="text-xs text-slate-500">
                      {session.startedAt ? new Date(session.startedAt).toLocaleString() : 'Recent'}
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{session.summary || 'Fresh session'}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Today&apos;s next step</h2>
              <p className="mt-1 text-sm text-slate-500">Keep one small action visible so the hub stays practical.</p>
            </div>
            <Link to="/practice/planner" className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
              Open planner
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {(overview?.upcomingPlanner ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                No study plan saved yet. Add your next review block or revision session.
              </div>
            ) : (
              overview.upcomingPlanner.map((item: any) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="text-base font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.scheduledFor ? new Date(item.scheduledFor).toLocaleString() : 'No date yet'}
                  </div>
                  {item.description && (
                    <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
                  )}
                  <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {item.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-3xl border border-white/10 bg-white p-6 shadow-sm">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Icon size={20} />
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-900">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.copy}</p>
              {card.href && (
                <Link to={card.href} className="mt-4 inline-flex text-sm font-semibold text-cyan-700 hover:text-cyan-800">
                  Open
                </Link>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
