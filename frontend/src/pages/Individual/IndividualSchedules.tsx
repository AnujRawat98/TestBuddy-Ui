import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, ExternalLink, RefreshCcw, Video } from 'lucide-react';
import { individualApi } from '../../services/api';
import { shellCard, shellSub, shellTitle } from './IndividualShared';

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

export default function IndividualSchedules() {
  const [items, setItems] = useState<CandidateSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'calendar'>('list');

  const loadSchedules = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await individualApi.getSchedules();
      setItems(res.data ?? []);
    } catch (err: any) {
      console.error(err);
      setItems([]);
      setError(err.response?.data?.message || 'Could not load your scheduled assessments and interviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSchedules();
  }, []);

  const counts = useMemo(() => ({
    assessments: items.filter((item) => item.type === 'Assessment').length,
    interviews: items.filter((item) => item.type === 'Interview').length,
  }), [items]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-1 py-1">
      <section className={shellCard}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-sm font-bold text-cyan-700">
              <CalendarDays size={15} />
              Individual schedules
            </div>
            <h1 className={`${shellTitle} mt-4`}>Scheduled assessments and interviews</h1>
            <p className={shellSub}>
              This page scans all organisation schemas and shows every assessment or interview scheduled against your individual email.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSchedules()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Total" value={items.length} />
          <SummaryCard label="Assessments" value={counts.assessments} />
          <SummaryCard label="Interviews" value={counts.interviews} />
        </div>
      </section>

      <section className={shellCard}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Upcoming schedule</h2>
            <p className="mt-1 text-sm text-slate-500">Company, date, duration, status, and connect link.</p>
          </div>
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            {(['list', 'calendar'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-xl px-4 py-2 text-sm font-bold capitalize transition-colors ${
                  view === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
            Loading schedules from organisation schemas...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
            No organisation has scheduled an assessment or interview for your email yet.
          </div>
        ) : view === 'list' ? (
          <div className="mt-6 grid gap-3">
            {items.map((item) => <ScheduleRow key={`${item.type}-${item.id}`} item={item} />)}
          </div>
        ) : (
          <ScheduleCalendar schedules={items} />
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function ScheduleRow({ item }: { item: CandidateSchedule }) {
  const Icon = item.type === 'Interview' ? Video : ClipboardCheck;
  const start = new Date(item.startAt);
  const end = new Date(item.endAt);

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

        <div className="grid gap-3 text-sm sm:grid-cols-4 lg:min-w-[560px]">
          <ScheduleMeta label="Starts" value={start.toLocaleString()} />
          <ScheduleMeta label="Ends" value={end.toLocaleString()} />
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
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-7">
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
