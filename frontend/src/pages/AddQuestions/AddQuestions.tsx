import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { topicsApi, questionsApi, aiQuestionsApi } from '../../services/api';
import { compressImage } from '../../utils/compressImage';
import './AddQuestions.css';
import RichTextEditor from '../../components/RichTextEditor/RichTextEditor';

type QuestionType      = 'MCQ' | 'Multi-Select' | 'Text' | 'Image' | '';
type DifficultyStatus  = 'Easy' | 'Medium' | 'Hard' | '';

interface ImageOption {
    label:    string;
    imageUrl: string;
    isCorrect: boolean;
}

interface Question {
    id:           number;
    apiId?:       string;
    type:         QuestionType;
    text:         string;
    topic:        string;
    level:        DifficultyStatus;
    status:       'Active' | 'Draft';
    options:      string[];
    correct:      number | number[];
    textAnswer:   string;
    imageOptions: ImageOption[];
}

const LEVELS = ['Easy', 'Medium', 'Hard'];

const LEVEL_IDS: Record<string, string> = {
    'Easy':   '11111111-1111-1111-1111-111111111111',
    'Medium': '22222222-2222-2222-2222-222222222222',
    'Hard':   '33333333-3333-3333-3333-333333333333',
};

const TYPE_IDS: Record<string, string> = {
    'MCQ':          'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    'Multi-Select': 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    'Text':         'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    'Image':        'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
};

const TYPE_API_MAP: Record<string, string> = {
    'MCQ':          'SingleSelect',
    'Multi-Select': 'MultiSelect',
    'Text':         'OpenText',
    'Image':        'ImageSelect',
};

const EMPTY_IMAGE_OPT = (): ImageOption => ({ label: '', imageUrl: '', isCorrect: false });

const mapApiQuestion = (q: any, localId: number, fallbackTopicId: string): Question => {
    const rawOpts = q.options ?? q.answerOptions ?? [];
    const optStrings: string[] = Array.isArray(rawOpts)
        ? rawOpts.map((o: any) => (typeof o === 'string' ? o : o.text ?? o.optionText ?? ''))
        : [];

    let type: QuestionType = 'MCQ';
    const rawType = (q.questionType ?? q.type ?? '').toLowerCase();
    if      (rawType.includes('multi'))                            type = 'Multi-Select';
    else if (rawType.includes('text') || rawType.includes('open')) type = 'Text';
    else if (rawType.includes('image'))                            type = 'Image';
    else                                                           type = 'MCQ';

    let correct: number | number[] = 0;
    if (type === 'Multi-Select') {
        if (Array.isArray(q.correctAnswers)) correct = q.correctAnswers.map(Number);
        else correct = rawOpts.reduce((acc: number[], o: any, i: number) => { if (o?.isCorrect) acc.push(i); return acc; }, []);
    } else {
        if (q.correctAnswer !== undefined && q.correctAnswer !== null) correct = Number(q.correctAnswer);
        else { const ci = rawOpts.findIndex((o: any) => o?.isCorrect === true); correct = ci >= 0 ? ci : 0; }
    }

    let level: DifficultyStatus = 'Easy';
    const lv = (q.level ?? q.difficulty ?? q.levelName ?? '').toLowerCase();
    if      (lv.includes('hard')) level = 'Hard';
    else if (lv.includes('med'))  level = 'Medium';

    const imageOptions: ImageOption[] = type === 'Image' && Array.isArray(rawOpts)
        ? rawOpts.map((o: any) => ({
            label:     typeof o === 'string' ? o : (o.text ?? o.optionText ?? ''),
            imageUrl:  typeof o === 'object' ? (o.imageUrl ?? '') : '',
            isCorrect: typeof o === 'object' ? (o.isCorrect ?? false) : false,
          }))
        : [EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT()];

    return {
        id: localId, apiId: String(q.id ?? q.questionId ?? ''),
        type, text: q.questionText ?? q.text ?? '',
        topic: q.topicId ?? q.topic ?? fallbackTopicId,
        level, status: q.status === 'Draft' ? 'Draft' : 'Active',
        options: optStrings.length ? optStrings : (type !== 'Text' && type !== 'Image' ? ['', '', '', ''] : []),
        correct, textAnswer: q.textAnswer ?? q.modelAnswer ?? '',
        imageOptions,
    };
};

