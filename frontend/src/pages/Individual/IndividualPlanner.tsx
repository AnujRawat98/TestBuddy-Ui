import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Trash2 } from 'lucide-react';
import { individualApi } from '../../services/api';
import { shellCard, shellSub, shellTitle } from './IndividualShared';

type PlannerItem = {
  id: string;
  title: string;
  description?: string | null;
  scheduledFor?: string | null;
  status: string;
};

export default function IndividualPlanner() {
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void loadItems();
  }, []);

  async function loadItems() {
    setError('');
    try {
      const res = await individualApi.getPlanner();
      setItems(res.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not load your planner right now.');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError('');
    try {
      await individualApi.createPlannerItem({
        title: title.trim(),
        description: description.trim(),
        scheduledFor: scheduledFor || undefined,
        status: 'Planned',
      });
      setTitle('');
      setDescription('');
      setScheduledFor('');
      await loadItems();
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not save that plan right now.');
    }
  }

  async function updateStatus(item: PlannerItem, status: string) {
    setError('');
    try {
      await individualApi.updatePlannerItem(item.id, {
        title: item.title,
        description: item.description ?? undefined,
        scheduledFor: item.scheduledFor ?? undefined,
        status,
      });
      await loadItems();
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not update this plan right now.');
    }
  }

  async function removeItem(id: string) {
    setError('');
    try {
      await individualApi.deletePlannerItem(id);
      await loadItems();
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not remove this plan right now.');
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
      <section className={shellCard}>
        <div className="flex items-center gap-3">
          <CalendarDays className="text-cyan-600" size={22} />
          <div>
            <h1 className={shellTitle}>Study planner</h1>
            <p className={shellSub}>Track what to study next and keep your own lightweight roadmap.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Plan title"
            className="min-h-[46px] w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-cyan-400"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What do you want to cover?"
            rows={6}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-cyan-400"
          />
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="min-h-[46px] w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-cyan-400"
          />
          <button type="submit" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
            Save plan
          </button>
        </form>
      </section>

      <section className={shellCard}>
        <div className="flex items-center gap-3">
          <ClipboardList className="text-cyan-600" size={22} />
          <div>
            <h2 className={shellTitle}>Planned sessions</h2>
            <p className={shellSub}>Keep planned and completed items in one place.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No study plans yet.
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-bold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.scheduledFor ? new Date(item.scheduledFor).toLocaleString() : 'No schedule yet'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void updateStatus(item, item.status === 'Completed' ? 'Planned' : 'Completed')}
                      className={`rounded-xl border p-2 ${
                        item.status === 'Completed'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button type="button" onClick={() => void removeItem(item.id)} className="rounded-xl border border-slate-200 p-2 text-rose-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {item.description && <div className="mt-3 text-sm leading-6 text-slate-600">{item.description}</div>}
                <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {item.status}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
