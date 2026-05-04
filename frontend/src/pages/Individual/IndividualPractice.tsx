import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookmarkIcon,
  BookmarkCheck,
  CheckCircle2,
  ChevronRight,
  Flame,
  Layers3,
  Lightbulb,
  ListChecks,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react';
import { individualApi } from '../../services/api';
import { shellCard, shellSub, shellTitle } from './IndividualShared';

// ─── Types ────────────────────────────────────────────────────────────────────

type TopicItem = {
  id: string;
  name: string;
  questionCount: number;
  masteryPct: number;
  lastAttempted?: string | null;
};

type QuestionOption = { id: string; text: string };

type SessionQuestion = {
  id: string;
  text: string;
  level: string;
  questionType: string;
  options: QuestionOption[];
  hints: string[];
  isBookmarked: boolean;
};

type AttemptResult = {
  isCorrect: boolean;
  correctOptionIds: string[];
  xpGained: number;
};

type SessionSummaryItem = {
  questionText: string;
  isCorrect: boolean;
  timeTaken: number;
};

type PracticeMode = 'FreePractice' | 'MockTest' | 'SpacedRepetition' | 'SpeedRound';

const MODES: { id: PracticeMode; label: string; icon: string; desc: string; timed: boolean; hints: boolean }[] = [
  { id: 'FreePractice',     label: 'Free Practice',     icon: '📖', desc: 'No timer. Hints on. Instant feedback.',          timed: false, hints: true  },
  { id: 'MockTest',         label: 'Mock Test',         icon: '⏱️', desc: 'Timed. No hints. Results at end.',               timed: true,  hints: false },
  { id: 'SpacedRepetition', label: 'Spaced Revision',   icon: '🔁', desc: 'SM-2 algorithm. Revisit weak answers over days.', timed: false, hints: true  },
  { id: 'SpeedRound',       label: 'Speed Round',       icon: '⚡', desc: '10 seconds per question. Build reflex speed.',    timed: true,  hints: false },
];

const QUESTION_COUNTS = [5, 10, 15, 20];
const SPEED_ROUND_SECS = 10;

// ─── Component ───────────────────────────────────────────────────────────────