const buildMCQOptions = (q: Question) =>
    q.options.map((text, i) => ({
        text,
        isCorrect: Array.isArray(q.correct) ? q.correct.includes(i) : q.correct === i,
        imageUrl: '',
    }));

const buildImageOptions = (q: Question) =>
    q.imageOptions.map(opt => ({
        text: opt.label, isCorrect: opt.isCorrect, imageUrl: opt.imageUrl,
    }));

const AddQuestions: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const routeState              = (location.state as any) ?? {};
    const editMode                = !!routeState.editMode;
    const presetTopicId           = routeState.topicId   ?? '';
    const presetTopicName         = routeState.topicName ?? '';
    const existingQuestions: any[] = routeState.existingQuestions ?? [];

    const [activeTab,      setActiveTab]      = useState<'manual' | 'ai'>('manual');
    const [questions,      setQuestions]      = useState<Question[]>([]);
    const [qCounter,       setQCounter]       = useState(0);
    const [collapsedCards, setCollapsedCards] = useState<Record<number, boolean>>({});
    const [realTopics,     setRealTopics]     = useState<any[]>([]);
    const [isSaving,       setIsSaving]       = useState(false);
    const [toast,          setToast]          = useState({ show: false, msg: '', type: 'success' });
    const [importedIds,    setImportedIds]    = useState<Set<string>>(new Set());

    const fileRefsMap = useRef<Record<number, (HTMLInputElement | null)[]>>({});
    const getFileRefs = (qId: number) => {
        if (!fileRefsMap.current[qId]) fileRefsMap.current[qId] = [];
        return fileRefsMap.current[qId];
    };

    // AI state (kept minimal — full generation moved to /ai-generator page)
    const [aiTopic,      setAiTopic]      = useState('');
    const [aiLevel,      setAiLevel]      = useState('');
    const [aiType,       setAiType]       = useState('MCQ');
    const [aiCount,      setAiCount]      = useState(3);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiResults,    setAiResults]    = useState<any[]>([]);

    useEffect(() => {
        topicsApi.getAll().then(res => {
            const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? res.data?.data ?? []);
            setRealTopics(list);
        }).catch(() => showToast('Failed to load topics', 'error'));

        if (editMode && existingQuestions.length > 0) {
            let ctr = 0;
            const prefilled = existingQuestions.map(q => mapApiQuestion(q, ++ctr, presetTopicId));
            setQCounter(ctr);
            setQuestions(prefilled);
        } else {
            setQCounter(1);
            setQuestions([{
                id: 1, type: '', text: '', topic: presetTopicId,
                level: '', status: 'Active', options: [],
                correct: 0, textAnswer: '', imageOptions: [],
            }]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const handleAddQuestion = (prefill?: Partial<Question>) => {
        const newId = qCounter + 1;
        setQCounter(newId);
        setQuestions(prev => [...prev, {
            id: newId, type: '', text: '', topic: presetTopicId,
            level: '', status: 'Active', options: [],
            correct: 0, textAnswer: '', imageOptions: [],
            ...prefill,
        }]);
    };

    const removeQuestion = (id: number) => {
        if (questions.length === 1) { showToast('At least one question is required.', 'error'); return; }
        setQuestions(prev => prev.filter(q => q.id !== id));
    };

    const updateQuestion = (id: number, updates: Partial<Question>) =>
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));

    const handleTypeSelect = (id: number, type: QuestionType) => {
        setQuestions(prev => prev.map(q => {
            if (q.id !== id) return q;
            const next = { ...q, type };
            if (type === 'MCQ' || type === 'Multi-Select') {
                if (!next.options.length) {
                    next.options = ['', '', '', ''];
                    next.correct = type === 'Multi-Select' ? [] : 0;
                } else {
                    if (type === 'MCQ'          && Array.isArray(next.correct))      next.correct = next.correct[0] ?? 0;
                    if (type === 'Multi-Select' && typeof next.correct === 'number') next.correct = [next.correct];
                }
            }
            if (type === 'Image' && (!next.imageOptions || next.imageOptions.length === 0))
                next.imageOptions = [EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT()];
            return next;
        }));
    };

    const toggleCollapse = (id: number) =>
        setCollapsedCards(prev => ({ ...prev, [id]: !prev[id] }));

    const renderOptions = (q: Question) => {
        const isMulti = q.type === 'Multi-Select';
        const updateOpt  = (idx: number, val: string) => { const o = [...q.options]; o[idx] = val; updateQuestion(q.id, { options: o }); };
        const toggleOpt  = (idx: number) => {
            if (isMulti) {
                let c = (q.correct as number[]) || [];
                c = c.includes(idx) ? c.filter(x => x !== idx) : [...c, idx];
                updateQuestion(q.id, { correct: c });
            } else { updateQuestion(q.id, { correct: idx }); }
        };
        const addOpt = () => { if (q.options.length >= 8) { showToast('Max 8 options.', 'error'); return; } updateQuestion(q.id, { options: [...q.options, ''] }); };
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
                    <div className="section-divider-line" /><div className="section-divider-text">{isMulti ? 'Answer Options (select all correct)' : 'Answer Options (select one correct)'}</div><div className="section-divider-line" />
                </div>
                <div className="options-builder">
                    {q.options.map((opt, i) => {
                        const ok = isMulti ? (q.correct as number[]).includes(i) : q.correct === i;
                        return (
                            <div key={i} className={`option-row ${ok ? 'is-correct' : ''}`}>
                                <div className="correct-toggle" onClick={() => toggleOpt(i)}><div className="correct-toggle-inner" /></div>
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

    const renderImageOptions = (q: Question) => {
        const updateImageOpt = (idx: number, updates: Partial<ImageOption>) => {
            const opts = [...q.imageOptions]; opts[idx] = { ...opts[idx], ...updates }; updateQuestion(q.id, { imageOptions: opts });
        };
        const setCorrect = (idx: number) => {
            const opts = q.imageOptions.map((o, i) => ({ ...o, isCorrect: i === idx })); updateQuestion(q.id, { imageOptions: opts });
        };
        const handleFileChange = async (idx: number, file: File | null) => {
            if (!file) return;
            try {
                const compressed = await compressImage(file, 300, 300, 0.6);
                updateImageOpt(idx, { imageUrl: compressed });
            } catch {
                const reader = new FileReader();
                reader.onload = e => updateImageOpt(idx, { imageUrl: e.target?.result as string });
                reader.readAsDataURL(file);
            }
        };
        const addImageOpt    = () => { if (q.imageOptions.length >= 6) { showToast('Max 6 image options.', 'error'); return; } updateQuestion(q.id, { imageOptions: [...q.imageOptions, EMPTY_IMAGE_OPT()] }); };
        const removeImageOpt = (idx: number) => { if (q.imageOptions.length <= 2) { showToast('Min 2 image options.', 'error'); return; } updateQuestion(q.id, { imageOptions: q.imageOptions.filter((_, i) => i !== idx) }); };

        return (
            <>
                <div className="section-divider">
                    <div className="section-divider-line" /><div className="section-divider-text">Image Options — click ○ to mark correct</div><div className="section-divider-line" />
                </div>
                <div className="image-options-grid">
                    {q.imageOptions.map((opt, idx) => (
                        <div key={idx} className={`image-opt-card ${opt.isCorrect ? 'is-correct' : ''}`}>
                            <div className="img-opt-correct-row">
                                <div className={`img-opt-radio ${opt.isCorrect ? 'selected' : ''}`} onClick={() => setCorrect(idx)} title="Mark as correct" />
                                {opt.isCorrect && <span className="img-opt-correct-tag">✓ Correct</span>}
                                <button className="img-opt-del" onClick={() => removeImageOpt(idx)}>✕</button>
                            </div>
                            <div className="img-opt-preview" onClick={() => getFileRefs(q.id)[idx]?.click()} title="Click to upload image">
                                {opt.imageUrl ? (
                                    <img src={opt.imageUrl} alt={opt.label || `Option ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                                ) : (
                                    <div className="img-opt-placeholder">
                                        <div className="img-opt-placeholder-icon">🖼️</div>
                                        <div className="img-opt-placeholder-text">Click to upload</div>
                                    </div>
                                )}
                                <input type="file" accept="image/*" style={{ display: 'none' }}
                                    ref={el => { getFileRefs(q.id)[idx] = el; }}
                                    onChange={e => handleFileChange(idx, e.target.files?.[0] ?? null)} />
                            </div>
                            <div className="img-opt-url-row">
                                <input className="img-opt-url-input" type="text" placeholder="or paste image URL…"
                                    value={opt.imageUrl.startsWith('data:') ? '' : opt.imageUrl}
                                    onChange={e => updateImageOpt(idx, { imageUrl: e.target.value })} />
                            </div>
                            <input className="img-opt-label-input" type="text" placeholder={`Label (e.g. Option ${String.fromCharCode(65 + idx)})`}
                                value={opt.label} onChange={e => updateImageOpt(idx, { label: e.target.value })} />
                        </div>
                    ))}
                </div>
                <button className="add-option-btn" style={{ marginTop: '10px' }} onClick={addImageOpt}>🖼️ + Add Image Option</button>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                    Images are compressed to 300×300 WebP (~5–15 KB) before saving. Upload a file or paste a URL.
                </div>
            </>
        );
    };

    // ── AI Generation — calls real Gemini API ─────────────────────────────────
    const runGenerate = async (
        topic: string, level: string, count: number,
        setResults: (r: any[]) => void,
        setGenerating: (b: boolean) => void,
        type: string = 'MCQ',
    ) => {
        if (!topic) { showToast('Please select a topic.', 'error'); return; }
        setGenerating(true);

        const topicName = realTopics.find(t => (t.topicId ?? t.id) === topic)?.name ?? 'General';
        const apiType   = TYPE_API_MAP[type] ?? 'SingleSelect';
        const apiLevel  = level || 'Mixed';

        try {
            const res = await aiQuestionsApi.generate({
                topic:         topicName,
                level:         apiLevel,
                questionType:  apiType,
                questionCount: count,
            });

            const raw: any[] = Array.isArray(res.data) ? res.data : [];

            const mapped = raw.map((q: any, i: number) => {
                const opts: string[] = (q.options ?? []).map((o: any) => o.text ?? o.Text ?? '');
                const correctIdx     = (q.options ?? []).findIndex((o: any) => o.isCorrect ?? o.IsCorrect ?? false);
                return {
                    id:           Date.now() + i,
                    text:         q.questionText ?? q.QuestionText ?? '',
                    type,
                    level:        level || 'Easy',
                    topic,
                    status:       'Active',
                    options:      opts,
                    correct:      correctIdx >= 0 ? correctIdx : 0,
                    textAnswer:   q.textAnswer ?? q.TextAnswer ?? '',
                    imageOptions: [],
                };
            });

            setResults(mapped);
            if (mapped.length > 0) showToast(`${mapped.length} questions generated!`);
            else showToast('AI returned no questions. Try again.', 'error');

        } catch (err: any) {
            const msg = err?.response?.data?.message ?? err?.message ?? 'AI generation failed';
            showToast(msg.toLowerCase().includes('quota') ? 'AI quota exceeded — get a new API key' : 'AI generation failed', 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerateAI = () => runGenerate(aiTopic, aiLevel, aiCount, setAiResults, setIsGenerating, aiType || 'MCQ');

    const importQuestion = (q: any, idx: number, key?: string) => {
        const k = key || `${q.id}-${idx}`;
        if (importedIds.has(k)) { showToast('Already added.', 'info'); return; }
        setImportedIds(prev => new Set(prev).add(k));
        handleAddQuestion({ ...q, imageOptions: q.imageOptions ?? [] });
        setActiveTab('manual');
        showToast('Question added to builder!');
    };

    const saveAll = async (isDraft = false) => {
        for (const [idx, q] of questions.entries()) {
            if (!isDraft) {
                if (!q.type || !q.topic || !q.level || !q.text.trim()) {
                    showToast(`Q${idx + 1}: Fill all required fields (type, topic, difficulty, text).`, 'error'); return;
                }
                if ((q.type === 'MCQ' || q.type === 'Multi-Select') && q.options.filter(o => o.trim()).length < 2) {
                    showToast(`Q${idx + 1}: Add at least 2 non-empty options.`, 'error'); return;
                }
                if (q.type === 'Image') {
                    const filled = q.imageOptions.filter(o => o.imageUrl.trim() || o.label.trim());
                    if (filled.length < 2) { showToast(`Q${idx + 1}: Add at least 2 image options.`, 'error'); return; }
                    if (!q.imageOptions.some(o => o.isCorrect)) { showToast(`Q${idx + 1}: Mark one image option as correct.`, 'error'); return; }
                }
            }
        }

        setIsSaving(true);

        const getOptions = (q: Question) => {
            if (q.type === 'MCQ' || q.type === 'Multi-Select') return buildMCQOptions(q);
            if (q.type === 'Image') return buildImageOptions(q);
            return [];
        };

        if (editMode) {
            let ok = 0, fail = 0;
            for (const q of questions) {
                try {
                    if (q.apiId) {
                        const putPayload: any = { questionText: q.text, status: q.status };
                        if (q.type === 'Text') putPayload.textAnswer = q.textAnswer;
                        else                   putPayload.options    = getOptions(q);
                        await questionsApi.update(q.apiId, putPayload);
                    } else {
                        await questionsApi.createMultiple({
                            isSaveAsDraft: isDraft,
                            questions: [{ questionText: q.text, topicId: q.topic || presetTopicId, levelId: LEVEL_IDS[q.level] || LEVEL_IDS['Easy'], questionTypeId: TYPE_IDS[q.type] || TYPE_IDS['MCQ'], options: getOptions(q), textAnswer: q.type === 'Text' ? q.textAnswer : '' }],
                        });
                    }
                    ok++;
                } catch { fail++; }
            }
            setIsSaving(false);
            if (fail === 0) { showToast(`✅ ${ok} question(s) saved!`); setTimeout(() => navigate('/topics'), 1500); }
            else showToast(`${ok} saved, ${fail} failed.`, 'error');
        } else {
            try {
                await questionsApi.createMultiple({
                    isSaveAsDraft: isDraft,
                    questions: questions.map(q => ({
                        questionText:   q.text,
                        topicId:        q.topic || '00000000-0000-0000-0000-000000000000',
                        levelId:        LEVEL_IDS[q.level] || LEVEL_IDS['Easy'],
                        questionTypeId: TYPE_IDS[q.type]   || TYPE_IDS['MCQ'],
                        options:        getOptions(q),
                        textAnswer:     q.type === 'Text' ? q.textAnswer : '',
                    })),
                });
                showToast(`✅ ${questions.length} question(s) saved!`);
                setTimeout(() => navigate('/topics'), 1500);
            } catch {
                showToast('Failed to save questions', 'error');
            } finally {
                setIsSaving(false);
            }
        }
    };

    const AiResultList = ({ results, generating, keyPrefix }: { results: any[], generating: boolean, keyPrefix: string }) => (
        <>
            {generating && (
                <div className="ai-loading visible" style={{ marginTop: '14px' }}>
                    <div className="ai-loading-bar"><div className="ai-loading-fill" /></div>
                    <div className="ai-loading-text">Generating questions with AI…</div>
                </div>
            )}
            {results.length > 0 && !generating && (
                <div className="ai-results" style={{ marginTop: '12px' }}>
                    {results.map((q, i) => {
                        const key  = `${keyPrefix}-${q.id}-${i}`;
                        const done = importedIds.has(key);
                        return (
                            <div key={i} className={`ai-result-card ${done ? 'imported' : ''}`} onClick={() => importQuestion(q, i, key)}>
                                <div className="ai-result-q">{q.text}</div>
                                <div className="ai-result-meta">
                                    <span className="ai-result-badge" style={{ background: 'rgba(0,87,255,.25)',  color: '#93c5fd' }}>{q.type}</span>
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
            <div className="page-header">
                <div>
                    <div className="page-title">{editMode ? `Editing — ${presetTopicName}` : 'Add Questions'}</div>
                    <div className="page-sub">{editMode ? `${existingQuestions.length} question(s) loaded · edit and save to update` : 'Build questions manually or generate them with AI.'}</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/topics')}>← Back to Topics</button>
                    {!editMode && <button className="btn btn-ai btn-sm" onClick={() => setActiveTab('ai')}>🤖 AI Generate</button>}
                    <button className="btn btn-primary btn-sm" onClick={() => saveAll()} disabled={isSaving}>
                        {isSaving ? 'Saving…' : editMode ? '💾 Save Changes' : '💾 Save All'}
                    </button>
                </div>
            </div>

            {editMode && (
                <div style={{ background: 'rgba(0,87,255,.07)', border: '1.5px solid rgba(0,87,255,.18)', borderRadius: '12px', padding: '12px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
                    <span style={{ fontSize: '18px' }}>✏️</span>
                    <span>Editing questions for <strong>{presetTopicName}</strong>. Make changes and hit <strong>Save Changes</strong>.</span>
                </div>
            )}

            {!editMode && (
                <div className="tab-bar">
                    <button className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>✏️ Manual Entry</button>
                    <button className={`tab-btn ${activeTab === 'ai'     ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>🤖 AI Generated</button>
                </div>
            )}

            {(activeTab === 'manual' || editMode) && (
                <div className="add-layout">
                    <div>
                        <div className="builder-area">
                            {questions.map((q, idx) => (
                                <div key={q.id} className={`q-card ${collapsedCards[q.id] ? 'collapsed' : ''}`}>
                                    <div className="q-card-header" onClick={() => toggleCollapse(q.id)}>
                                        <div className="q-card-num">{idx + 1}</div>
                                        <div className={`q-card-preview ${q.text ? 'has-text' : ''}`}>
                                            {q.text ? (() => { const plain = q.text.replace(/<[^>]+>/g, '').trim(); return plain.length > 70 ? plain.slice(0, 70) + '…' : plain || 'New Question'; })() : 'New Question'}
                                        </div>
                                        {q.apiId && (
                                            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', background: 'rgba(0,87,255,.1)', color: '#0057ff', whiteSpace: 'nowrap', flexShrink: 0 }}>Existing</span>
                                        )}
                                        <div className="q-card-actions" onClick={e => e.stopPropagation()}>
                                            <div className="q-card-collapse" onClick={() => toggleCollapse(q.id)}>{collapsedCards[q.id] ? '▼' : '▲'}</div>
                                            <div className="q-card-del" onClick={() => removeQuestion(q.id)}>🗑</div>
                                        </div>
                                    </div>

                                    <div className="q-card-body">
                                        <div className="section-divider"><div className="section-divider-line" /><div className="section-divider-text">Question Type</div><div className="section-divider-line" /></div>
                                        <div className="type-selector">
                                            {[
                                                { key: 'MCQ',          icon: '🔘', name: 'Single Select', desc: 'One correct answer'  },
                                                { key: 'Multi-Select', icon: '☑️', name: 'Multi-Select',  desc: 'Multiple correct'    },
                                                { key: 'Text',         icon: '📝', name: 'Open Text',     desc: 'Free-form answer'    },
                                                { key: 'Image',        icon: '🖼️', name: 'Image Select',  desc: 'Pick correct image'  },
                                            ].map(t => (
                                                <div key={t.key} className={`type-opt t-${t.key.toLowerCase().replace('-select','')} ${q.type === t.key ? 'selected' : ''}`} onClick={() => handleTypeSelect(q.id, t.key as QuestionType)}>
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
                                                    {realTopics.map(t => <option key={t.topicId ?? t.id} value={t.topicId ?? t.id}>{t.name}</option>)}
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
                                                <RichTextEditor
                                                    key={`rte-${q.id}`}
                                                    value={q.text}
                                                    onChange={(html: string) => updateQuestion(q.id, { text: html })}
                                                    placeholder="Type the question here…"
                                                    minHeight={130}
                                                />
                                            </div>
                                        </div>

                                        {q.type === '' && (
                                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', border: '1.5px dashed var(--border)', borderRadius: '10px' }}>
                                                ↑ Select a question type to configure answer options
                                            </div>
                                        )}
                                        {(q.type === 'MCQ' || q.type === 'Multi-Select') && renderOptions(q)}
                                        {q.type === 'Text' && (
                                            <>
                                                <div className="section-divider"><div className="section-divider-line" /><div className="section-divider-text">Model Answer</div><div className="section-divider-line" /></div>
                                                <div className="form-group">
                                                    <label>Model / Expected Answer</label>
                                                    <textarea placeholder="Enter the expected answer…" rows={4} value={q.textAnswer} onChange={e => updateQuestion(q.id, { textAnswer: e.target.value })} />
                                                </div>
                                            </>
                                        )}
                                        {q.type === 'Image' && renderImageOptions(q)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="add-q-btn" style={{ marginTop: '12px' }} onClick={() => handleAddQuestion()}>
                            <span>＋</span> Add {editMode ? 'New' : 'Another'} Question
                        </button>
                    </div>

                    <div className="right-panel">
                        <div className="info-panel">
                            <div className="info-panel-header"><div className="info-panel-title">📋 {editMode ? 'Edit Summary' : 'Session Summary'}</div></div>
                            <div className="info-panel-body">
                                <div className="summary-count">{questions.length}</div>
                                <div className="summary-label">{editMode ? `${questions.filter(q => !!q.apiId).length} existing · ${questions.filter(q => !q.apiId).length} new` : 'Question(s) in this session'}</div>
                                <div>
                                    {[
                                        { label: 'MCQ',          color: 'var(--accent2)', type: 'MCQ'          },
                                        { label: 'Multi-Select', color: 'var(--purple)',  type: 'Multi-Select' },
                                        { label: 'Open Text',    color: 'var(--yellow)',  type: 'Text'         },
                                        { label: 'Image Select', color: 'var(--green)',   type: 'Image'        },
                                    ].map(row => (
                                        <div className="summary-type-row" key={row.type}>
                                            <span className="summary-type-name"><span className="summary-type-dot" style={{ background: row.color }} />{row.label}</span>
                                            <span className="summary-type-num">{questions.filter(q => q.type === row.type).length}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="save-all-row">
                                    <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => saveAll()} disabled={isSaving}>
                                        {isSaving ? 'Saving…' : editMode ? '💾 Save Changes' : '💾 Save as Published'}
                                    </button>
                                    {!editMode && (
                                        <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={() => saveAll(true)} disabled={isSaving}>📄 Save as Draft</button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {!editMode && (
                            <div className="info-panel">
                                <div className="info-panel-header">
                                    <div className="info-panel-title">🤖 AI Generator</div>
                                </div>
                                <div className="info-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                                        Use the AI Generator to create questions with full control over difficulty mix, question type distribution and batch generation.
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        style={{ justifyContent: 'center' }}
                                        onClick={() => navigate('/ai-generator')}>
                                        ✨ Open AI Generator
                                    </button>
                                    <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>
                                        Generate questions then save them to any topic from there.
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="info-panel">
                            <div className="info-panel-header"><div className="info-panel-title">💡 Tips</div></div>
                            <div className="info-panel-body">
                                {(editMode ? [
                                    { icon: '✏️', text: 'All existing questions are pre-loaded. Edit any field and save.' },
                                    { icon: '➕', text: '"Add New Question" appends extra questions to this topic.' },
                                    { icon: '🔵', text: '"Existing" badge = already in DB (updated via PUT).' },
                                ] : [
                                    { icon: '🎯', text: 'Click the radio circle to mark the correct answer.' },
                                    { icon: '✅', text: 'Multi-Select allows multiple correct answers.' },
                                    { icon: '🖼️', text: 'Images compressed to 300×300 WebP automatically.' },
                                    { icon: '📝', text: 'Open Text: enter a model answer for grading reference.' },
                                    { icon: '🤖', text: 'Use AI Generate to create questions instantly.' },
                                ]).map((tip, i) => (
                                    <div className="tip-row" key={i}><div className="tip-icon">{tip.icon}</div><div className="tip-text">{tip.text}</div></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'ai' && !editMode && (
                <div style={{ maxWidth: '500px', margin: '60px auto', textAlign: 'center' }}>
                    <div style={{ fontSize: '52px', marginBottom: '16px' }}>🤖</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: 'var(--ink)' }}>
                        AI Question Generator
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '28px' }}>
                        The AI Generator has moved to a dedicated page with full distribution controls — set difficulty mix, question type percentages, and generate in batches.
                    </div>
                    <button
                        className="btn btn-primary"
                        style={{ justifyContent: 'center', padding: '12px 32px', fontSize: '15px' }}
                        onClick={() => navigate('/ai-generator')}>
                        ✨ Open AI Generator
                    </button>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px' }}>
                        You can save generated questions to any topic from there.
                    </div>
                </div>
            )}

            <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : '#0d1117' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default AddQuestions;