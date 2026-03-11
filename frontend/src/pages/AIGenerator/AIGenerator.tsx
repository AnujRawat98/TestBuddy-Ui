import React, { useState, useEffect } from 'react';
import { topicsApi, aiQuestionsApi, questionsApi } from '../../services/api';
import './AIGenerator.css';

interface AIOption {
    text: string;
    correct: boolean;
}

interface AIQuestion {
    id: number;
    text: string;
    type: 'MCQ' | 'Multi-Select' | 'Text' | 'True/False';
    level: 'Easy' | 'Medium' | 'Hard';
    topic: string;
    bloom: string;
    options?: AIOption[];
    textAnswer?: string;
    saved: boolean;
}

const BANK: Omit<AIQuestion, 'id' | 'saved'>[] = [
    {
        text: 'What is the difference between `==` and `===` in JavaScript?',
        level: 'Medium', type: 'MCQ', topic: 'JavaScript', bloom: 'Understand',
        options: [
            { text: '== checks value only; === checks value and type', correct: true },
            { text: 'Both behave identically', correct: false },
            { text: '=== only works with numbers', correct: false },
            { text: '== is stricter than ===', correct: false }
        ],
    },
    {
        text: 'Which method adds an element to the **end** of an array?',
        level: 'Easy', type: 'MCQ', topic: 'JavaScript', bloom: 'Remember',
        options: [
            { text: 'array.append()', correct: false },
            { text: 'array.push()', correct: true },
            { text: 'array.insert()', correct: false },
            { text: 'array.add()', correct: false }
        ],
    },
    {
        text: 'Which of the following best describes a **closure** in JavaScript?',
        level: 'Medium', type: 'MCQ', topic: 'JavaScript', bloom: 'Understand',
        options: [
            { text: 'A function that runs automatically when defined', correct: false },
            { text: 'A function that retains access to its outer scope after the outer function returns', correct: true },
            { text: 'A method used only for async operations', correct: false },
            { text: 'A way to declare private variables using the `private` keyword', correct: false }
        ],
    },
    {
        text: 'Explain how `async/await` differs from chaining `.then()`. What problem does it solve?',
        level: 'Hard', type: 'Text', topic: 'JavaScript', bloom: 'Analyze',
        textAnswer: 'async/await is syntactic sugar over Promises that lets you write asynchronous code in a synchronous style. It eliminates "promise chaining hell" making async flows easier to read and reason about. Under the hood async functions still return Promises.',
    }
];

// Mock UUIDs for Level and Type since they aren't in Swagger paths
const MOCK_LEVELS: Record<string, string> = {
    'Easy': 'e1111111-1111-1111-1111-111111111111',
    'Medium': 'e2222222-2222-2222-2222-222222222222',
    'Hard': 'e3333333-3333-3333-3333-333333333333',
    'Mixed': 'e4444444-4444-4444-4444-444444444444'
};

const MOCK_TYPES: Record<string, string> = {
    'MCQ': 't1111111-1111-1111-1111-111111111111',
    'Multi-Select': 't2222222-2222-2222-2222-222222222222',
    'Text': 't3333333-3333-3333-3333-333333333333',
    'True/False': 't4444444-4444-4444-4444-444444444444'
};

const topicBadgeMap: Record<string, string> = {
    JavaScript: 'badge-js', HTML: 'badge-html', CSS: 'badge-css',
    DBMS: 'badge-dbms', 'C#': 'badge-csharp', React: 'badge-react', Python: 'badge-js'
};

