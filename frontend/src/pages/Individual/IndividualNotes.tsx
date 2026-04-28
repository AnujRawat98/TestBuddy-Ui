import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { BookMarked, PencilLine, Trash2 } from 'lucide-react';
import { individualApi } from '../../services/api';
import { shellCard, shellSub, shellTitle } from './IndividualShared';

type NoteItem = {
  id: string;
  title?: string | null;
  content: string;
  updatedAt?: string;
};

export default function IndividualNotes() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    void loadNotes();
  }, []);

  async function loadNotes() {
    setError('');
    try {
      const res = await individualApi.getNotes();
      setNotes(res.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not load your notes right now.');
    }
  }

  function startEdit(note: NoteItem) {
    setEditingId(note.id);
    setTitle(note.title ?? '');
    setContent(note.content);
  }

  function resetForm() {
    setEditingId('');
    setTitle('');
    setContent('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError('');
    try {
      if (editingId) {
        await individualApi.updateNote(editingId, { title: title.trim(), content: content.trim() });
      } else {
        await individualApi.createNote({ title: title.trim(), content: content.trim() });
      }
      resetForm();
      await loadNotes();
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not save this note right now.');
    }
  }

  async function handleDelete(id: string) {
    setError('');
    try {
      await individualApi.deleteNote(id);
      if (editingId === id) {
        resetForm();
      }
      await loadNotes();
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not delete this note right now.');
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
      <section className={shellCard}>
        <div className="flex items-center gap-3">
          <PencilLine className="text-cyan-600" size={22} />
          <div>
            <h1 className={shellTitle}>{editingId ? 'Edit note' : 'New note'}</h1>
            <p className={shellSub}>Save revision notes, clarifications, and learning takeaways.</p>
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
            placeholder="Title"
            className="min-h-[46px] w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-cyan-400"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write what you want to remember..."
            rows={10}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-cyan-400"
          />
          <div className="flex gap-3">
            <button type="submit" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
              {editingId ? 'Update note' : 'Save note'}
            </button>
            {(editingId || title || content) && (
              <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
                Clear
              </button>
            )}
          </div>
        </form>
      </section>

      <section className={shellCard}>
        <div className="flex items-center gap-3">
          <BookMarked className="text-cyan-600" size={22} />
          <div>
            <h2 className={shellTitle}>Saved notes</h2>
            <p className={shellSub}>Everything you save here stays attached to your individual learning account.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {notes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No notes yet. Save your first idea or summary here.
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-bold text-slate-900">{note.title || 'Untitled note'}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Updated {note.updatedAt ? new Date(note.updatedAt).toLocaleString() : 'recently'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(note)} className="rounded-xl border border-slate-200 p-2 text-slate-600">
                      <PencilLine size={16} />
                    </button>
                    <button type="button" onClick={() => void handleDelete(note.id)} className="rounded-xl border border-slate-200 p-2 text-rose-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{note.content}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