export default function IndividualPractice() {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);

  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [mode, setMode] = useState<PracticeMode>('FreePractice');
  const [questionCount, setQuestionCount] = useState(10);

  // Session state
  const [sessionQuestions, setSessionQuestions] = useState<SessionQuestion[]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answer state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [hintLevel, setHintLevel] = useState(0); // 0 = none, 1/2/3
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());

  // Speed round timer
  const [timeLeft, setTimeLeft] = useState(SPEED_ROUND_SECS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Session summary
  const [sessionDone, setSessionDone] = useState(false);
  const [summary, setSummary] = useState<SessionSummaryItem[]>([]);
  const [totalXp, setTotalXp] = useState(0);

  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState('');

  // ─── Load topics ───────────────────────────────────────────────────────────

  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    setError('');
    try {
      const res = await individualApi.getTopicsWithMastery();
      setTopics(res.data ?? []);
    } catch {
      setError('Could not load topics. Make sure you have topics in your question bank.');
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  // ─── Speed round timer ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionActive || submitted || sessionDone) return;
    if (mode !== 'SpeedRound') return;

    setTimeLeft(SPEED_ROUND_SECS);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          void autoSubmitEmpty();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, sessionActive, submitted, sessionDone]);

  async function autoSubmitEmpty() {
    const q = sessionQuestions[currentIndex];
    if (!q) return;
    await doSubmit(q.id, [], true);
  }

  // ─── Start session ─────────────────────────────────────────────────────────

  async function startSession() {
    setSessionLoading(true);
    setError('');
    try {
      const res = await individualApi.getPracticeSession({
        topicId: selectedTopicId || undefined,
        mode,
        count: questionCount,
      });
      const qs: SessionQuestion[] = res.data ?? [];
      if (qs.length === 0) {
        setError('No questions available for this topic yet. Select the topic and use "Generate AI Questions" to create some.');
        return;
      }
      setSessionQuestions(qs);
      setBookmarked(new Set(qs.filter((q) => q.isBookmarked).map((q) => q.id)));
      setCurrentIndex(0);
      setSelectedIds([]);
      setSubmitted(false);
      setResult(null);
      setHintLevel(0);
      setSummary([]);
      setTotalXp(0);
      setSessionDone(false);
      setSessionActive(true);
      startTimeRef.current = Date.now();
    } catch {
      setError('Could not load questions right now. Please try again.');
    } finally {
      setSessionLoading(false);
    }
  }

  // ─── Answer selection ──────────────────────────────────────────────────────

  function toggleOption(id: string) {
    if (submitted) return;
    const q = sessionQuestions[currentIndex];
    const isMulti = q?.questionType?.toLowerCase().includes('multi');
    if (isMulti) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    } else {
      setSelectedIds([id]);
    }
  }

  // ─── Submit answer ─────────────────────────────────────────────────────────

  async function handleSubmit() {
    const q = sessionQuestions[currentIndex];
    if (!q || submitted) return;
    await doSubmit(q.id, selectedIds, false);
  }

  async function doSubmit(questionId: string, chosenIds: string[], _autoSubmitted: boolean) {
    if (timerRef.current) clearInterval(timerRef.current);
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);

    setSubmitted(true);
    try {
      const res = await individualApi.submitPracticeAttempt({
        questionId,
        selectedOptionIds: chosenIds,
        timeTakenSeconds: elapsed,
        hintUsed: hintLevel,
        mode,
      });
      const data: AttemptResult = res.data;
      setResult(data);
      setTotalXp((prev) => prev + (data.xpGained ?? 0));

      const q = sessionQuestions[currentIndex];
      setSummary((prev) => [
        ...prev,
        {
          questionText: q?.text ?? '',
          isCorrect: data.isCorrect,
          timeTaken: elapsed,
        },
      ]);

      // Mock test — hide result, just record; show after session
      if (mode === 'MockTest') {
        setResult(null);
      }
    } catch {
      setError('Could not record your answer. Please try again.');
      setSubmitted(false);
    }
  }

  // ─── Next question / finish ────────────────────────────────────────────────

  function handleNext() {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= sessionQuestions.length) {
      setSessionDone(true);
      setSessionActive(false);
      void loadTopics(); // refresh mastery %
      return;
    }
    setCurrentIndex(nextIndex);
    setSelectedIds([]);
    setSubmitted(false);
    setResult(null);
    setHintLevel(0);
    startTimeRef.current = Date.now();
  }

  // ─── Bookmark toggle ───────────────────────────────────────────────────────

  async function toggleBookmark(questionId: string) {
    try {
      if (bookmarked.has(questionId)) {
        await individualApi.removeBookmark(questionId);
        setBookmarked((prev) => { const s = new Set(prev); s.delete(questionId); return s; });
      } else {
        await individualApi.addBookmark({ questionId });
        setBookmarked((prev) => new Set([...prev, questionId]));
      }
    } catch {
      /* ignore */
    }
  }

  // ─── AI question generation ────────────────────────────────────────────────

  async function generateQuestions(topicId: string, count = 10) {
    setGenerating(true);
    setGenerateSuccess('');
    setError('');
    try {
      const res = await individualApi.generatePracticeQuestions({ topicId, count });
      const { generated, topicName } = res.data;
      setGenerateSuccess(`Generated ${generated} questions for "${topicName}". You can now start a session.`);
      await loadTopics(); // refresh question counts
    } catch (err: any) {
      setError(err.response?.data?.message || 'AI generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  // ─── Reset to setup ────────────────────────────────────────────────────────

  function resetToSetup() {
    setSessionActive(false);
    setSessionDone(false);
    setSessionQuestions([]);
    setError('');
    setGenerateSuccess('');
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const currentTopic = topics.find((t) => t.id === selectedTopicId);
  const currentQuestion = sessionQuestions[currentIndex];
  const progressPct = sessionQuestions.length > 0
    ? Math.round(((currentIndex + (submitted ? 1 : 0)) / sessionQuestions.length) * 100)
    : 0;

  // Session done → show summary
  if (sessionDone) {
    const correct = summary.filter((s) => s.isCorrect).length;
    const pct = summary.length > 0 ? Math.round((correct / summary.length) * 100) : 0;
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className={shellCard}>
          <div className="flex items-center gap-3">
            <Trophy className="text-cyan-600" size={22} />
            <div>
              <h1 className={shellTitle}>Session complete</h1>
              <p className={shellSub}>Here is how you did this round.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Score</div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">{pct}%</div>
              <div className="text-sm text-slate-500">{correct}/{summary.length} correct</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">XP Earned</div>
              <div className="mt-2 text-3xl font-extrabold text-cyan-600">+{totalXp}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Mode</div>
              <div className="mt-2 text-xl font-bold text-slate-900">{MODES.find((m) => m.id === mode)?.label}</div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {summary.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
                  item.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
                }`}
              >
                {item.isCorrect
                  ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  : <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />}
                <div className="flex-1 leading-5 text-slate-700">{item.questionText}</div>
                <div className="shrink-0 text-xs text-slate-400">{item.timeTaken}s</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={resetToSetup}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              <RotateCcw size={15} />
              Practice again
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">

      {/* ── LEFT: Topic browser ────────────────────────────────────────────── */}
      <section className={`${shellCard} h-fit`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={shellTitle}>Practice Hub</h1>
            <p className={shellSub}>Select a topic then start a session.</p>
          </div>
          <Layers3 className="text-cyan-600" size={20} />
        </div>

        {error && !sessionActive && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {generateSuccess && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {generateSuccess}
          </div>
        )}

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => setSelectedTopicId('')}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
              selectedTopicId === ''
                ? 'border-cyan-300 bg-cyan-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="font-semibold text-slate-900">All topics</div>
            <div className="text-xs text-slate-500">{topics.reduce((s, t) => s + t.questionCount, 0)} questions total</div>
          </button>

          {topicsLoading ? (
            <div className="text-sm text-slate-500 px-1 py-3">Loading topics...</div>
          ) : topics.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
              No topics available. Please refresh the page.
            </div>
          ) : (
            topics.map((topic) => (
              <div
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition cursor-pointer ${
                  topic.id === selectedTopicId
                    ? 'border-cyan-300 bg-cyan-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900 truncate">{topic.name}</div>
                  <div className="shrink-0 text-xs font-bold text-slate-500">{Math.round(Number(topic.masteryPct))}%</div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all"
                    style={{ width: `${Math.round(Number(topic.masteryPct))}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">{topic.questionCount} questions</span>
                  {topic.questionCount === 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void generateQuestions(topic.id); }}
                      className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-200"
                    >
                      <Sparkles size={10} />
                      Generate AI questions
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── RIGHT: Setup or Active session ───────────────────────────────────── */}
      <section>
        {!sessionActive ? (
          /* ─ Setup panel ─ */
          <div className={shellCard}>
            <h2 className={shellTitle}>Configure session</h2>
            <p className={shellSub}>
              {currentTopic
                ? `Practicing: ${currentTopic.name} · ${currentTopic.questionCount} questions · ${Math.round(Number(currentTopic.masteryPct))}% mastered`
                : 'All topics selected'}
            </p>

            {/* Mode selector */}
            <div className="mt-6">
              <div className="mb-3 text-sm font-semibold text-slate-700">Practice mode</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      mode === m.id
                        ? 'border-cyan-400 bg-cyan-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{m.icon}</span>
                      <span className="text-sm font-semibold text-slate-900">{m.label}</span>
                      {m.timed && (
                        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          Timed
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-xs leading-5 text-slate-500">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Question count */}
            <div className="mt-6">
              <div className="mb-3 text-sm font-semibold text-slate-700">Number of questions</div>
              <div className="flex gap-2">
                {QUESTION_COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuestionCount(n)}
                    className={`h-10 w-12 rounded-2xl border text-sm font-semibold transition ${
                      questionCount === n
                        ? 'border-cyan-400 bg-cyan-50 text-cyan-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {currentTopic && currentTopic.questionCount === 0 ? (
              <div className="mt-8 space-y-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  <strong>{currentTopic.name}</strong> has no questions yet. Generate them with AI to start practicing.
                </div>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void generateQuestions(currentTopic.id, questionCount)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Sparkles size={16} />
                  {generating ? 'Generating...' : `Generate ${questionCount} AI Questions`}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={sessionLoading}
                onClick={() => void startSession()}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sessionLoading ? 'Loading...' : (
                  <>
                    <Zap size={16} />
                    Start {MODES.find((m2) => m2.id === mode)?.label}
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          /* ─ Active session ─ */
          <div className={`${shellCard} flex flex-col gap-5`}>

            {/* Progress bar */}
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>Question {currentIndex + 1} of {sessionQuestions.length}</span>
                <span className="font-semibold">{progressPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {/* Speed round timer */}
              {mode === 'SpeedRound' && !submitted && (
                <div className={`mt-3 flex items-center gap-2 text-sm font-bold ${timeLeft <= 3 ? 'text-rose-600' : 'text-amber-600'}`}>
                  <Flame size={15} />
                  {timeLeft}s remaining
                </div>
              )}
            </div>

            {/* Question */}
            {currentQuestion && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {currentQuestion.level}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {currentQuestion.questionType}
                      </span>
                    </div>
                    <p className="text-base font-semibold leading-7 text-slate-900">{currentQuestion.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleBookmark(currentQuestion.id)}
                    className="shrink-0 rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-amber-300 hover:text-amber-500 transition"
                    title={bookmarked.has(currentQuestion.id) ? 'Remove bookmark' : 'Bookmark this question'}
                  >
                    {bookmarked.has(currentQuestion.id)
                      ? <BookmarkCheck size={16} className="text-amber-500" />
                      : <BookmarkIcon size={16} />}
                  </button>
                </div>

                {/* Options */}
                <div className="space-y-2.5">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = selectedIds.includes(opt.id);
                    const isCorrectOpt = result?.correctOptionIds.includes(opt.id);
                    let cls = 'border-slate-200 bg-white text-slate-700 hover:border-slate-300';

                    if (submitted && result) {
                      if (isCorrectOpt)
                        cls = 'border-emerald-400 bg-emerald-50 text-emerald-900 font-semibold';
                      else if (isSelected && !isCorrectOpt)
                        cls = 'border-rose-400 bg-rose-50 text-rose-800';
                      else
                        cls = 'border-slate-100 bg-slate-50 text-slate-400';
                    } else if (isSelected) {
                      cls = 'border-cyan-400 bg-cyan-50 text-cyan-900 font-semibold';
                    }

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={submitted}
                        onClick={() => toggleOption(opt.id)}
                        className={`w-full rounded-2xl border px-4 py-3.5 text-left text-sm transition ${cls}`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition ${
                              isSelected && !submitted
                                ? 'border-cyan-500 bg-cyan-500 text-white'
                                : submitted && isCorrectOpt
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-current'
                            }`}
                          >
                            {submitted && isCorrectOpt ? '✓' : isSelected && !submitted ? '●' : ''}
                          </span>
                          {opt.text}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Hints (only in non-mock modes) */}
                {MODES.find((m2) => m2.id === mode)?.hints && !submitted && (
                  <div className="flex flex-wrap gap-2">
                    {currentQuestion.hints.map((_hint, i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={hintLevel > i}
                        onClick={() => setHintLevel(i + 1)}
                        className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-semibold transition ${
                          hintLevel > i
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
                        }`}
                      >
                        <Lightbulb size={12} />
                        Hint {i + 1}
                        {hintLevel > i && <span className="text-amber-500">on</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Hint text */}
                {hintLevel > 0 && MODES.find((m2) => m2.id === mode)?.hints && !submitted && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                    <strong>Hint {hintLevel}:</strong> {currentQuestion.hints[hintLevel - 1]}
                  </div>
                )}

                {/* Result feedback (not in mock test) */}
                {submitted && result && mode !== 'MockTest' && (
                  <div
                    className={`rounded-2xl border px-4 py-4 text-sm leading-6 ${
                      result.isCorrect
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      {result.isCorrect
                        ? <><CheckCircle2 size={16} /> Correct! +{result.xpGained} XP</>
                        : <><XCircle size={16} /> Incorrect. +{result.xpGained} XP for attempting</>}
                    </div>
                    {!result.isCorrect && (
                      <p className="mt-2">
                        The correct answer is highlighted above. Review it before moving on.
                      </p>
                    )}
                  </div>
                )}

                {/* Mock test submitted indicator */}
                {submitted && mode === 'MockTest' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Answer recorded. Results will be shown at the end of the session.
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  {!submitted ? (
                    <button
                      type="button"
                      disabled={selectedIds.length === 0}
                      onClick={() => void handleSubmit()}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <ListChecks size={15} />
                      Submit answer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white"
                    >
                      {currentIndex + 1 < sessionQuestions.length ? (
                        <><ChevronRight size={15} /> Next question</>
                      ) : (
                        <><Trophy size={15} /> View results</>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetToSetup}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-300"
                  >
                    End session
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