const AIGenerator: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [difficulty, setDifficulty] = useState('Medium');
    const [type, setType] = useState('MCQ');
    const [count, setCount] = useState(5);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [realTopics, setRealTopics] = useState<any[]>([]);
    const [isSavingAll, setIsSavingAll] = useState(false);

    // States
    const [viewState, setViewState] = useState<'empty' | 'loading' | 'results'>('empty');
    const [progress, setProgress] = useState(0);

    // Data
    const [questions, setQuestions] = useState<AIQuestion[]>([]);
    const [bankTotal, setBankTotal] = useState(68);
    const [savedCount, setSavedCount] = useState(0);
    const [discardedCount, setDiscardedCount] = useState(0);

    const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

    const fetchTopics = async () => {
        try {
            const res = await topicsApi.getAll();
            setRealTopics(res.data);
            if (res.data.length > 0) setTopic(res.data[0].id);
        } catch (err) {
            showToast('Failed to load topics', 'error');
        }
    };

    useEffect(() => {
        fetchTopics();
    }, []);

    const showToast = (msg: string, tType: 'success' | 'info' | 'error' = 'success') => {
        setToast({ show: true, msg, type: tType });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const handleGenerate = async () => {
        if (!topic) {
            showToast('Please select a topic', 'error');
            return;
        }

        setViewState('loading');
        setProgress(10);

        try {
            const res = await aiQuestionsApi.generate({
                topicId: topic,
                difficulty: MOCK_LEVELS[difficulty] || MOCK_LEVELS['Medium'],
                type: MOCK_TYPES[type] || MOCK_TYPES['MCQ'],
                count,
                additionalPrompt: '' // Could wire advanced options here
            });
            setProgress(100);
            setTimeout(() => {
                const mapped: AIQuestion[] = res.data.map((q: any, i: number) => ({
                    id: Date.now() + i,
                    text: q.questionText,
                    type: type as any,
                    level: difficulty as any,
                    topic: realTopics.find(t => t.id === topic)?.name || 'AI Topic',
                    bloom: 'Apply',
                    options: q.options?.map((o: any) => ({ text: o.text, correct: o.isCorrect })),
                    textAnswer: q.textAnswer,
                    saved: false
                }));
                setQuestions(mapped);
                setViewState('results');
                showToast(`${mapped.length} questions generated!`);
                setProgress(0);
            }, 300);
        } catch (err) {
            setViewState('empty');
            showToast('AI Generation failed', 'error');
        }
    };

    const saveOne = (id: number) => {
        setQuestions(prev => prev.map(q => {
            if (q.id === id && !q.saved) {
                setSavedCount(s => s + 1);
                setBankTotal(t => t + 1);
                return { ...q, saved: true };
            }
            return q;
        }));
        showToast('Question saved to bank!');
    };

    const saveAll = async () => {
        const unsaved = questions.filter(q => !q.saved);
        if (unsaved.length === 0) {
            showToast('All questions already saved.', 'info');
            return;
        }

        setIsSavingAll(true);
        try {
            const payload = {
                isSaveAsDraft: false,
                questions: unsaved.map(q => ({
                    questionText: q.text,
                    topicId: topic,
                    levelId: MOCK_LEVELS[q.level] || MOCK_LEVELS['Medium'],
                    questionTypeId: MOCK_TYPES[q.type] || MOCK_TYPES['MCQ'],
                    options: q.options?.map(o => ({ text: o.text, isCorrect: o.correct, imageUrl: '' })) || [],
                    textAnswer: q.textAnswer || ''
                }))
            };

            await questionsApi.createMultiple(payload);
            setQuestions(prev => prev.map(q => ({ ...q, saved: true })));
            setSavedCount(s => s + unsaved.length);
            setBankTotal(t => t + unsaved.length);
            showToast(`${unsaved.length} questions saved to bank!`);
        } catch (err) {
            showToast('Failed to save questions', 'error');
        } finally {
            setIsSavingAll(false);
        }
    };

    const discardOne = (id: number) => {
        const newQs = questions.filter(q => q.id !== id);
        setQuestions(newQs);
        setDiscardedCount(d => d + 1);
        if (newQs.length === 0) {
            setViewState('empty');
        }
    };

    const regenOne = (id: number) => {
        setQuestions(prev => prev.map((q, idx) => {
            if (q.id === id) {
                const next = BANK[(idx + 2) % BANK.length];
                return { ...next, id: Date.now() + Math.random(), saved: false, topic } as AIQuestion;
            }
            return q;
        }));
        showToast('Question regenerated.', 'info');
    };

    // Derived Stats
    const easy = questions.filter(q => q.level === 'Easy').length;
    const medium = questions.filter(q => q.level === 'Medium').length;
    const hard = questions.filter(q => q.level === 'Hard').length;
    const totalGen = questions.length || 1;

    const easyPct = (easy / totalGen) * 100;
    const medPct = (medium / totalGen) * 100;
    const hardPct = (hard / totalGen) * 100;

    return (
        <div className="ai-generator-container">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <div className="page-title">AI Question Generator</div>
                    <div className="page-sub">Generate high-quality questions instantly using AI. Save them directly to your bank.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => showToast('Viewing question bank…', 'info')}>← Question Bank</button>
                    {viewState === 'results' && (
                        <button className="btn btn-primary btn-sm" onClick={saveAll}>💾 Save All to Bank</button>
                    )}
                </div>
            </div>

            {/* ─── AI GENERATOR BANNER ─────────────────────────── */}
            <div className="ai-banner">
                <div className="ai-banner-top">
                    <div className="ai-banner-left">
                        <div className="ai-pill"><div className="ai-pulse"></div> Powered by AI</div>
                        <div className="ai-banner-title">🤖 Generate Questions with AI</div>
                        <div className="ai-banner-sub">Configure topic, difficulty, type and count below — then let AI create curriculum-aligned questions for your question bank in seconds.</div>
                    </div>
                    <div className="ai-banner-stats">
                        <div className="ai-bstat">
                            <div className="ai-bstat-num">2,480</div>
                            <div className="ai-bstat-label">Questions Generated</div>
                        </div>
                        <div className="ai-bstat">
                            <div className="ai-bstat-num">94%</div>
                            <div className="ai-bstat-label">Accuracy Rate</div>
                        </div>
                    </div>
                </div>

                {/* FORM */}
                <div className="ai-form">
                    <div className="ai-form-row">
                        <div className="ai-field">
                            <div className="ai-label">Topic</div>
                            <select className="ai-input" value={topic} onChange={e => setTopic(e.target.value)}>
                                <option value="">Select Topic…</option>
                                {realTopics.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="ai-field">
                            <div className="ai-label">Difficulty</div>
                            <select className="ai-input" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                                {['Easy', 'Medium', 'Hard', 'Mixed'].map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                        <div className="ai-field">
                            <div className="ai-label">Question Type</div>
                            <select className="ai-input" value={type} onChange={e => setType(e.target.value)}>
                                {['MCQ', 'Multi-Select', 'Text', 'True/False'].map(t => (
                                    <option key={t} value={t}>{t === 'Text' ? 'Text (Short Answer)' : t}</option>
                                ))}
                            </select>
                        </div>
                        <div className="ai-field">
                            <div className="ai-label">Count</div>
                            <input className="ai-input" type="number" value={count} min={1} max={20} onChange={e => setCount(parseInt(e.target.value) || 1)} />
                        </div>
                        <div className="ai-field">
                            <button className="btn-generate" onClick={handleGenerate} disabled={viewState === 'loading'}>
                                <span>{viewState === 'loading' ? 'Generating…' : 'Generate ✨'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="ai-adv-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}>
                        <span>{advancedOpen ? '▾' : '▸'}</span> Advanced options
                    </div>
                    <div className={`adv-panel ${advancedOpen ? 'open' : ''}`}>
                        <div className="ai-field">
                            <div className="ai-label">Sub-Topic / Focus</div>
                            <input className="ai-input" placeholder="e.g. Closures, Promises…" />
                        </div>
                        <div className="ai-field">
                            <div className="ai-label">Language / Framework</div>
                            <select className="ai-input">
                                <option>Any</option><option>ES6+</option><option>TypeScript</option><option>Node.js</option>
                            </select>
                        </div>
                        <div className="ai-field">
                            <div className="ai-label">Bloom's Level</div>
                            <select className="ai-input">
                                <option>Any</option><option>Remember</option><option>Understand</option><option>Apply</option><option>Analyze</option>
                            </select>
                        </div>
                        <div className="ai-field">
                            <div className="ai-label">Avoid Duplicates</div>
                            <select className="ai-input">
                                <option>Yes – check bank</option><option>No</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── MAIN LAYOUT ────────────────────────────────── */}
            <div className="layout-main">
                {/* ── LEFT: RESULTS CARD ── */}
                <div className="results-card">
                    <div className="card-header">
                        <div className="card-title">
                            🧾 Generated Questions
                            <span className="result-count">{questions.length} questions</span>
                        </div>
                        {viewState === 'results' && (
                            <div className="card-header-actions">
                                <button className="btn btn-secondary btn-sm" onClick={handleGenerate}>↻ Regenerate</button>
                                <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={isSavingAll}>{isSavingAll ? 'Saving...' : '💾 Save All'}</button>
                            </div>
                        )}
                    </div>

                    {viewState === 'empty' && (
                        <div className="empty-state-wrap">
                            <div className="empty-icon">🧠</div>
                            <div className="empty-title">Ready to Generate</div>
                            <div className="empty-sub">Pick a topic, set difficulty and count above, then hit <strong>Generate</strong> to create questions with AI instantly.</div>
                            <button className="btn btn-primary" onClick={handleGenerate}>Generate Questions ✨</button>
                        </div>
                    )}

                    {viewState === 'loading' && (
                        <div>
                            <div className="loading-header">
                                <div className="loading-label">
                                    <div className="spinner"></div>
                                    <span>Generating questions… <strong>{Math.floor((progress / 100) * count)} / {count}</strong></span>
                                </div>
                                <div className="progress-track">
                                    <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                            <div className="skeleton-list">
                                {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                                    <div key={i} className="skel-card">
                                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                            <div className="skel" style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0 }}></div>
                                            <div style={{ flex: 1 }}>
                                                <div className="skel skel-line skel-sm" style={{ marginBottom: '8px' }}></div>
                                                <div className="skel skel-line skel-lg"></div>
                                                <div className="skel skel-line skel-md"></div>
                                            </div>
                                        </div>
                                        <div className="skel-opts">
                                            <div className="skel skel-opt"></div><div className="skel skel-opt"></div>
                                            <div className="skel skel-opt"></div><div className="skel skel-opt"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {viewState === 'results' && (
                        <div>
                            <div className="q-list">
                                {questions.map((q, i) => {
                                    const tBadge = topicBadgeMap[topic] || 'badge-js';
                                    const lBadge = q.level === 'Easy' ? 'badge-easy' : q.level === 'Medium' ? 'badge-medium' : 'badge-hard';
                                    const tyBadge = q.type === 'MCQ' ? 'badge-mcq' : q.type === 'Multi-Select' ? 'badge-multi' : 'badge-text';

                                    return (
                                        <div key={q.id} className={`q-card ${q.saved ? 'saved-card' : ''}`}>
                                            <div className="q-card-top">
                                                <div className="q-num-badge">{i + 1}</div>
                                                <div className="q-card-body">
                                                    <div className="q-badges">
                                                        <span className={`badge ${tBadge}`}><span className="bdot"></span>{topic}</span>
                                                        <span className={`badge ${lBadge}`}><span className="bdot"></span>{q.level}</span>
                                                        <span className={`badge ${tyBadge}`}>{q.type}</span>
                                                        <span className="badge" style={{ background: 'rgba(139,92,246,.1)', color: '#6d28d9', fontSize: '11px' }}>🧠 {q.bloom || 'Understand'}</span>
                                                        {q.saved && <span className="badge badge-ai">⭐ Saved</span>}
                                                    </div>
                                                    <div className="q-card-text" dangerouslySetInnerHTML={{ __html: q.text }}></div>

                                                    {q.type !== 'Text' ? (
                                                        <div className="q-options">
                                                            {q.options?.map((o, idx) => (
                                                                <div key={idx} className={`q-option ${o.correct ? 'correct' : ''}`}>
                                                                    <div className="q-radio"></div>
                                                                    <span>{o.text}</span>
                                                                    {o.correct && <span className="correct-tag">✓ Correct</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-answer-box">
                                                            <div className="ta-label">Model Answer</div>
                                                            <div className="ta-text">{q.textAnswer}</div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="q-card-actions">
                                                    <div className="act-btn regen" title="Regenerate this question" onClick={() => regenOne(q.id)}>↻</div>
                                                    <div className="act-btn del" title="Discard" onClick={() => discardOne(q.id)}>✕</div>
                                                </div>
                                            </div>
                                            <div className="q-card-footer">
                                                <div className="q-meta">
                                                    <span>🗂 {topic}</span>
                                                    <span>⭐ 1 mark</span>
                                                    <span>⏱ ~1 min</span>
                                                </div>
                                                <button className={`save-btn ${q.saved ? 'is-saved' : ''}`} onClick={() => saveOne(q.id)} disabled={q.saved}>
                                                    {q.saved ? '⭐ Saved to Bank' : '+ Save to Bank'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="results-footer">
                                <div className="footer-info">{questions.length} questions generated</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={handleGenerate}>↻ Regenerate</button>
                                    <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={isSavingAll}>{isSavingAll ? 'Saving...' : '💾 Save All to Bank'}</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── RIGHT PANEL ── */}
                <div className="right-panel">
                    {/* Generation Stats */}
                    <div className="info-panel">
                        <div className="info-panel-header">
                            <div className="info-panel-title">📊 This Session</div>
                        </div>
                        <div className="info-panel-body">
                            <div className="quick-stats">
                                <div className="qs-item"><div className="qs-num" style={{ color: 'var(--accent)' }}>{questions.length}</div><div className="qs-label">Generated</div></div>
                                <div className="qs-item"><div className="qs-num" style={{ color: 'var(--green)' }}>{savedCount}</div><div className="qs-label">Saved</div></div>
                                <div className="qs-item"><div className="qs-num" style={{ color: 'var(--red)' }}>{discardedCount}</div><div className="qs-label">Discarded</div></div>
                                <div className="qs-item"><div className="qs-num" style={{ color: 'var(--accent2)' }}>{bankTotal}</div><div className="qs-label">Bank Total</div></div>
                            </div>
                        </div>
                    </div>

                    {/* Difficulty mix */}
                    <div className="info-panel">
                        <div className="info-panel-header"><div className="info-panel-title">📈 Difficulty Mix</div></div>
                        <div className="info-panel-body">
                            <div className="type-bar-row">
                                <div className="type-label-row"><span className="type-name">Easy</span><span className="type-val" style={{ color: 'var(--green)' }}>{easy}</span></div>
                                <div className="type-bar"><div className="type-fill" style={{ width: `${easyPct}%`, background: 'var(--green)' }}></div></div>
                            </div>
                            <div className="type-bar-row">
                                <div className="type-label-row"><span className="type-name">Medium</span><span className="type-val" style={{ color: 'var(--yellow)' }}>{medium}</span></div>
                                <div className="type-bar"><div className="type-fill" style={{ width: `${medPct}%`, background: 'var(--yellow)' }}></div></div>
                            </div>
                            <div className="type-bar-row">
                                <div className="type-label-row"><span className="type-name">Hard</span><span className="type-val" style={{ color: 'var(--red)' }}>{hard}</span></div>
                                <div className="type-bar"><div className="type-fill" style={{ width: `${hardPct}%`, background: 'var(--red)' }}></div></div>
                            </div>
                        </div>
                    </div>

                    {/* Recent history */}
                    <div className="info-panel">
                        <div className="info-panel-header"><div className="info-panel-title">🕓 Recent Sessions</div></div>
                        <div className="history-list">
                            <div className="history-item" onClick={() => showToast('Restoring session…', 'info')}>
                                <div className="h-icon">🤖</div>
                                <div className="h-info">
                                    <div className="h-title">JavaScript · Medium · MCQ</div>
                                    <div className="h-sub">5 questions · Saved 4 · 2 hrs ago</div>
                                </div>
                                <div className="h-restore">Restore</div>
                            </div>
                            <div className="history-item" onClick={() => showToast('Restoring session…', 'info')}>
                                <div className="h-icon">🤖</div>
                                <div className="h-info">
                                    <div className="h-title">HTML · Easy · MCQ</div>
                                    <div className="h-sub">10 questions · Saved 10 · Yesterday</div>
                                </div>
                                <div className="h-restore">Restore</div>
                            </div>
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="info-panel">
                        <div className="info-panel-header"><div className="info-panel-title">💡 Pro Tips</div></div>
                        <div className="info-panel-body">
                            <div className="tip-list">
                                <div className="tip-item"><div className="tip-icon">🎯</div><span>Use <strong>Advanced options</strong> to focus on a specific sub-topic like "Promises".</span></div>
                                <div className="tip-item"><div className="tip-icon">🔁</div><span>Regenerate individual questions you're not satisfied with using the ↻ button.</span></div>
                                <div className="tip-item"><div className="tip-icon">⭐</div><span>Save questions you like before regenerating — unsaved ones are lost on next generation.</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : '#0d1117' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default AIGenerator;
