import { useEffect, useMemo, useState } from 'react';
import { Bot, MessageSquare, Plus, Send } from 'lucide-react';
import { individualApi } from '../../services/api';
import { shellCard, shellSub, shellTitle } from './IndividualShared';

type BuddySession = {
  id: string;
  mode: string;
  summary?: string | null;
  startedAt?: string;
};

type BuddyMessage = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt?: string;
};

const modes = ['Explain', 'Socratic', 'Doubt', 'Revision', 'Deep'];

export default function IndividualBuddy() {
  const [sessions, setSessions] = useState<BuddySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<BuddyMessage[]>([]);
  const [mode, setMode] = useState('Explain');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions],
  );

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      void loadMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  async function loadSessions() {
    setLoading(true);
    setError('');
    try {
      const res = await individualApi.getBuddySessions();
      const list = res.data ?? [];
      setSessions(list);
      if (list.length > 0 && !activeSessionId) {
        setActiveSessionId(list[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not load your AI sessions right now.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(sessionId: string) {
    setError('');
    try {
      const res = await individualApi.getBuddyMessages(sessionId);
      setMessages(res.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not load this session yet.');
    }
  }

  async function createSession() {
    setError('');
    try {
      const res = await individualApi.createBuddySession({ mode });
      const session = res.data;
      setSessions((current) => [session, ...current]);
      setActiveSessionId(session.id);
      return session.id as string;
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not start a new AI session right now.');
      return '';
    }
  }

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError('');

    try {
      const sessionId = activeSessionId || await createSession();
      if (!sessionId) {
        return;
      }

      const res = await individualApi.sendBuddyMessage(sessionId, { content: draft.trim() });
      setMessages((current) => [...current, res.data.userMessage, res.data.assistantMessage]);
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId ? { ...session, summary: res.data.summary } : session,
        ),
      );
      setDraft('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Your message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <section className={`${shellCard} h-fit`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={shellTitle}>AI Teacher</h1>
            <p className={shellSub}>Start a focused learning conversation and keep the history in your own workspace.</p>
          </div>
          <Bot className="text-cyan-600" size={22} />
        </div>

        <div className="mt-5 grid gap-3">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
          <label className="text-sm font-semibold text-slate-700">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="min-h-11.5 rounded-2xl border border-slate-200 px-4 outline-none focus:border-cyan-400"
          >
            {modes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void createSession()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            New session
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="text-sm text-slate-500">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
              No sessions yet. Start one or just send a message and we will create the session for you.
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setActiveSessionId(session.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  session.id === activeSessionId
                    ? 'border-cyan-300 bg-cyan-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">{session.mode}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{session.summary || 'Fresh session'}</div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className={`${shellCard} flex min-h-155 flex-col`}>
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <MessageSquare className="text-cyan-600" size={20} />
          <div>
            <div className="text-lg font-bold text-slate-900">{activeSession?.mode || 'Select a session'}</div>
            <div className="text-sm text-slate-500">The assistant replies are stored per session in your individual workspace.</div>
          </div>
        </div>

        <div className="mt-4 flex-1 space-y-4 overflow-auto">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              Start a session and send your first question.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === 'assistant'
                    ? 'border border-cyan-100 bg-cyan-50 text-slate-700'
                    : 'ml-auto bg-slate-900 text-white'
                }`}
              >
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">{message.role}</div>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSend} className="mt-4 flex gap-3 border-t border-slate-100 pt-4">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask the AI teacher to explain, quiz, or guide you..."
            className="min-h-12 flex-1 rounded-2xl border border-slate-200 px-4 outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={16} />
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
