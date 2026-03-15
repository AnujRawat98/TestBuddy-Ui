import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import './ExamScreen.css';
import { assessmentsApi } from '../../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Option {
    id:       string;
    text:     string;
    imageUrl?: string;
}

interface Question {
    id:           string;
    // API may return different field names — handle both
    content?:     string;
    text?:        string;
    questionText?: string;
    questionType: string;  // "MCQ" | "MultipleCorrect" | "OpenText" | "ImageSelect"
    marks?:       number;
    difficulty?:  string;
    topicName?:   string;
    options:      Option[];
    // Duration may come on first question or a wrapper object
    durationMinutes?: number;
    totalDuration?:   number;
}

interface AttemptResponse {
    questions:       Question[];
    durationMinutes: number;
    examTitle?:      string;
}

type QStatus = 'unanswered' | 'answered' | 'marked' | 'skipped';

interface QState {
    status: QStatus;
    answer: string | string[] | null;  // optionId(s) for MCQ/multi, text for open
}

interface ExamResult {
    score?:          number;
    totalMarks?:     number;
    correct?:        number;
    wrong?:          number;
    unattempted?:    number;
    passed?:         boolean;
    percentage?:     number;
}

// ── Question type detection ───────────────────────────────────────────────────
const isMCQ   = (qt: string) => /mcq|single|single.correct/i.test(qt);
const isMulti = (qt: string) => /multi|multiple.correct/i.test(qt);
const isText  = (qt: string) => /open|text|descriptive/i.test(qt);
const isImage = (qt: string) => /image|picture/i.test(qt);

const qText = (q: Question) =>
    q.content ?? q.text ?? q.questionText ?? '';

