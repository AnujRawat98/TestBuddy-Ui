import { useEffect, useState } from 'react';
import { Award, Flame, Layers3, Trophy } from 'lucide-react';
import { individualApi } from '../../services/api';
import { shellCard, shellSub, shellTitle } from './IndividualShared';

type ProgressData = {
  userXp: {
    totalXP: number;
    level: number;
    streak: number;
    lastActive?: string | null;
  };
  badges: Array<{ id: string; badgeKey: string; earnedAt?: string }>;
};

export default function IndividualProgress() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    void loadProgress();
  }, []);

  async function loadProgress() {
    const [progressRes, overviewRes] = await Promise.all([
      individualApi.getProgress(),
      individualApi.getOverview(),
    ]);
    setData(progressRes.data);
    setOverview(overviewRes.data);
  }

  const totalActions =
    (overview?.counts?.buddySessionCount ?? 0) +
    (overview?.counts?.noteCount ?? 0) +
    (overview?.counts?.plannerCount ?? 0);
  const readinessScore = Math.min(100, (data?.userXp.totalXP ?? 0) + totalActions * 4);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className={shellCard}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className={shellTitle}>Learning analytics</h1>
            <p className={shellSub}>A simple read on momentum, consistency, and how actively you are using your practice workspace.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Readiness</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{readinessScore}%</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Tracked actions</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{totalActions}</div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${shellCard} grid gap-4 md:grid-cols-3`}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
            <Trophy size={18} />
          </div>
          <div className="mt-4 text-sm font-semibold text-slate-500">Total XP</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{data?.userXp.totalXP ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Layers3 size={18} />
          </div>
          <div className="mt-4 text-sm font-semibold text-slate-500">Level</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{data?.userXp.level ?? 1}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
            <Flame size={18} />
          </div>
          <div className="mt-4 text-sm font-semibold text-slate-500">Streak</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{data?.userXp.streak ?? 0}</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className={`${shellCard} lg:col-span-2`}>
          <h2 className="text-lg font-bold text-slate-900">Activity snapshot</h2>
          <p className="mt-1 text-sm text-slate-500">A quick pulse on how you are using the workspace right now.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 px-4 py-4">
              <div className="text-sm font-semibold text-slate-500">Buddy sessions</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{overview?.counts?.buddySessionCount ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-4">
              <div className="text-sm font-semibold text-slate-500">Notes captured</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{overview?.counts?.noteCount ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-4">
              <div className="text-sm font-semibold text-slate-500">Planner items</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{overview?.counts?.plannerCount ?? 0}</div>
            </div>
          </div>
        </div>

        <div className={shellCard}>
          <h2 className="text-lg font-bold text-slate-900">Next milestone</h2>
          <p className="mt-1 text-sm text-slate-500">A lightweight target based on the current XP model.</p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-500">XP to next level</div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900">
              {Math.max(0, (data?.userXp.level ?? 1) * 100 - (data?.userXp.totalXP ?? 0))}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              Use the AI teacher, save notes, and complete planner items to keep moving.
            </div>
          </div>
        </div>
      </section>

      <section className={shellCard}>
        <div className="flex items-center gap-3">
          <Award className="text-cyan-600" size={22} />
          <div>
            <h2 className={shellTitle}>Badges</h2>
            <p className={shellSub}>Progress badges are awarded as you use the learning workspace.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.badges ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No badges yet. Save notes, plan study sessions, and use the AI teacher to start building momentum.
            </div>
          ) : (
            (data?.badges ?? []).map((badge) => (
              <div key={badge.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="text-base font-bold text-slate-900">{badge.badgeKey}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Earned {badge.earnedAt ? new Date(badge.earnedAt).toLocaleString() : 'recently'}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
