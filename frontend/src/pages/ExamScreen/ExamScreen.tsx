import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './ExamScreen.css';
import { assessmentsApi, attemptsApi } from '../../services/api';

// ─── TYPES ───────────────────────────────────────────────

interface Option {
    id: string;
    text: string;
    isCorrect?: boolean;
}

interface Question {
    id: string;
    content: string;
    questionType: string; // "MCQ", "Multiple Choice", etc.
    marks: number;
    difficulty: string;
    topicName: string;
    options: Option[];
}

interface QuestionState {
    status: 'unanswered' | 'answered' | 'marked' | 'skipped';
    answer: string[] | string | null; // IDs of selected options or text answer
}

const ExamScreen: React.FC = () => {
    const { attemptId } = useParams<{ attemptId: string }>();
    const navigate = useNavigate();

    // ─── STATE ───────────────────────────────────────────────
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [flags, setFlags] = useState(0);
    const [tabWarning, setTabWarning] = useState(false);
    const [submitModalOpen, setSubmitModalOpen] = useState(false);
    const [resultScreenOpen, setResultScreenOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ show: false, msg: '', type: 'info' });

    const [state, setState] = useState<QuestionState[]>([]);

    const [finalResult, setFinalResult] = useState<any>(null);

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3200);
    };

    // ─── FETCH DATA ──────────────────────────────────────────
    useEffect(() => {
        const initExam = async () => {
            if (!attemptId) return;
            setLoading(true);
            try {
                const res = await assessmentsApi.getAttemptQuestions(attemptId);
                const qs: Question[] = res.data;
                setQuestions(qs);
                setState(qs.map(() => ({ status: 'unanswered', answer: null })));

                // For demo, set a fixed duration or fetch from attempt metadata if available
                setTimeLeft(30 * 60);
            } catch (err) {
                console.error(err);
                showToast('Failed to load exam questions.', 'error');
            } finally {
                setLoading(false);
            }
        };
        initExam();
    }, [attemptId]);

    // ─── TIMER & VISIBILITY ──────────────────────────────────
    useEffect(() => {
        if (loading || resultScreenOpen) return;

        const timerInt = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerInt);
                    return 0; // Trigger effect for auto-submit
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerInt);
    }, [loading, resultScreenOpen]);

    useEffect(() => {
        if (timeLeft === 0 && questions.length > 0 && !resultScreenOpen) {
            finalSubmit();
        }
    }, [timeLeft, questions, resultScreenOpen]);

    const handleVisibilityChange = useCallback(() => {
        if (document.hidden && !resultScreenOpen) {
            setFlags(prev => prev + 1);
            setTabWarning(true);
        }
    }, [resultScreenOpen]);

    useEffect(() => {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [handleVisibilityChange]);

    const dismissWarning = () => {
        setTabWarning(false);
        showToast(`Violation recorded. Total flags: ${flags}`, 'error');
    };

    // ─── QUESTION ACTIONS ────────────────────────────────────
    const selectOption = async (optId: string) => {
        setState(prev => {
            const newState = [...prev];
            newState[currentQ] = { ...newState[currentQ], answer: [optId], status: 'answered' };
            return newState;
        });

        // Auto-save to backend
        try {
            await assessmentsApi.saveAnswer({
                attemptQuestionId: questions[currentQ].id,
                answer: optId
            });
        } catch (err) {
            console.error('Failed to save answer', err);
        }
    };

    const toggleMulti = async (optId: string) => {
        let newAns: string[] = [];
        setState(prev => {
            const newState = [...prev];
            const currentAns = newState[currentQ].answer;
            let arr: string[] = Array.isArray(currentAns) ? [...currentAns] : [];

            const pos = arr.indexOf(optId);
            if (pos === -1) arr.push(optId); else arr.splice(pos, 1);

            newAns = arr;
            newState[currentQ] = {
                ...newState[currentQ],
                answer: arr.length ? arr : null,
                status: arr.length ? 'answered' : (newState[currentQ].status === 'marked' ? 'marked' : 'unanswered')
            };
            return newState;
        });

        // Auto-save to backend
        try {
            await assessmentsApi.saveAnswer({
                attemptQuestionId: questions[currentQ].id,
                answer: newAns.join(',')
            });
        } catch (err) {
            console.error('Failed to save answer', err);
        }
    };


    // ─── NAVIGATION ACTIONS ──────────────────────────────────
    const goTo = (idx: number) => setCurrentQ(idx);

    const prevQ = () => { if (currentQ > 0) setCurrentQ(currentQ - 1); };

    const nextQ = () => {
        if (currentQ < questions.length - 1) {
            if (state[currentQ].status === 'unanswered') {
                setState(prev => {
                    const newState = [...prev];
                    newState[currentQ].status = 'skipped';
                    return newState;
                });
            }
            setCurrentQ(currentQ + 1);
        }
    };

    const skipQ = () => {
        setState(prev => {
            const newState = [...prev];
            newState[currentQ].status = 'skipped';
            return newState;
        });
        if (currentQ < questions.length - 1) setCurrentQ(currentQ + 1);
    };

    const markForReview = () => {
        setState(prev => {
            const newState = [...prev];
            const cur = newState[currentQ];
            if (cur.status === 'marked') {
                cur.status = cur.answer && (typeof cur.answer === 'string' ? cur.answer.trim() !== '' : (Array.isArray(cur.answer) ? cur.answer.length > 0 : true)) ? 'answered' : 'unanswered';
            } else {
                cur.status = 'marked';
            }
            return newState;
        });
    };

    // ─── SUBMISSION ──────────────────────────────────────────
    const finalSubmit = async () => {
        if (!attemptId) return;
        setLoading(true);
        try {
            // First save any unsaved answers if necessary (though we save on interaction)
            // Just call submit
            const res = await attemptsApi.submitAttempt(attemptId);
            setFinalResult(res.data);
            showToast('Exam submitted successfully!', 'success');
            setResultScreenOpen(true);
        } catch (err) {
            console.error(err);
            showToast('Failed to submit exam.', 'error');
        } finally {
            setLoading(false);
            setSubmitModalOpen(false);
        }
    };

    // ─── STATS ───────────────────────────────────────────
    const stats = state.reduce(
        (acc, s) => {
            if (s.status === 'answered') acc.ans++;
            else if (s.status === 'marked') acc.mrk++;
            else if (s.status === 'skipped') acc.skp++;
            return acc;
        },
        { ans: 0, mrk: 0, skp: 0 }
    );
    const rem = questions.length - stats.ans - stats.mrk - stats.skp;

    // ─── RENDERERS ───────────────────────────────────────────
    const renderTimer = () => {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return (
            <div className="timer-block">
                <div className="timer-label">Time Remaining</div>
                <div className={`timer-value ${timeLeft <= 60 ? 'danger' : timeLeft <= 300 ? 'warning' : ''}`}>{timeStr}</div>
            </div>
        );
    };

    const renderQuestion = () => {
        if (questions.length === 0) return null;
        const q = questions[currentQ];
        const s = state[currentQ];
        const keys = ['A', 'B', 'C', 'D', 'E'];

        return (
            <div className="q-card">
                <div className="q-card-top">
                    <div className="q-meta-row">
                        <span className="q-num-badge">Q{currentQ + 1}</span>
                        <span className="q-tag q-tag-topic">{q.topicName}</span>
                        <span className="q-tag q-tag-medium">{q.difficulty}</span>
                        <span className="q-tag q-tag-marks">{q.marks} Marks</span>
                    </div>
                </div>
                <div className="q-text" dangerouslySetInnerHTML={{ __html: q.content }}></div>

                <div className="options-list">
                    {q.options.map((opt, i) => {
                        const isMCQ = q.questionType.toLowerCase().includes('mcq') || q.questionType.toLowerCase() === 'single';
                        const isSelected = Array.isArray(s.answer) && s.answer.includes(opt.id);

                        return (
                            <div
                                key={opt.id}
                                className={`option ${isSelected ? 'selected' : ''}`}
                                onClick={() => isMCQ ? selectOption(opt.id) : toggleMulti(opt.id)}
                            >
                                <div className="option-key">{keys[i] || i + 1}</div>
                                <span dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (loading && !questions.length) return <div className="loading-screen">Loading Exam...</div>;

    return (
        <div className="exam-screen-wrap">
            {/* Warning Overlay */}
            <div className={`tab-warning ${tabWarning ? 'show' : ''}`}>
                <div className="tw-icon">⚠️</div>
                <div className="tw-title">Violation Detected!</div>
                <div className="tw-sub">Warning: Tab switching is strictly prohibited. Violation recorded.</div>
                <button className="tw-btn" onClick={dismissWarning}>Continue Exam</button>
            </div>

            <div className="topbar">
                <div className="tb-left">
                    <div className="tb-logo">Test<span>Buddy</span></div>
                    <div className="tb-exam-name">Ongoing Assessment</div>
                </div>
                <div className="tb-right">
                    <div className="flag-counter">🚩 {flags} violations</div>
                    <div className="proctor-badge"><div className="proctor-dot"></div> Live Proctored</div>
                </div>
            </div>

            <div className="exam-body">
                <aside className="exam-sidebar">
                    {renderTimer()}
                    <div className="palette-header">Question Palette</div>
                    <div className="palette-grid">
                        {questions.map((_, i) => (
                            <div key={i} className={`pal-btn ${state[i].status} ${i === currentQ ? 'current' : ''}`} onClick={() => goTo(i)}>
                                {i + 1}
                            </div>
                        ))}
                    </div>
                    <div className="palette-legend">
                        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--green)' }}></div><span>Answered</span></div>
                        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--yellow)' }}></div><span>Marked</span></div>
                        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--red)' }}></div><span>Skipped</span></div>
                    </div>
                </aside>

                <main className="exam-main">
                    {renderQuestion()}
                    <div className="nav-bar">
                        <button className="btn btn-secondary" onClick={prevQ} disabled={currentQ === 0}>← Previous</button>
                        <button className="btn btn-mark" onClick={markForReview}>🔖 Mark</button>
                        <button className="btn btn-skip" onClick={skipQ}>⏭ Skip</button>
                        <button className="btn btn-primary" onClick={currentQ === questions.length - 1 ? () => setSubmitModalOpen(true) : nextQ}>
                            {currentQ === questions.length - 1 ? '✅ Submit' : 'Next →'}
                        </button>
                    </div>
                </main>
            </div>

            {/* Submit Modal */}
            <div className={`modal-overlay ${submitModalOpen ? 'open' : ''}`}>
                <div className="modal">
                    <div className="modal-header">
                        <div className="modal-title">Finish Exam?</div>
                    </div>
                    <div className="modal-body">
                        <div className="submit-grid">
                            <div className="sg-item"><div className="sg-num sg-green">{stats.ans}</div><div className="sg-label">Answered</div></div>
                            <div className="sg-item"><div className="sg-num sg-yellow">{stats.mrk}</div><div className="sg-label">Marked</div></div>
                            <div className="sg-item"><div className="sg-num sg-red">{rem + stats.skp}</div><div className="sg-label">Remaining</div></div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={() => setSubmitModalOpen(false)}>Back</button>
                        <button className="btn btn-primary" onClick={finalSubmit}>Submit Exam</button>
                    </div>
                </div>
            </div>

            {/* Result Screen Overaly */}
            <div className={`result-screen ${resultScreenOpen ? 'open' : ''}`}>
                <div className="result-card">
                    <div className="result-top">
                        <div className="result-badge">✓ Submitted</div>
                        <div className="result-score-big">{finalResult?.score || 0}</div>
                        <div className="result-pass-badge">{finalResult?.passed ? 'PASSED' : 'COMPLETED'}</div>
                    </div>
                    <div className="result-body">
                        <p style={{ textAlign: 'center', marginBottom: '30px' }}>Your attempt has been submitted successfully. Your score is {finalResult?.score}.</p>
                        <button className="ra-btn ra-primary" onClick={() => navigate('/login')} style={{ width: '100%' }}>Back to Home</button>
                    </div>
                </div>
            </div>

            <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default ExamScreen;
