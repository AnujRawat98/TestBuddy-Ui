import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { topicsApi, questionsApi } from '../../services/api';
import './AddQuestions.css';

// Types
type QuestionType = 'MCQ' | 'Multi-Select' | 'Text' | 'Image' | '';
type DifficultyStatus = 'Easy' | 'Medium' | 'Hard' | '';

interface ImageOption {
    src: string;
    label: string;
}

interface Question {
    id: number;
    type: QuestionType;
    text: string;
    topic: string;       // holds topicId UUID
    level: DifficultyStatus;
    status: 'Active' | 'Draft';
    options: string[];
    correct: number | number[];
    textAnswer: string;
    images: ImageOption[];
}

const LEVELS = ['Easy', 'Medium', 'Hard'];

// Real database IDs for Level
const MOCK_LEVELS: Record<string, string> = {
    'Easy':   '11111111-1111-1111-1111-111111111111',
    'Medium': '22222222-2222-2222-2222-222222222222',
    'Hard':   '33333333-3333-3333-3333-333333333333',
};

// Real database IDs for QuestionType
const MOCK_TYPES: Record<string, string> = {
    'MCQ':          'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    'Multi-Select': 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    'Text':         'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    'Image':        'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
};

const AddQuestions: React.FC = () => {
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [qCounter, setQCounter] = useState(0);
    const [collapsedCards, setCollapsedCards] = useState<Record<number, boolean>>({});
    const [realTopics, setRealTopics] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
    const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

    // Sidebar AI Panel State
    const [aiTopic, setAiTopic] = useState('');
    const [aiLevel, setAiLevel] = useState('');
    const [aiType, setAiType] = useState('');
    const [aiCount, setAiCount] = useState(3);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiResults, setAiResults] = useState<any[]>([]);

    // Full-tab AI Panel State (separate)
    const [ai2Topic, setAi2Topic] = useState('');
    const [ai2Level, setAi2Level] = useState('');
    const [ai2Type, setAi2Type] = useState('');
    const [ai2Count, setAi2Count] = useState(3);
    const [isGenerating2, setIsGenerating2] = useState(false);
    const [ai2Results, setAi2Results] = useState<any[]>([]);
    const [ai2Prompt, setAi2Prompt] = useState('');

    const fetchTopics = async () => {
        try {
            const res = await topicsApi.getAll();
            setRealTopics(res.data);
        } catch {
            showToast('Failed to load topics', 'error');
        }
    };

    useEffect(() => {
        fetchTopics();
        handleAddQuestion();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const handleAddQuestion = (prefill?: Partial<Question>) => {
        const newId = qCounter + 1;
        setQCounter(newId);
        const newQ: Question = {
            id: newId, type: '', text: '', topic: '', level: '',
            status: 'Active', options: [], correct: 0, textAnswer: '', images: [],
            ...prefill,
        };
        setQuestions(prev => [...prev, newQ]);
    };

    const removeQuestion = (id: number) => {
        if (questions.length === 1) { showToast('At least one question is required.', 'error'); return; }
        setQuestions(prev => prev.filter(q => q.id !== id));
    };

    const updateQuestion = (id: number, updates: Partial<Question>) => {
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const handleTypeSelect = (id: number, type: QuestionType) => {
        setQuestions(prev => prev.map(q => {
            if (q.id !== id) return q;
            const next = { ...q, type };
            if (type === 'MCQ' || type === 'Multi-Select') {
                if (!next.options.length) {
                    next.options = ['', '', '', ''];
                    next.correct = type === 'Multi-Select' ? [] : 0;
                } else {
                    if (type === 'MCQ' && Array.isArray(next.correct)) next.correct = next.correct[0] ?? 0;
                    else if (type === 'Multi-Select' && typeof next.correct === 'number') next.correct = [next.correct];
                }
            }
            return next;
        }));
    };

    const toggleCollapse = (id: number) => setCollapsedCards(prev => ({ ...prev, [id]: !prev[id] }));

    const OptionBuilder = ({ q }: { q: Question }) => {
        const isMulti = q.type === 'Multi-Select';
        const updateOpt = (idx: number, val: string) => {
            const o = [...q.options]; o[idx] = val; updateQuestion(q.id, { options: o });
        };
        const toggleOpt = (idx: number) => {
            if (isMulti) {
                let c = (q.correct as number[]) || [];
                c = c.includes(idx) ? c.filter(x => x !== idx) : [...c, idx];
                updateQuestion(q.id, { correct: c });
            } else updateQuestion(q.id, { correct: idx });
        };
        const addOpt = () => {
            if (q.options.length >= 8) { showToast('Max 8 options.', 'error'); return; }
            updateQuestion(q.id, { options: [...q.options, ''] });
        };
        const remOpt = (idx: number) => {
            if (q.options.length <= 2) { showToast('Min 2 options.', 'error'); return; }
            const o = q.options.filter((_, i) => i !== idx);
            let c = q.correct;
            if (isMulti) c = (q.correct as number[]).filter(x => x !== idx).map(x => x > idx ? x - 1 : x);
            else { if (q.correct === idx) c = 0; else if ((q.correct as number) > idx) c = (q.correct as number) - 1; }
            updateQuestion(q.id, { options: o, correct: c });
        };
        return (
            <>
                <div className="section-divider">
                    <div className="section-divider-line"></div>
                    <div className="section-divider-text">{isMulti ? 'Answer Options (select all correct)' : 'Answer Options (select one correct)'}</div>
                    <div className="section-divider-line"></div>
                </div>
                <div className="options-builder">
                    {q.options.map((opt, i) => {
                        const ok = isMulti ? (q.correct as number[]).includes(i) : q.correct === i;
                        return (
                            <div key={i} className={`option-row ${ok ? 'is-correct' : ''}`}>
                                <div className="correct-toggle" onClick={() => toggleOpt(i)}><div className="correct-toggle-inner"></div></div>
                                <input className="opt-input" value={opt} onChange={e => updateOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                                {ok && <span className="opt-correct-label">✓ Correct</span>}
                                <button className="opt-del" onClick={() => remOpt(i)}>✕</button>
                            </div>
                        );
                    })}
                </div>
                <button className="add-option-btn" onClick={addOpt}>+ Add Option</button>
            </>
        );
    };

    // Shared AI generation logic
    const runGenerate = (topic: string, level: string, count: number, setResults: (r: any[]) => void, setGenerating: (b: boolean) => void) => {
        if (!topic) { showToast('Please select a topic.', 'error'); return; }
        setGenerating(true);
        setTimeout(() => {
            const topicName = realTopics.find(t => t.topicId === topic || t.id === topic)?.name || 'Topic';
            const templates = [
                { text: `What is a key concept in ${topicName}?`, type: 'MCQ' as any, options: ['Concept A', 'Concept B', 'Concept C', 'Concept D'], correct: 1 },
                { text: `Which of the following are features of ${topicName}?`, type: 'Multi-Select' as any, options: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4'], correct: [0, 1] },
                { text: `What does the main function do in ${topicName}?`, type: 'MCQ' as any, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 2 },
                { text: `Explain the purpose of ${topicName}.`, type: 'Text' as any, options: [], correct: 0, textAnswer: 'Model answer.' },
                { text: `Which statement about ${topicName} is correct?`, type: 'MCQ' as any, options: ['A', 'B', 'C', 'D'], correct: 0 },
            ];
            setResults(templates.slice(0, count).map((t, i) => ({
                ...t, topic, level: level || ['Easy', 'Medium', 'Hard'][i % 3], status: 'Active', id: Date.now() + i,
            })));
            setGenerating(false);
        }, 1500);
    };

    const handleGenerateAI = () => runGenerate(aiTopic, aiLevel, aiCount, setAiResults, setIsGenerating);
    const handleGenerateAI2 = () => runGenerate(ai2Topic, ai2Level, ai2Count, setAi2Results, setIsGenerating2);

    const importQuestion = (q: any, idx: number, key?: string) => {
        const k = key || `${q.id}-${idx}`;
        if (importedIds.has(k)) { showToast('Already added.', 'info'); return; }
        setImportedIds(prev => new Set(prev).add(k));
        handleAddQuestion({ ...q });
        setActiveTab('manual');
        showToast('Question added to builder!');
    };

    const saveAll = async (isDraft = false) => {
        for (const [idx, q] of questions.entries()) {
            if (!isDraft) {
                if (!q.type || !q.topic || !q.level || !q.text.trim()) {
                    showToast(`Q${idx + 1}: Fill all required fields.`, 'error'); return;
                }
                if ((q.type === 'MCQ' || q.type === 'Multi-Select') && q.options.length < 2) {
                    showToast(`Q${idx + 1}: Add at least 2 options.`, 'error'); return;
                }
            }
        }
        setIsSaving(true);
        try {
            const payload = {
                isSaveAsDraft: isDraft,
                questions: questions.map(q => ({
                    questionText: q.text,
                    topicId: q.topic || '00000000-0000-0000-0000-000000000000',
                    levelId: MOCK_LEVELS[q.level] || MOCK_LEVELS['Easy'],
                    questionTypeId: MOCK_TYPES[q.type] || MOCK_TYPES['MCQ'],
                    options: (q.type === 'MCQ' || q.type === 'Multi-Select') ? q.options.map((opt, i) => ({
                        text: opt,
                        isCorrect: Array.isArray(q.correct) ? q.correct.includes(i) : q.correct === i,
                        imageUrl: '',
                    })) : [],
                    textAnswer: q.textAnswer || '',
                })),
            };
            await questionsApi.createMultiple(payload);
            showToast(`✅ ${questions.length} question(s) saved!`);
            setTimeout(() => navigate('/topics'), 1500);
        } catch {
            showToast('Failed to save questions', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Re-usable AI result list
    const AiResultList = ({ results, generating, keyPrefix }: { results: any[], generating: boolean, keyPrefix: string }) => (
        <>
            {generating && (
                <div className="ai-loading visible" style={{ marginTop: '14px' }}>
                    <div className="ai-loading-bar"><div className="ai-loading-fill"></div></div>
                    <div className="ai-loading-text">Generating questions with AI…</div>
                </div>
            )}
            {results.length > 0 && !generating && (
                <div className="ai-results" style={{ marginTop: '12px' }}>
                    {results.map((q, i) => {
                        const key = `${keyPrefix}-${q.id}-${i}`;
                        const done = importedIds.has(key);
                        return (
                            <div key={i} className={`ai-result-card ${done ? 'imported' : ''}`} onClick={() => importQuestion(q, i, key)}>
                                <div className="ai-result-q">{q.text}</div>
                                <div className="ai-result-meta">
                                    <span className="ai-result-badge" style={{ background: 'rgba(0,87,255,.25)', color: '#93c5fd' }}>{q.type}</span>
                                    <span className="ai-result-badge" style={{ background: 'rgba(0,194,113,.2)', color: '#6ee7b7' }}>{q.level}</span>
                                    <span className="ai-result-import">{done ? '✓ Added' : '+ Add to Builder'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );

    return (
        <div className="add-questions-container">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <div className="page-title">Add Questions</div>
                    <div className="page-sub">Build questions manually or generate them instantly with AI.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/topics')}>← Back to Topics</button>
                    <button className="btn btn-ai btn-sm" onClick={() => setActiveTab('ai')}>🤖 AI Generate</button>
                    <button className="btn btn-primary btn-sm" onClick={() => saveAll()} disabled={isSaving}>
                        {isSaving ? 'Saving...' : '💾 Save All Questions'}
                    </button>
                </div>
            </div>

            {/* TAB BAR */}
            <div className="tab-bar">
                <button className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>✏️ Manual Entry</button>
                <button className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>🤖 AI Generated</button>
            </div>

            {/* ── MANUAL TAB ── */}
            {activeTab === 'manual' && (
                <div className="add-layout">
                    {/* Builder Area */}
                    <div>
                        <div className="builder-area">
                            {questions.map((q, idx) => (
                                <div key={q.id} className={`q-card ${collapsedCards[q.id] ? 'collapsed' : ''}`}>
                                    <div className="q-card-header" onClick={() => toggleCollapse(q.id)}>
                                        <div className="q-card-num">{idx + 1}</div>
                                        <div className={`q-card-preview ${q.text ? 'has-text' : ''}`}>
                                            {q.text ? (q.text.length > 70 ? q.text.slice(0, 70) + '…' : q.text) : 'New Question'}
                                        </div>
                                        <div className="q-card-actions" onClick={e => e.stopPropagation()}>
                                            <div className="q-card-collapse" onClick={() => toggleCollapse(q.id)}>{collapsedCards[q.id] ? '▼' : '▲'}</div>
                                            <div className="q-card-del" onClick={() => removeQuestion(q.id)}>🗑</div>
                                        </div>
                                    </div>

                                    <div className="q-card-body">
                                        <div className="section-divider">
                                            <div className="section-divider-line"></div>
                                            <div className="section-divider-text">Question Type</div>
                                            <div className="section-divider-line"></div>
                                        </div>
                                        <div className="type-selector">
                                            {[
                                                { key: 'MCQ', icon: '🔘', name: 'Single Select', desc: 'One correct answer' },
                                                { key: 'Multi-Select', icon: '☑️', name: 'Multi-Select', desc: 'Multiple correct' },
                                                { key: 'Text', icon: '📝', name: 'Open Text', desc: 'Free-form answer' },
                                                { key: 'Image', icon: '🖼️', name: 'Image Select', desc: 'Pick correct image' },
                                            ].map(t => (
                                                <div key={t.key}
                                                    className={`type-opt t-${t.key.toLowerCase().replace('-select', '')} ${q.type === t.key ? 'selected' : ''}`}
                                                    onClick={() => handleTypeSelect(q.id, t.key as QuestionType)}>
                                                    <div className="type-opt-icon">{t.icon}</div>
                                                    <div className="type-opt-name">{t.name}</div>
                                                    <div className="type-opt-desc">{t.desc}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="form-row triple">
                                            <div className="form-group">
                                                <label>Topic <span style={{ color: 'var(--red)' }}>*</span></label>
                                                <select value={q.topic} onChange={e => updateQuestion(q.id, { topic: e.target.value })}>
                                                    <option value="">Select…</option>
                                                    {realTopics.map(t => (
                                                        <option key={t.topicId || t.id} value={t.topicId || t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Difficulty <span style={{ color: 'var(--red)' }}>*</span></label>
                                                <select value={q.level} onChange={e => updateQuestion(q.id, { level: e.target.value as any })}>
                                                    <option value="">Select…</option>
                                                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Status</label>
                                                <select value={q.status} onChange={e => updateQuestion(q.id, { status: e.target.value as any })}>
                                                    <option value="Active">Published</option>
                                                    <option value="Draft">Draft</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="form-row full">
                                            <div className="form-group">
                                                <label>Question Text <span style={{ color: 'var(--red)' }}>*</span></label>
                                                <textarea placeholder="Type the question here…" rows={3} value={q.text} onChange={e => updateQuestion(q.id, { text: e.target.value })} />
                                            </div>
                                        </div>

                                        {q.type === '' && (
                                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', border: '1.5px dashed var(--border)', borderRadius: '10px' }}>
                                                ↑ Select a question type to configure answer options
                                            </div>
                                        )}
                                        {(q.type === 'MCQ' || q.type === 'Multi-Select') && <OptionBuilder q={q} />}
                                        {q.type === 'Text' && (
                                            <div className="form-group">
                                                <label>Model Answer (optional)</label>
                                                <textarea placeholder="Enter the expected answer for reference…" rows={3} value={q.textAnswer} onChange={e => updateQuestion(q.id, { textAnswer: e.target.value })} />
                                            </div>
                                        )}
                                        {q.type === 'Image' && (
                                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', border: '1.5px dashed var(--border)', borderRadius: '10px' }}>
                                                🖼️ Image upload — upload images and click one to mark as correct.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="add-q-btn" style={{ marginTop: '12px' }} onClick={() => handleAddQuestion()}>
                            <span>＋</span> Add Another Question
                        </button>
                    </div>

                    {/* ── RIGHT PANEL ── */}
                    <div className="right-panel">

                        {/* Session Summary */}
                        <div className="info-panel">
                            <div className="info-panel-header">
                                <div className="info-panel-title">📋 Session Summary</div>
                            </div>
                            <div className="info-panel-body">
                                <div className="summary-count">{questions.length}</div>
                                <div className="summary-label">Question(s) in this session</div>
                                <div>
                                    {[
                                        { label: 'MCQ', color: 'var(--accent2)', type: 'MCQ' },
                                        { label: 'Multi-Select', color: 'var(--purple)', type: 'Multi-Select' },
                                        { label: 'Open Text', color: 'var(--yellow)', type: 'Text' },
                                        { label: 'Image Select', color: 'var(--green)', type: 'Image' },
                                    ].map(row => (
                                        <div className="summary-type-row" key={row.type}>
                                            <span className="summary-type-name">
                                                <span className="summary-type-dot" style={{ background: row.color }}></span>
                                                {row.label}
                                            </span>
                                            <span className="summary-type-num">{questions.filter(q => q.type === row.type).length}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="save-all-row">
                                    <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => saveAll()} disabled={isSaving}>
                                        {isSaving ? 'Saving...' : '💾 Save All as Published'}
                                    </button>
                                    <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={() => saveAll(true)} disabled={isSaving}>
                                        📄 Save All as Draft
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* AI Generator (sidebar - full inline form) */}
                        <div className="ai-panel">
                            <div className="ai-panel-header">
                                <div className="ai-panel-title">🤖 AI Question Generator</div>
                                <div className="ai-panel-sub">Generate questions from topic &amp; difficulty</div>
                            </div>
                            <div className="ai-panel-body">
                                <div className="ai-input-group">
                                    <div className="ai-input-label">Topic</div>
                                    <select className="ai-select" value={aiTopic} onChange={e => setAiTopic(e.target.value)}>
                                        <option value="">Select topic…</option>
                                        {realTopics.map(t => <option key={t.topicId || t.id} value={t.topicId || t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="ai-input-group">
                                    <div className="ai-input-label">Difficulty</div>
                                    <select className="ai-select" value={aiLevel} onChange={e => setAiLevel(e.target.value)}>
                                        <option value="">Any difficulty</option>
                                        {LEVELS.map(l => <option key={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div className="ai-input-group">
                                    <div className="ai-input-label">Question Type</div>
                                    <select className="ai-select" value={aiType} onChange={e => setAiType(e.target.value)}>
                                        <option value="">Mixed types</option>
                                        <option>MCQ</option><option>Multi-Select</option><option>Text</option>
                                    </select>
                                </div>
                                <div className="ai-input-label" style={{ color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>How many?</div>
                                <div className="ai-count-row">
                                    {[3, 5, 10, 15].map(n => (
                                        <div key={n} className={`ai-count-btn ${aiCount === n ? 'selected' : ''}`} onClick={() => setAiCount(n)}>{n}</div>
                                    ))}
                                </div>
                                <button className="ai-generate-btn" onClick={handleGenerateAI} disabled={isGenerating}>
                                    {isGenerating ? 'Generating…' : '✨ Generate Questions'}
                                </button>
                                <AiResultList results={aiResults} generating={isGenerating} keyPrefix="sb" />
                            </div>
                        </div>

                        {/* Tips Panel */}
                        <div className="info-panel">
                            <div className="info-panel-header">
                                <div className="info-panel-title">💡 Tips</div>
                            </div>
                            <div className="info-panel-body">
                                {[
                                    { icon: '🎯', text: 'Click the circle next to an option to mark it as the correct answer.' },
                                    { icon: '🖼️', text: 'For image questions, upload images and click one to mark it as correct.' },
                                    { icon: '✅', text: 'Multi-Select allows multiple correct answers — toggle multiple circles.' },
                                    { icon: '🤖', text: 'Use AI Generate to instantly create questions and import them into the builder.' },
                                ].map((tip, i) => (
                                    <div className="tip-row" key={i}>
                                        <div className="tip-icon">{tip.icon}</div>
                                        <div className="tip-text">{tip.text}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* ── AI FULL TAB ── */}
            {activeTab === 'ai' && (
                <div style={{ maxWidth: '760px', margin: '0 auto' }}>
                    <div className="ai-panel">
                        <div className="ai-panel-header" style={{ padding: '24px 28px 16px' }}>
                            <div className="ai-panel-title" style={{ fontSize: '20px' }}>🤖 AI Question Generator</div>
                            <div className="ai-panel-sub" style={{ fontSize: '13px', marginTop: '6px' }}>
                                Describe what you need and let AI create high-quality questions instantly.
                            </div>
                        </div>
                        <div className="ai-panel-body" style={{ padding: '0 28px 28px' }}>
                            <div className="form-row triple" style={{ marginBottom: '14px' }}>
                                <div className="ai-input-group" style={{ marginBottom: 0 }}>
                                    <div className="ai-input-label">Topic</div>
                                    <select className="ai-select" value={ai2Topic} onChange={e => setAi2Topic(e.target.value)}>
                                        <option value="">Select topic…</option>
                                        {realTopics.map(t => <option key={t.topicId || t.id} value={t.topicId || t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="ai-input-group" style={{ marginBottom: 0 }}>
                                    <div className="ai-input-label">Difficulty</div>
                                    <select className="ai-select" value={ai2Level} onChange={e => setAi2Level(e.target.value)}>
                                        <option value="">Any difficulty</option>
                                        {LEVELS.map(l => <option key={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div className="ai-input-group" style={{ marginBottom: 0 }}>
                                    <div className="ai-input-label">Type</div>
                                    <select className="ai-select" value={ai2Type} onChange={e => setAi2Type(e.target.value)}>
                                        <option value="">Mixed</option>
                                        <option>MCQ</option><option>Multi-Select</option><option>Text</option>
                                    </select>
                                </div>
                            </div>
                            <div className="ai-input-group">
                                <div className="ai-input-label">Custom Prompt (optional)</div>
                                <input type="text" className="ai-input" placeholder="e.g. Focus on ES6 features, arrow functions…"
                                    value={ai2Prompt} onChange={e => setAi2Prompt(e.target.value)} />
                            </div>
                            <div className="ai-input-label" style={{ color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>Number of questions</div>
                            <div className="ai-count-row" style={{ marginBottom: '14px' }}>
                                {[3, 5, 10, 15, 20].map(n => (
                                    <div key={n} className={`ai-count-btn ${ai2Count === n ? 'selected' : ''}`} onClick={() => setAi2Count(n)}>{n}</div>
                                ))}
                            </div>
                            <button className="ai-generate-btn" onClick={handleGenerateAI2} disabled={isGenerating2}>
                                {isGenerating2 ? 'Generating…' : '✨ Generate Questions Now'}
                            </button>
                            <AiResultList results={ai2Results} generating={isGenerating2} keyPrefix="ai2" />
                            {ai2Results.length > 0 && !isGenerating2 && (
                                <button className="btn btn-green" style={{ width: '100%', justifyContent: 'center', marginTop: '14px' }}
                                    onClick={() => ai2Results.forEach((q, i) => importQuestion(q, i, `ai2-${q.id}-${i}`))}>
                                    + Import All to Builder
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST */}
            <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : '#0d1117' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default AddQuestions;