// ─────────────────────────────────────────────────────────────────────────────
const ExamScreen: React.FC = () => {
    const { attemptId } = useParams<{ attemptId: string }>();

    const [questions,   setQuestions]   = useState<Question[]>([]);
    const [qState,      setQState]      = useState<QState[]>([]);
    const [currentQ,    setCurrentQ]    = useState(0);
    const [timeLeft,    setTimeLeft]    = useState(0);
    const [totalTime,   setTotalTime]   = useState(0);
    const [examTitle,   setExamTitle]   = useState('Assessment');
    const [loading,     setLoading]     = useState(true);
    const [loadError,   setLoadError]   = useState('');

    // Proctoring
    const [flags,          setFlags]          = useState(0);
    const [tabWarning,     setTabWarning]      = useState(false);
    const [warningMsg,     setWarningMsg]      = useState('');

    // Modals
    const [submitModal, setSubmitModal]   = useState(false);
    const [resultOpen,  setResultOpen]    = useState(false);
    const [result,      setResult]        = useState<ExamResult | null>(null);

    // Save status
    const [savingId, setSavingId] = useState<string | null>(null);

    const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
    const submitRef = useRef(false); // prevent double-submit

    // Toast
    const [toast, setToast] = useState({ show: false, msg: '', type: 'info' });
    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(p => ({ ...p, show: false })), 3200);
    };

    // ── FETCH QUESTIONS ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!attemptId) return;
        (async () => {
            try {
                const res  = await assessmentsApi.getAttemptQuestions(attemptId);
                const data = res.data;
                console.log('[ExamScreen] getAttemptQuestions raw response:', data);

                // Handle all possible response shapes from backend
                let qs: Question[]  = [];
                let dur             = 30;
                let title           = 'Assessment';

                if (Array.isArray(data)) {
                    // Backend returns Question[] directly
                    qs    = data;
                    dur   = data[0]?.durationMinutes ?? data[0]?.totalDuration ?? 30;
                } else if (data && typeof data === 'object') {
                    // Backend returns wrapped { questions, durationMinutes, examTitle }
                    qs    = data.questions ?? data.items ?? data.value ?? [];
                    dur   = data.durationMinutes ?? data.totalDuration ?? data.duration ?? 30;
                    title = data.examTitle ?? data.title ?? data.assessmentTitle ?? 'Assessment';
                }

                // Normalise question fields — backend may use different casing/names
                const normalised: Question[] = qs.map((q: any) => ({
                    ...q,
                    id:           q.id           ?? q.Id           ?? q.questionId ?? '',
                    questionType: q.questionType ?? q.QuestionType ?? q.type        ?? 'MCQ',
                    content:      q.content      ?? q.text         ?? q.questionText ?? q.Content ?? '',
                    marks:        q.marks        ?? q.Marks        ?? q.marksPerQuestion ?? 1,
                    difficulty:   q.difficulty   ?? q.Difficulty   ?? q.level ?? '',
                    topicName:    q.topicName    ?? q.TopicName    ?? q.topic ?? '',
                    options: (q.options ?? q.Options ?? []).map((o: any) => ({
                        id:       o.id       ?? o.Id       ?? o.optionId   ?? '',
                        text:     o.text     ?? o.Text     ?? o.optionText ?? '',
                        imageUrl: o.imageUrl ?? o.ImageUrl ?? null,
                    })),
                }));

                console.log('[ExamScreen] normalised questions:', normalised.length, 'duration:', dur);

                if (normalised.length === 0) {
                    setLoadError('No questions found for this exam attempt.');
                    return;
                }

                setQuestions(normalised);
                setExamTitle(title);
                setQState(normalised.map(() => ({ status: 'unanswered', answer: null })));
                setTimeLeft(dur * 60);
                setTotalTime(dur * 60);
            } catch (err: any) {
                console.error('[ExamScreen] fetch failed:', err?.response ?? err);
                setLoadError(
                    err?.response?.data?.message ??
                    err?.response?.data?.title   ??
                    (typeof err?.response?.data === 'string' ? err.response.data : null) ??
                    'Failed to load exam questions.'
                );
            } finally {
                setLoading(false);
            }
        })();
    }, [attemptId]);

    // ── TIMER ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (loading || resultOpen || questions.length === 0) return;
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current!);
    }, [loading, resultOpen, questions.length]);

    // Auto-submit when timer hits 0
    useEffect(() => {
        if (timeLeft === 0 && questions.length > 0 && !resultOpen && !submitRef.current) {
            showToast('Time up! Submitting your exam…', 'error');
            finalSubmit();
        }
    }, [timeLeft]);

    // ── PROCTORING: tab / visibility change ───────────────────────────────────
    const handleVisibility = useCallback(() => {
        if (document.hidden && !resultOpen) {
            setFlags(prev => {
                const next = prev + 1;
                setWarningMsg(`Tab switch detected! This is violation #${next}. Further violations may result in exam termination.`);
                setTabWarning(true);
                return next;
            });
        }
    }, [resultOpen]);

    useEffect(() => {
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [handleVisibility]);

    const dismissWarning = () => setTabWarning(false);

    // ── ANSWER SELECTION ──────────────────────────────────────────────────────
    const saveAnswer = async (questionId: string, answer: string) => {
        if (!attemptId) return;
        setSavingId(questionId);
        try {
            await assessmentsApi.saveAnswer({ attemptQuestionId: questionId, answer });
        } catch {
            // Silent — answer still stored in local state
        } finally {
            setSavingId(null);
        }
    };

    // Single choice (MCQ)
    const selectSingle = (optId: string) => {
        const q = questions[currentQ];
        setQState(prev => {
            const ns = [...prev];
            ns[currentQ] = { status: 'answered', answer: optId };
            return ns;
        });
        saveAnswer(q.id, optId);
    };

    // Multiple correct
    const toggleMulti = (optId: string) => {
        const q = questions[currentQ];
        setQState(prev => {
            const ns  = [...prev];
            const cur = Array.isArray(ns[currentQ].answer) ? [...ns[currentQ].answer as string[]] : [];
            const idx = cur.indexOf(optId);
            if (idx === -1) cur.push(optId); else cur.splice(idx, 1);
            ns[currentQ] = {
                status: cur.length > 0 ? 'answered' : 'unanswered',
                answer: cur.length > 0 ? cur : null,
            };
            // Auto-save as comma-separated
            if (cur.length > 0) saveAnswer(q.id, cur.join(','));
            return ns;
        });
    };

    // Text answer — save on blur to avoid too many API calls
    const setTextAnswer = (text: string) => {
        setQState(prev => {
            const ns = [...prev];
            ns[currentQ] = {
                status: text.trim() ? 'answered' : 'unanswered',
                answer: text,
            };
            return ns;
        });
    };

    const saveTextOnBlur = () => {
        const q   = questions[currentQ];
        const ans = qState[currentQ]?.answer;
        if (typeof ans === 'string' && ans.trim()) {
            saveAnswer(q.id, ans.trim());
        }
    };

    // ── NAVIGATION ────────────────────────────────────────────────────────────
    const goTo = (idx: number) => setCurrentQ(idx);

    const prevQ = () => { if (currentQ > 0) setCurrentQ(p => p - 1); };

    const nextQ = () => {
        if (currentQ < questions.length - 1) {
            // Mark as skipped if unanswered when moving forward
            setQState(prev => {
                const ns = [...prev];
                if (ns[currentQ].status === 'unanswered') ns[currentQ].status = 'skipped';
                return ns;
            });
            setCurrentQ(p => p + 1);
        }
    };

    const skipQ = () => {
        setQState(prev => {
            const ns = [...prev];
            ns[currentQ].status = 'skipped';
            return ns;
        });
        if (currentQ < questions.length - 1) setCurrentQ(p => p + 1);
    };

    const markForReview = () => {
        setQState(prev => {
            const ns  = [...prev];
            const cur = ns[currentQ];
            cur.status = cur.status === 'marked' ? (cur.answer ? 'answered' : 'unanswered') : 'marked';
            return ns;
        });
    };

    // ── SUBMIT ────────────────────────────────────────────────────────────────
    const finalSubmit = async () => {
        if (!attemptId || submitRef.current) return;
        submitRef.current = true;
        clearInterval(timerRef.current!);
        setLoading(true);
        setSubmitModal(false);
        try {
            const res = await assessmentsApi.submitAttempt(attemptId);
            setResult(res.data ?? {});
            setResultOpen(true);
        } catch (err: any) {
            showToast(err?.response?.data?.message ?? 'Submission failed. Please try again.', 'error');
            submitRef.current = false;
        } finally {
            setLoading(false);
        }
    };

    // ── STATS ─────────────────────────────────────────────────────────────────
    const stats = qState.reduce(
        (acc, s) => {
            if      (s.status === 'answered') acc.ans++;
            else if (s.status === 'marked')   acc.mrk++;
            else if (s.status === 'skipped')  acc.skp++;
            else                               acc.rem++;
            return acc;
        },
        { ans: 0, mrk: 0, skp: 0, rem: 0 }
    );

    // ── TIMER RENDER ──────────────────────────────────────────────────────────
    const fmtTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const timerClass = timeLeft <= 60 ? 'danger' : timeLeft <= 300 ? 'warning' : '';

    // Progress ring for timer
    const ringCircumference = 138;
    const ringProgress = totalTime > 0 ? (timeLeft / totalTime) * ringCircumference : ringCircumference;
    const ringColor = timeLeft <= 60 ? 'var(--red)' : timeLeft <= 300 ? 'var(--yellow)' : 'var(--accent)';

    // ── RENDER: Loading ───────────────────────────────────────────────────────
    if (loading && questions.length === 0) {
        return (
            <div className="exam-screen-wrap" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
                <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 600 }}>Loading Exam…</div>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="exam-screen-wrap" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
                <div style={{ textAlign: 'center', color: 'var(--muted)', maxWidth: 400 }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--ink)' }}>Failed to Load Exam</div>
                    <div style={{ fontSize: '14px' }}>{loadError}</div>
                </div>
            </div>
        );
    }

    const q  = questions[currentQ];
    const qs = qState[currentQ];
    const qt = q?.questionType ?? '';
    const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

    // ── RENDER: Question ──────────────────────────────────────────────────────
    const renderQuestion = () => {
        if (!q) return null;

        // ── MCQ / Single correct ──────────────────────────────────────────────
        if (isMCQ(qt) || (!isMulti(qt) && !isText(qt) && !isImage(qt) && q.options?.length > 0)) {
            return (
                <div className="options-list">
                    {q.options.map((opt, i) => {
                        const selected = qs.answer === opt.id;
                        return (
                            <div key={opt.id} className={`option ${selected ? 'selected' : ''}`}
                                onClick={() => selectSingle(opt.id)}>
                                <div className="option-key">{KEYS[i] ?? i + 1}</div>
                                <span>{opt.text}</span>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // ── Multiple correct ──────────────────────────────────────────────────
        if (isMulti(qt)) {
            const sel = Array.isArray(qs.answer) ? qs.answer as string[] : [];
            return (
                <div className="options-list">
                    <div style={{ fontSize: '12px', color: 'var(--accent2)', marginBottom: '10px', fontWeight: 500 }}>
                        ☑️ Select all that apply
                    </div>
                    {q.options.map((opt, i) => {
                        const selected = sel.includes(opt.id);
                        return (
                            <div key={opt.id} className={`multi-option ${selected ? 'selected' : ''}`}
                                onClick={() => toggleMulti(opt.id)}>
                                <div className="multi-checkbox">{selected ? '✓' : ''}</div>
                                <div className="option-key">{KEYS[i] ?? i + 1}</div>
                                <span>{opt.text}</span>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // ── Image Select ──────────────────────────────────────────────────────
        if (isImage(qt)) {
            return (
                <div className="options-list">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                        {q.options.map((opt, i) => {
                            const selected = qs.answer === opt.id;
                            return (
                                <div key={opt.id}
                                    onClick={() => selectSingle(opt.id)}
                                    style={{
                                        border: `2px solid ${selected ? 'var(--accent2)' : 'var(--border)'}`,
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        background: selected ? 'rgba(0,87,255,.06)' : 'var(--card)',
                                        transition: 'all .18s',
                                    }}>
                                    {opt.imageUrl
                                        ? <img src={opt.imageUrl} alt={`Option ${KEYS[i]}`}
                                            style={{ width: '100%', display: 'block', maxHeight: '160px', objectFit: 'cover' }} />
                                        : <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🖼</div>
                                    }
                                    <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                        <div className="option-key" style={{ width: 24, height: 24, fontSize: '11px' }}>{KEYS[i]}</div>
                                        <span>{opt.text}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        // ── Open Text ─────────────────────────────────────────────────────────
        if (isText(qt)) {
            const textVal = typeof qs.answer === 'string' ? qs.answer : '';
            return (
                <div className="text-answer-wrap">
                    <textarea
                        placeholder="Type your answer here…"
                        value={textVal}
                        onChange={e => setTextAnswer(e.target.value)}
                        onBlur={saveTextOnBlur}
                        rows={6}
                    />
                    <div className="text-char-count">{textVal.length} characters</div>
                </div>
            );
        }

        return <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Unknown question type: {qt}</div>;
    };

    return (
        <div className="exam-screen-wrap">

            {/* ── Tab Switch Warning ─────────────────────────────────────────── */}
            <div className={`tab-warning ${tabWarning ? 'show' : ''}`}>
                <div className="tw-icon">⚠️</div>
                <div className="tw-title">Violation Detected!</div>
                <div className="tw-sub">{warningMsg}</div>
                <button className="tw-btn" onClick={dismissWarning}>Continue Exam</button>
            </div>

            {/* ── Top Bar ───────────────────────────────────────────────────── */}
            <div className="topbar">
                <div className="tb-left">
                    <div className="tb-logo">Test<span>Buddy</span></div>
                    <div className="tb-exam-name">{examTitle}</div>
                </div>
                <div className="tb-right">
                    {flags > 0 && (
                        <div className="flag-counter">🚩 {flags} violation{flags !== 1 ? 's' : ''}</div>
                    )}
                    <div className="proctor-badge">
                        <div className="proctor-dot" /> Live Proctored
                    </div>
                </div>
            </div>

            <div className="exam-body">

                {/* ── Left Sidebar ──────────────────────────────────────────── */}
                <aside className="exam-sidebar">

                    {/* Timer */}
                    <div className="timer-block">
                        <div className="timer-ring">
                            <svg viewBox="0 0 50 50" width="50" height="50">
                                <circle className="timer-ring-bg" cx="25" cy="25" r="22" />
                                <circle className="timer-ring-fill" cx="25" cy="25" r="22"
                                    style={{ strokeDashoffset: ringCircumference - ringProgress, stroke: ringColor }} />
                            </svg>
                        </div>
                        <div className="timer-label">Time Remaining</div>
                        <div className={`timer-value ${timerClass}`}>{fmtTime(timeLeft)}</div>
                    </div>

                    {/* Mini score stats */}
                    <div className="score-mini">
                        <div className="sm-card"><div className="sm-num sm-green">{stats.ans}</div><div className="sm-label">Answered</div></div>
                        <div className="sm-card"><div className="sm-num sm-yellow">{stats.mrk}</div><div className="sm-label">Marked</div></div>
                        <div className="sm-card"><div className="sm-num sm-red">{stats.skp}</div><div className="sm-label">Skipped</div></div>
                        <div className="sm-card"><div className="sm-num sm-blue">{stats.rem}</div><div className="sm-label">Remaining</div></div>
                    </div>

                    {/* Question palette */}
                    <div className="palette-header">
                        <span>Question Palette</span>
                        <span style={{ color: 'var(--muted)' }}>{currentQ + 1}/{questions.length}</span>
                    </div>
                    <div className="palette-grid">
                        {questions.map((_, i) => (
                            <div key={i}
                                className={`pal-btn ${qState[i]?.status ?? 'unanswered'} ${i === currentQ ? 'current' : ''}`}
                                onClick={() => goTo(i)}>
                                {i + 1}
                            </div>
                        ))}
                    </div>

                    {/* Legend */}
                    <div className="palette-legend">
                        {[
                            { label: 'Answered', color: 'var(--green)'   },
                            { label: 'Marked',   color: 'var(--yellow)'  },
                            { label: 'Skipped',  color: 'var(--red)'     },
                            { label: 'Current',  color: 'var(--accent2)' },
                        ].map(l => (
                            <div key={l.label} className="legend-item">
                                <div className="legend-dot" style={{ background: l.color }} />
                                <span>{l.label}</span>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* ── Main Question Area ────────────────────────────────────── */}
                <main className="exam-main">

                    {/* Progress bar */}
                    <div className="progress-strip">
                        <span className="progress-text">Question {currentQ + 1} of {questions.length}</span>
                        <div className="progress-bar-wrap">
                            <div className="progress-bar-fill"
                                style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
                        </div>
                        <span className="progress-pct">{Math.round(((stats.ans + stats.mrk) / questions.length) * 100)}% done</span>
                    </div>

                    {/* Question card */}
                    <div className="q-card" key={currentQ}>
                        <div className="q-card-top">
                            <div className="q-meta-row">
                                <span className="q-num-badge">Q{currentQ + 1}</span>
                                {q?.topicName && <span className="q-tag q-tag-topic">{q.topicName}</span>}
                                {q?.difficulty && (
                                    <span className={`q-tag q-tag-${(q.difficulty ?? '').toLowerCase()}`}>
                                        {q.difficulty}
                                    </span>
                                )}
                                {q?.marks && <span className="q-tag q-tag-marks">{q.marks} Marks</span>}
                                {isMulti(qt) && <span className="q-tag" style={{ background: 'rgba(139,92,246,.1)', color: 'var(--purple)' }}>Multiple Correct</span>}
                                {isText(qt)  && <span className="q-tag" style={{ background: 'rgba(0,87,255,.1)', color: 'var(--accent2)' }}>Descriptive</span>}
                                {/* Save indicator */}
                                {savingId === q?.id && (
                                    <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>💾 saving…</span>
                                )}
                            </div>
                        </div>

                        <div className="q-text"
                            dangerouslySetInnerHTML={{ __html: qText(q) }} />

                        {renderQuestion()}
                    </div>

                    {/* Navigation bar */}
                    <div className="nav-bar">
                        <button className="btn btn-secondary" onClick={prevQ} disabled={currentQ === 0}>← Prev</button>
                        <button className={`btn btn-mark ${qs?.status === 'marked' ? 'active' : ''}`} onClick={markForReview}>
                            🔖 {qs?.status === 'marked' ? 'Unmark' : 'Mark'}
                        </button>
                        <button className="btn btn-skip" onClick={skipQ} disabled={currentQ === questions.length - 1}>⏭ Skip</button>
                        <div style={{ flex: 1 }} />
                        {currentQ < questions.length - 1 ? (
                            <button className="btn btn-primary" onClick={nextQ}>Next →</button>
                        ) : (
                            <button className="btn btn-primary" style={{ background: 'var(--green)', boxShadow: '0 3px 10px rgba(0,194,113,.3)' }}
                                onClick={() => setSubmitModal(true)}>
                                ✅ Finish Exam
                            </button>
                        )}
                    </div>
                </main>
            </div>

            {/* ── Submit Confirmation Modal ──────────────────────────────────── */}
            <div className={`modal-overlay ${submitModal ? 'open' : ''}`}>
                <div className="modal">
                    <div className="modal-header">
                        <div className="modal-title">Submit Exam?</div>
                        <button className="modal-close" onClick={() => setSubmitModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div className="submit-grid">
                            <div className="sg-item"><div className="sg-num sg-green">{stats.ans}</div><div className="sg-label">Answered</div></div>
                            <div className="sg-item"><div className="sg-num sg-yellow">{stats.mrk}</div><div className="sg-label">Marked</div></div>
                            <div className="sg-item"><div className="sg-num sg-red">{stats.skp}</div><div className="sg-label">Skipped</div></div>
                            <div className="sg-item"><div className="sg-num" style={{ color: 'var(--muted)' }}>{stats.rem}</div><div className="sg-label">Remaining</div></div>
                        </div>
                        {(stats.rem + stats.skp) > 0 && (
                            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--yellow)', marginTop: '12px', padding: '10px', background: 'rgba(245,166,35,.08)', borderRadius: '8px' }}>
                                ⚠ You have {stats.rem + stats.skp} unanswered question{stats.rem + stats.skp !== 1 ? 's' : ''}. You cannot go back after submitting.
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={() => setSubmitModal(false)}>Back to Exam</button>
                        <button className="btn btn-primary" style={{ background: 'var(--green)' }} onClick={finalSubmit}>
                            Submit Now
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Result Screen ─────────────────────────────────────────────── */}
            <div className={`result-screen ${resultOpen ? 'open' : ''}`}>
                <div className="result-card">
                    <div className="result-top">
                        <div className="result-badge">✓ Submitted</div>
                        <div className="result-score-big">
                            {result?.score ?? 0}
                            {result?.totalMarks && (
                                <span className="result-score-total"> / {result.totalMarks}</span>
                            )}
                        </div>
                        <div className="result-score-sub">
                            {result?.percentage != null ? `${result.percentage}%` : ''}
                        </div>
                        <div className="result-pass-badge">
                            {result?.passed ? '✅ PASSED' : '📋 COMPLETED'}
                        </div>
                    </div>
                    <div className="result-body">
                        {/* Score breakdown */}
                        <div className="result-stats">
                            <div className="rs-item">
                                <div className="rs-num rs-green">{result?.correct ?? stats.ans}</div>
                                <div className="rs-label">Correct</div>
                            </div>
                            <div className="rs-item">
                                <div className="rs-num rs-red">{result?.wrong ?? 0}</div>
                                <div className="rs-label">Wrong</div>
                            </div>
                            <div className="rs-item">
                                <div className="rs-num rs-yellow">{result?.unattempted ?? (stats.skp + stats.rem)}</div>
                                <div className="rs-label">Unattempted</div>
                            </div>
                            <div className="rs-item">
                                <div className="rs-num rs-blue">{questions.length}</div>
                                <div className="rs-label">Total Qs</div>
                            </div>
                        </div>

                        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
                            Your attempt has been submitted successfully.<br />
                            Results will be reviewed and shared within 24 hours.
                        </p>

                        <button className="ra-btn ra-primary" style={{ width: '100%' }}
                            onClick={() => window.close()}>
                            Close Exam Window
                        </button>
                    </div>
                </div>
            </div>

            {/* Toast */}
            <div className={`toast ${toast.show ? 'show' : ''}`}
                style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'success' ? '#0d1117' : '#1a2540' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'success' ? '✅' : 'ℹ️'}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default ExamScreen;
