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
    topic: string;
    level: DifficultyStatus;
    status: 'Active' | 'Draft';
    options: string[];
    correct: number | number[]; // For multi-select, array of numbers
    textAnswer: string;
    images: ImageOption[];
}

const LEVELS = ['Easy', 'Medium', 'Hard'];

// Mock UUIDs for Level and Type since they aren't in Swagger paths
const MOCK_LEVELS: Record<string, string> = {
    'Easy': 'e1111111-1111-1111-1111-111111111111',
    'Medium': 'e2222222-2222-2222-2222-222222222222',
    'Hard': 'e3333333-3333-3333-3333-333333333333'
};

const MOCK_TYPES: Record<string, string> = {
    'MCQ': 't1111111-1111-1111-1111-111111111111',
    'Multi-Select': 't2222222-2222-2222-2222-222222222222',
    'Text': 't3333333-3333-3333-3333-333333333333',
    'Image': 't4444444-4444-4444-4444-444444444444'
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

    // AI Panel State
    const [aiTopic, setAiTopic] = useState('');
    const [aiLevel, setAiLevel] = useState('');
    const [aiType, setAiType] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiCount, setAiCount] = useState(3);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiResults, setAiResults] = useState<any[]>([]);

    const fetchTopics = async () => {
        try {
            const res = await topicsApi.getAll();
            setRealTopics(res.data);
        } catch (err) {
            showToast('Failed to load topics', 'error');
        }
    };

    // Init
    useEffect(() => {
        fetchTopics();
        handleAddQuestion();
    }, []);

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const handleAddQuestion = (prefill?: Partial<Question>) => {
        const newId = qCounter + 1;
        setQCounter(newId);
        const newQ: Question = {
            id: newId,
            type: '',
            text: '',
            topic: '',
            level: '',
            status: 'Active',
            options: [],
            correct: 0,
            textAnswer: '',
            images: [],
            ...prefill
        };
        setQuestions(prev => [...prev, newQ]);
    };

    const removeQuestion = (id: number) => {
        if (questions.length === 1) {
            showToast('At least one question is required.', 'error');
            return;
        }
        setQuestions(prev => prev.filter(q => q.id !== id));
    };

    const updateQuestion = (id: number, updates: Partial<Question>) => {
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const handleTypeSelect = (id: number, type: QuestionType) => {
        setQuestions(prev => prev.map(q => {
            if (q.id === id) {
                const nextQ = { ...q, type };
                if (type === 'MCQ' || type === 'Multi-Select') {
                    if (!nextQ.options.length) {
                        nextQ.options = ['', '', '', ''];
                        nextQ.correct = type === 'Multi-Select' ? [] : 0;
                    } else {
                        // Type switch logic
                        if (type === 'MCQ' && Array.isArray(nextQ.correct)) {
                            nextQ.correct = nextQ.correct.length > 0 ? nextQ.correct[0] : 0;
                        } else if (type === 'Multi-Select' && typeof nextQ.correct === 'number') {
                            nextQ.correct = [nextQ.correct];
                        }
                    }
                }
                return nextQ;
            }
            return q;
        }));
    };

    const toggleCollapse = (id: number) => {
        setCollapsedCards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const OptionBuilder = ({ q }: { q: Question }) => {
        const isMulti = q.type === 'Multi-Select';

        const updateOpt = (idx: number, val: string) => {
            const newOpts = [...q.options];
            newOpts[idx] = val;
            updateQuestion(q.id, { options: newOpts });
        };

        const toggleOpt = (idx: number) => {
            if (isMulti) {
                let corr = (q.correct as number[]) || [];
                if (corr.includes(idx)) {
                    corr = corr.filter(c => c !== idx);
                } else {
                    corr = [...corr, idx];
                }
                updateQuestion(q.id, { correct: corr });
            } else {
                updateQuestion(q.id, { correct: idx });
            }
        };

        const addOpt = () => {
            if (q.options.length >= 8) {
                showToast('Max 8 options allowed.', 'error');
                return;
            }
            updateQuestion(q.id, { options: [...q.options, ''] });
        };

        const remOpt = (idx: number) => {
            if (q.options.length <= 2) {
                showToast('Minimum 2 options required.', 'error');
                return;
            }
            const newOpts = q.options.filter((_, i) => i !== idx);
            let newCorr = q.correct;
            if (isMulti) {
                newCorr = (q.correct as number[]).filter(c => c !== idx).map(c => c > idx ? c - 1 : c);
            } else {
                if (q.correct === idx) newCorr = 0;
                else if ((q.correct as number) > idx) newCorr = (q.correct as number) - 1;
            }
            updateQuestion(q.id, { options: newOpts, correct: newCorr });
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
                        const isCorrect = isMulti ? (q.correct as number[]).includes(i) : q.correct === i;
                        return (
                            <div key={i} className={`option-row ${isCorrect ? 'is-correct' : ''}`}>
                                <div className="correct-toggle" onClick={() => toggleOpt(i)}>
                                    <div className="correct-toggle-inner"></div>
                                </div>
                                <input
                                    className="opt-input"
                                    value={opt}
                                    onChange={e => updateOpt(i, e.target.value)}
                                    placeholder={`Option ${i + 1}`}
                                />
                                {isCorrect && <span className="opt-correct-label">✓ Correct</span>}
                                <button className="opt-del" onClick={() => remOpt(i)}>✕</button>
                            </div>
                        );
                    })}
                </div>
                <button className="add-option-btn" onClick={addOpt}>+ Add Option</button>
            </>
        );
    };

    const handleGenerateAI = async () => {
        if (!aiTopic) {
            showToast('Please select a topic.', 'error');
            return;
        }
        setIsGenerating(true);
        // Mock AI delay for 1.5 seconds
        setTimeout(() => {
            const topicName = realTopics.find(t => t.id === aiTopic)?.name || aiTopic;
            const templates = [
                { text: `What is a key concept in ${topicName}?`, type: 'MCQ' as any, options: ['Concept A', 'Concept B', 'Concept C', 'Concept D'], correct: 1 },
                { text: `Which of the following are features of ${topicName}?`, type: 'Multi-Select' as any, options: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4'], correct: [0, 1] },
                { text: `What does the main function do in ${topicName}?`, type: 'MCQ' as any, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 2 },
            ];

            const results = templates.slice(0, aiCount).map((t, i) => ({
                ...t,
                topic: aiTopic,
                level: aiLevel || ['Easy', 'Medium', 'Hard'][i % 3],
                status: 'Active',
                id: Date.now() + i
            }));

            setAiResults(results);
            setIsGenerating(false);
        }, 1500);
    };

    const importQuestion = (q: any, idx: number) => {
        const key = `${q.id}-${idx}`;
        if (importedIds.has(key)) {
            showToast('Already added to builder.', 'info');
            return;
        }
        setImportedIds(prev => new Set(prev).add(key));
        handleAddQuestion({ ...q });
        setActiveTab('manual');
        showToast('Question added to builder!');
    };

    const saveAll = async (isDraft = false) => {
        // Validate
        for (const [idx, q] of questions.entries()) {
            if (!isDraft) {
                if (!q.type || !q.topic || !q.level || !q.text.trim()) {
                    showToast(`Q${idx + 1}: Please fill all required fields.`, 'error');
                    return;
                }
                if ((q.type === 'MCQ' || q.type === 'Multi-Select') && q.options.length < 2) {
                    showToast(`Q${idx + 1}: Add at least 2 options.`, 'error');
                    return;
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
                        imageUrl: ''
                    })) : [],
                    textAnswer: q.textAnswer || ''
                }))
            };

            await questionsApi.createMultiple(payload);
            showToast(`✅ ${questions.length} question(s) saved!`, 'success');
            setTimeout(() => navigate('/topics'), 1500);
        } catch (err) {
            showToast('Failed to save questions', 'error');
        } finally {
            setIsSaving(false);
        }
    };

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
                                            {q.text ? (q.text.length > 70 ? q.text.substring(0, 70) + '…' : q.text) : 'New Question'}
                                        </div>
                                        <div className="q-card-actions" onClick={e => e.stopPropagation()}>
                                            <div className="q-card-collapse" onClick={() => toggleCollapse(q.id)}>
                                                {collapsedCards[q.id] ? '▼' : '▲'}
                                            </div>
                                            <div className="q-card-del" onClick={() => removeQuestion(q.id)}>🗑</div>
                                        </div>
                                    </div>

                                    <div className="q-card-body">
                                        {/* Type Selector */}
                                        <div className="section-divider">
                                            <div className="section-divider-line"></div>
                                            <div className="section-divider-text">Question Type</div>
                                            <div className="section-divider-line"></div>
                                        </div>
                                        <div className="type-selector">
                                            <div className={`type-opt t-mcq ${q.type === 'MCQ' ? 'selected' : ''}`} onClick={() => handleTypeSelect(q.id, 'MCQ')}>
                                                <div className="type-opt-icon">🔘</div>
                                                <div className="type-opt-name">Single Select</div>
                                                <div className="type-opt-desc">One correct answer</div>
                                            </div>
                                            <div className={`type-opt t-multi ${q.type === 'Multi-Select' ? 'selected' : ''}`} onClick={() => handleTypeSelect(q.id, 'Multi-Select')}>
                                                <div className="type-opt-icon">☑️</div>
                                                <div className="type-opt-name">Multi-Select</div>
                                                <div className="type-opt-desc">Multiple correct</div>
                                            </div>
                                            <div className={`type-opt t-text ${q.type === 'Text' ? 'selected' : ''}`} onClick={() => handleTypeSelect(q.id, 'Text')}>
                                                <div className="type-opt-icon">📝</div>
                                                <div className="type-opt-name">Open Text</div>
                                                <div className="type-opt-desc">Free-form answer</div>
                                            </div>
                                            <div className={`type-opt t-image ${q.type === 'Image' ? 'selected' : ''}`} onClick={() => handleTypeSelect(q.id, 'Image')}>
                                                <div className="type-opt-icon">🖼️</div>
                                                <div className="type-opt-name">Image Select</div>
                                                <div className="type-opt-desc">Pick correct image</div>
                                            </div>
                                        </div>

                                        {/* Meta */}
                                        <div className="form-row triple">
                                            <div className="form-group">
                                                <label>Topic <span style={{ color: 'var(--red)' }}>*</span></label>
                                                <select value={q.topic} onChange={e => updateQuestion(q.id, { topic: e.target.value })}>
                                                    <option value="">Select…</option>
                                                    {realTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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

                                        {/* Question Text */}
                                        <div className="form-row full">
                                            <div className="form-group">
                                                <label>Question Text <span style={{ color: 'var(--red)' }}>*</span></label>
                                                <textarea
                                                    placeholder="Type the question here…"
                                                    rows={3}
                                                    value={q.text}
                                                    onChange={e => updateQuestion(q.id, { text: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Answers Section */}
                                        {q.type === '' && (
                                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', border: '1.5px dashed var(--border)', borderRadius: '10px' }}>
                                                ↑ Select a question type to configure answer options
                                            </div>
                                        )}
                                        {(q.type === 'MCQ' || q.type === 'Multi-Select') && <OptionBuilder q={q} />}
                                        {q.type === 'Text' && (
                                            <div className="form-group">
                                                <label>Model Answer (optional)</label>
                                                <textarea
                                                    placeholder="Enter the expected/model answer for reference…"
                                                    rows={3}
                                                    value={q.textAnswer}
                                                    onChange={e => updateQuestion(q.id, { textAnswer: e.target.value })}
                                                />
                                            </div>
                                        )}
                                        {q.type === 'Image' && (
                                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', border: '1.5px dashed var(--border)', borderRadius: '10px' }}>
                                                Image upload placeholder. (UI omitted for brevity)
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

                    {/* RIGHT PANEL */}
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
                                    <div className="summary-type-row">
                                        <span className="summary-type-name"><span className="summary-type-dot" style={{ background: 'var(--accent2)' }}></span>MCQ</span>
                                        <span className="summary-type-num">{questions.filter(q => q.type === 'MCQ').length}</span>
                                    </div>
                                    <div className="summary-type-row">
                                        <span className="summary-type-name"><span className="summary-type-dot" style={{ background: 'var(--purple)' }}></span>Multi-Select</span>
                                        <span className="summary-type-num">{questions.filter(q => q.type === 'Multi-Select').length}</span>
                                    </div>
                                    <div className="summary-type-row">
                                        <span className="summary-type-name"><span className="summary-type-dot" style={{ background: 'var(--yellow)' }}></span>Open Text</span>
                                        <span className="summary-type-num">{questions.filter(q => q.type === 'Text').length}</span>
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
                        </div>

                        {/* Tiny AI Panel */}
                        <div className="ai-panel">
                            <div className="ai-panel-header">
                                <div className="ai-panel-title">🤖 AI Generator</div>
                                <div className="ai-panel-sub">Generate questions quickly</div>
                            </div>
                            <div className="ai-panel-body">
                                <button className="ai-generate-btn" onClick={() => setActiveTab('ai')}>Go to AI Generator →</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* AI FULL TAB */}
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
                                    <select className="ai-select" value={aiTopic} onChange={e => setAiTopic(e.target.value)}>
                                        <option value="">Select topic…</option>
                                        {realTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="ai-input-group" style={{ marginBottom: 0 }}>
                                    <div className="ai-input-label">Difficulty</div>
                                    <select className="ai-select" value={aiLevel} onChange={e => setAiLevel(e.target.value)}>
                                        <option value="">Any difficulty</option>
                                        {LEVELS.map(l => <option key={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div className="ai-input-group" style={{ marginBottom: 0 }}>
                                    <div className="ai-input-label">Type</div>
                                    <select className="ai-select" value={aiType} onChange={e => setAiType(e.target.value)}>
                                        <option value="">Mixed</option>
                                        <option>MCQ</option><option>Multi-Select</option><option>Text</option>
                                    </select>
                                </div>
                            </div>
                            <div className="ai-input-group">
                                <div className="ai-input-label">Custom Prompt (optional)</div>
                                <input
                                    type="text"
                                    className="ai-input"
                                    placeholder="e.g. Focus on ES6 features, arrow functions…"
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                />
                            </div>

                            <div className="ai-input-label">Number of questions</div>
                            <div className="ai-count-row">
                                {[3, 5, 10, 15].map(n => (
                                    <div key={n} className={`ai-count-btn ${aiCount === n ? 'selected' : ''}`} onClick={() => setAiCount(n)}>
                                        {n}
                                    </div>
                                ))}
                            </div>

                            <button className="ai-generate-btn" onClick={() => handleGenerateAI()} disabled={isGenerating}>
                                {isGenerating ? 'Generating...' : '✨ Generate Questions Now'}
                            </button>

                            {isGenerating && (
                                <div className="ai-loading visible" style={{ marginTop: '16px' }}>
                                    <div className="ai-loading-bar"><div className="ai-loading-fill"></div></div>
                                    <div className="ai-loading-text">Crafting your questions…</div>
                                </div>
                            )}

                            {aiResults.length > 0 && !isGenerating && (
                                <div className="ai-results" style={{ marginTop: '16px' }}>
                                    {aiResults.map((q, i) => {
                                        const isImported = importedIds.has(`${q.id}-${i}`);
                                        return (
                                            <div
                                                key={i}
                                                className={`ai-result-card ${isImported ? 'imported' : ''}`}
                                                onClick={() => importQuestion(q, i)}
                                            >
                                                <div className="ai-result-q">{q.text}</div>
                                                <div className="ai-result-meta">
                                                    <span className="ai-result-badge" style={{ background: 'rgba(0,87,255,.25)', color: '#93c5fd' }}>{q.type}</span>
                                                    <span className="ai-result-badge" style={{ background: 'rgba(0,194,113,.2)', color: '#6ee7b7' }}>{q.level}</span>
                                                    <span className="ai-result-import">{isImported ? '✓ Added' : '+ Add to Builder'}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
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
