import { BookOpen, BrainCircuit, CalendarClock, ClipboardCheck, Dumbbell, ExternalLink, Sparkles, Target, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { individualApi } from '../../services/api';

const cards = [
  {
    title: 'Practice Questions',
    copy: 'Browse your topics, pick a mode, and start a focused practice session with instant feedback.',
    icon: Dumbbell,
    href: '/practice/start',
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

type CandidateSchedule = {
  id: string;
  type: 'Assessment' | 'Interview' | string;
  company: string;
  title: string;
  scheduleName?: string | null;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  mode: string;
  status: string;
  connectUrl: string;
  organisationSchema: string;
  attemptCount?: number | null;
};

export default function IndividualDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [topics, setTopics] = useState<{ masteryPct: number }[]>([]);
  const [schedules, setSchedules] = useState<CandidateSchedule[]>([]);
  const [scheduleView, setScheduleView] = useState<'list' | 'calendar'>('list');
  const [scheduleError, setScheduleError] = useState('');

  useEffect(() => {
    void individualApi.getOverview().then((res) => setOverview(res.data)).catch(() => setOverview(null));
    void individualApi.getTopicsWithMastery().then((res) => setTopics(res.data ?? [])).catch(() => setTopics([]));
    void individualApi.getSchedules()
      .then((res) => {
        setSchedules(res.data ?? []);
        setScheduleError('');
      })
      .catch(() => {
        setSchedules([]);
        setScheduleError('Could not load organisation schedules right now.');
      });
  }, []);

  const avgMastery = topics.length > 0
    ? Math.round(topics.reduce((s, t) => s + Number(t.masteryPct), 0) / topics.length)
    : 0;

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

      <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
        <div className="rounded-3xl border border-white/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500">Topics</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{topics.length}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500">Avg Mastery</div>
          <div className="mt-2 text-3xl font-extrabold text-cyan-600">{avgMastery}%</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500">Buddy Sessions</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{overview?.counts?.buddySessionCount ?? 0}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500">Saved Notes</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{overview?.counts?.noteCount ?? 0}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-500">XP</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{overview?.xp?.totalXP ?? 0}</div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Assessments and interviews</h2>
            <p className="mt-1 text-sm text-slate-500">
              Pulled from every organisation schema where your email is scheduled.
            </p>
          </div>
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            {(['list', 'calendar'] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setScheduleView(view)}
                className={`rounded-xl px-4 py-2 text-sm font-bold capitalize transition-colors ${
                  scheduleView === view ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {scheduleError && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {scheduleError}
          </div>
        )}

        {schedules.length === 0 && !scheduleError ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
            No organisation has scheduled an assessment or interview for your email yet.
          </div>
        ) : scheduleView === 'list' ? (
          <div className="mt-5 grid gap-3">
            {schedules.map((item) => <ScheduleRow key={`${item.type}-${item.id}`} item={item} />)}
          </div>
        ) : (
          <ScheduleCalendar schedules={schedules} />
        )}
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

function ScheduleRow({ item }: { item: CandidateSchedule }) {
  const Icon = item.type === 'Interview' ? Video : ClipboardCheck;
  const start = new Date(item.startAt);

  return (
    <div className="rounded-2xl border border-slate-200 px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            item.type === 'Interview' ? 'bg-violet-50 text-violet-700' : 'bg-cyan-50 text-cyan-700'
          }`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-slate-900">{item.company}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                {item.type}
              </span>
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-700">{item.title}</div>
            <div className="mt-1 text-xs text-slate-500">{item.scheduleName || item.organisationSchema}</div>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[430px]">
          <ScheduleMeta label="Date" value={start.toLocaleString()} />
          <ScheduleMeta label="Duration" value={`${item.durationMinutes} min`} />
          <ScheduleMeta label="Status" value={item.status} />
        </div>

        <Link
          to={item.connectUrl}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
        >
          Connect <ExternalLink size={15} />
        </Link>
      </div>
    </div>
  );
}

function ScheduleMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function ScheduleCalendar({ schedules }: { schedules: CandidateSchedule[] }) {
  const firstDate = schedules[0]?.startAt ? new Date(schedules[0].startAt) : new Date();
  const start = new Date(firstDate);
  start.setDate(start.getDate() - start.getDay());

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      items: schedules.filter((item) => item.startAt.slice(0, 10) === key),
    };
  });

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-7">
      {days.map((day) => (
        <div key={day.key} className="min-h-[132px] rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-bold text-slate-500">{day.label}</div>
          <div className="mt-3 grid gap-2">
            {day.items.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                to={item.connectUrl}
                className={`rounded-xl px-2.5 py-2 text-xs font-bold leading-5 ${
                  item.type === 'Interview' ? 'bg-violet-100 text-violet-800' : 'bg-cyan-100 text-cyan-800'
                }`}
              >
                {item.company}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
