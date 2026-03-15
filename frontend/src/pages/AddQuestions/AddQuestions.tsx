import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { topicsApi, questionsApi } from '../../services/api';
import { compressImage } from '../../utils/compressImage';
import './AddQuestions.css';

type QuestionType      = 'MCQ' | 'Multi-Select' | 'Text' | 'Image' | '';
type DifficultyStatus  = 'Easy' | 'Medium' | 'Hard' | '';

// ── Image option: text = label, imageUrl = URL stored in Options.ImageUrl ──
interface ImageOption {
    label:    string;   // → Options.Text
    imageUrl: string;   // → Options.ImageUrl
    isCorrect: boolean; // → Options.IsCorrect
}

interface Question {
    id:           number;
    apiId?:       string;
    type:         QuestionType;
    text:         string;        // → questionText (the question itself)
    topic:        string;
    level:        DifficultyStatus;
    status:       'Active' | 'Draft';
    // MCQ / Multi-Select
    options:      string[];
    correct:      number | number[];
    // Open Text — model answer → sent as textAnswer → stored in Questions.Text (DB)
    textAnswer:   string;
    // Image Select — each item has label + imageUrl + isCorrect
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

const EMPTY_IMAGE_OPT = (): ImageOption => ({ label: '', imageUrl: '', isCorrect: false });

// ── Map raw API question → local Question ──────────────────────────────
const mapApiQuestion = (q: any, localId: number, fallbackTopicId: string): Question => {
    const rawOpts = q.options ?? q.answerOptions ?? [];
    const optStrings: string[] = Array.isArray(rawOpts)
        ? rawOpts.map((o: any) => (typeof o === 'string' ? o : o.text ?? o.optionText ?? ''))
        : [];

    let type: QuestionType = 'MCQ';
    const rawType = (q.questionType ?? q.type ?? '').toLowerCase();
    if      (rawType.includes('multi'))                              type = 'Multi-Select';
    else if (rawType.includes('text') || rawType.includes('open'))   type = 'Text';
    else if (rawType.includes('image'))                              type = 'Image';
    else                                                             type = 'MCQ';

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

    // Image options from API
    const imageOptions: ImageOption[] = type === 'Image' && Array.isArray(rawOpts)
        ? rawOpts.map((o: any) => ({
            label:     typeof o === 'string' ? o : (o.text ?? o.optionText ?? ''),
            imageUrl:  typeof o === 'object' ? (o.imageUrl ?? '') : '',
            isCorrect: typeof o === 'object' ? (o.isCorrect ?? false) : false,
        }))
        : [EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT()];

    return {
        id:           localId,
        apiId:        String(q.id ?? q.questionId ?? ''),
        type,
        text:         q.questionText ?? q.text ?? '',
        topic:        q.topicId ?? q.topic ?? fallbackTopicId,
        level,
        status:       q.status === 'Draft' ? 'Draft' : 'Active',
        options:      optStrings.length ? optStrings : (type !== 'Text' && type !== 'Image' ? ['', '', '', ''] : []),
        correct,
        textAnswer:   q.textAnswer ?? q.modelAnswer ?? '',
        imageOptions,
    };
};

// ── Build Options payload for MCQ / Multi-Select ──────────────────────
// → Options table: { Text, IsCorrect, ImageUrl }
const buildMCQOptions = (q: Question) =>
    q.options.map((text, i) => ({
        text,
        isCorrect: Array.isArray(q.correct) ? q.correct.includes(i) : q.correct === i,
        imageUrl:  '',
    }));

// ── Build Options payload for Image Select ────────────────────────────
// → Options table: { Text(label), IsCorrect, ImageUrl }
const buildImageOptions = (q: Question) =>
    q.imageOptions.map(opt => ({
        text:      opt.label,       // Options.Text  = label
        isCorrect: opt.isCorrect,   // Options.IsCorrect
        imageUrl:  opt.imageUrl,    // Options.ImageUrl  ← the actual image URL
    }));

// ─────────────────────────────────────────────────────────────────────
const AddQuestions: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const routeState          = (location.state as any) ?? {};
    const editMode            = !!routeState.editMode;
    const presetTopicId       = routeState.topicId    ?? '';
    const presetTopicVersionId = routeState.topicVersionId ?? ''; 
    const presetTopicName     = routeState.topicName  ?? '';
    const existingQuestions: any[] = routeState.existingQuestions ?? [];

    const [activeTab,       setActiveTab]       = useState<'manual' | 'ai'>('manual');
    const [questions,       setQuestions]       = useState<Question[]>([]);
    const [qCounter,        setQCounter]        = useState(0);
    const [collapsedCards,  setCollapsedCards]  = useState<Record<number, boolean>>({});
    const [realTopics,      setRealTopics]      = useState<any[]>([]);
    const [isSaving,        setIsSaving]        = useState(false);
    const [toast,           setToast]           = useState({ show: false, msg: '', type: 'success' });
    const [importedIds,     setImportedIds]     = useState<Set<string>>(new Set());

    // Sidebar AI
    const [aiTopic,       setAiTopic]       = useState('');
    const [aiLevel,       setAiLevel]       = useState('');
    const [aiType,        setAiType]        = useState('');
    const [aiCount,       setAiCount]       = useState(3);
    const [isGenerating,  setIsGenerating]  = useState(false);
    const [aiResults,     setAiResults]     = useState<any[]>([]);

    // Full-tab AI
    const [ai2Topic,      setAi2Topic]      = useState('');
    const [ai2Level,      setAi2Level]      = useState('');
    const [ai2Type,       setAi2Type]       = useState('');
    const [ai2Count,      setAi2Count]      = useState(3);
    const [isGenerating2, setIsGenerating2] = useState(false);
    const [ai2Results,    setAi2Results]    = useState<any[]>([]);
    const [ai2Prompt,     setAi2Prompt]     = useState('');

    // ── On mount ────────────────────────────────────────────────────
    useEffect(() => {
    topicsApi.getAll().then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? res.data?.data ?? []);
        setRealTopics(list);
    }).catch(() => showToast('Failed to load topics', 'error'));

    if (editMode && existingQuestions.length > 0) {
        // Step 1: Prefill immediately from navigation state — always works
        let ctr = 0;
        const prefilled = existingQuestions.map(q => mapApiQuestion(q, ++ctr, presetTopicId));
        setQCounter(ctr);
        setQuestions(prefilled);

        // Step 2: Background re-fetch using topicVersionId to get
        // textAnswer (OpenText) and imageUrl (ImageSelect) which may
        // be missing from the navigation state if fetched before DTO fix
        if (presetTopicVersionId) {
            questionsApi.getAllByTopic(presetTopicVersionId)
                .then(res => {
                    const fresh: any[] = Array.isArray(res.data)
                        ? res.data
                        : (res.data?.items ?? res.data?.data ?? res.data?.questions ?? []);

                    if (!fresh.length) return;

                    // Map fresh data by question ID for fast lookup
                    const freshMap = new Map<string, any>();
                    fresh.forEach(q => {
                        const id = String(q.id ?? q.questionId ?? '');
                        if (id) freshMap.set(id, q);
                    });

                    // Patch only Text and Image type questions with fresh data
                    setQuestions(prev => prev.map(q => {
                        if (!q.apiId) return q;
                        const f = freshMap.get(q.apiId);
                        if (!f) return q;

                        if (q.type === 'Text') {
                            return {
                                ...q,
                                textAnswer: f.textAnswer ?? f.modelAnswer ?? q.textAnswer,
                            };
                        }

                        if (q.type === 'Image') {
                            const freshOpts = f.options ?? [];
                            if (freshOpts.length > 0) {
                                return {
                                    ...q,
                                    imageOptions: freshOpts.map((o: any) => ({
                                        label:     o.text      ?? '',
                                        imageUrl:  o.imageUrl  ?? '',
                                        isCorrect: o.isCorrect ?? false,
                                    })),
                                };
                            }
                        }

                        return q;
                    }));
                })
                .catch(() => {
                    // Silent — questions already shown from Step 1
                });
        }
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
                    if (type === 'MCQ'          && Array.isArray(next.correct))         next.correct = next.correct[0] ?? 0;
                    if (type === 'Multi-Select' && typeof next.correct === 'number') next.correct = [next.correct];
                }
            }
            if (type === 'Image' && (!next.imageOptions || next.imageOptions.length === 0)) {
                next.imageOptions = [EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT(), EMPTY_IMAGE_OPT()];
            }
            return next;
        }));
    };

    const toggleCollapse = (id: number) =>
        setCollapsedCards(prev => ({ ...prev, [id]: !prev[id] }));

    // ── MCQ / Multi-Select options builder ──────────────────────────
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
            } else {
                updateQuestion(q.id, { correct: idx });
            }
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

    // ── Image Select builder ─────────────────────────────────────────
    // Each card: upload image file → convert to base64 URL or use URL input
    // Stores: Options.Text = label, Options.ImageUrl = URL, Options.IsCorrect
    const ImageOptionBuilder = ({ q }: { q: Question }) => {
        const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

        const updateImageOpt = (idx: number, updates: Partial<ImageOption>) => {
            const opts = [...q.imageOptions];
            opts[idx] = { ...opts[idx], ...updates };
            updateQuestion(q.id, { imageOptions: opts });
        };

        const setCorrect = (idx: number) => {
            const opts = q.imageOptions.map((o, i) => ({ ...o, isCorrect: i === idx }));
            updateQuestion(q.id, { imageOptions: opts });
        };

        const handleFileChange = (idx: number, file: File | null) => {
            if (!file) return;
            // Convert to base64 data URL — stored in Options.ImageUrl
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                updateImageOpt(idx, { imageUrl: dataUrl });
            };
            reader.readAsDataURL(file);
        };

        const addImageOpt = () => {
            if (q.imageOptions.length >= 6) { showToast('Max 6 image options.', 'error'); return; }
            updateQuestion(q.id, { imageOptions: [...q.imageOptions, EMPTY_IMAGE_OPT()] });
        };

        const removeImageOpt = (idx: number) => {
            if (q.imageOptions.length <= 2) { showToast('Min 2 image options.', 'error'); return; }
            const opts = q.imageOptions.filter((_, i) => i !== idx);
            updateQuestion(q.id, { imageOptions: opts });
        };

        return (
            <>
                <div className="section-divider">
                    <div className="section-divider-line"></div>
                    <div className="section-divider-text">Image Options — click ○ to mark correct</div>
                    <div className="section-divider-line"></div>
                </div>

                <div className="image-options-grid">
                    {q.imageOptions.map((opt, idx) => (
                        <div key={idx} className={`image-opt-card ${opt.isCorrect ? 'is-correct' : ''}`}>

                            {/* Correct marker */}
                            <div className="img-opt-correct-row">
                                <div
                                    className={`img-opt-radio ${opt.isCorrect ? 'selected' : ''}`}
                                    onClick={() => setCorrect(idx)}
                                    title="Mark as correct"
                                />
                                {opt.isCorrect && <span className="img-opt-correct-tag">✓ Correct</span>}
                                <button className="img-opt-del" onClick={() => removeImageOpt(idx)}>✕</button>
                            </div>

                            {/* Image preview / upload */}
                            <div
                                className="img-opt-preview"
                                onClick={() => fileRefs.current[idx]?.click()}
                                title="Click to upload image"
                            >
                                {opt.imageUrl ? (
                                    <img
                                        src={opt.imageUrl}
                                        alt={opt.label || `Option ${idx + 1}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                                    />
                                ) : (
                                    <div className="img-opt-placeholder">
                                        <div className="img-opt-placeholder-icon">🖼️</div>
                                        <div className="img-opt-placeholder-text">Click to upload</div>
                                    </div>
                                )}
                                {/* Hidden file input */}
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    ref={el => { fileRefs.current[idx] = el; }}
                                    onChange={e => handleFileChange(idx, e.target.files?.[0] ?? null)}
                                />
                            </div>

                            {/* URL input — alternative to file upload */}
                            <div className="img-opt-url-row">
                                <input
                                    className="img-opt-url-input"
                                    type="text"
                                    placeholder="or paste image URL…"
                                    value={opt.imageUrl.startsWith('data:') ? '' : opt.imageUrl}
                                    onChange={e => updateImageOpt(idx, { imageUrl: e.target.value })}
                                />
                            </div>

                            {/* Label input */}
                            <input
                                className="img-opt-label-input"
                                type="text"
                                placeholder={`Label (e.g. Option ${String.fromCharCode(65 + idx)})`}
                                value={opt.label}
                                onChange={e => updateImageOpt(idx, { label: e.target.value })}
                            />
                        </div>
                    ))}
                </div>

                <button className="add-option-btn" style={{ marginTop: '10px' }} onClick={addImageOpt}>
                    🖼️ + Add Image Option
                </button>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                    Upload an image file or paste a URL. Click the radio circle to mark the correct option.
                    Image URL is stored in <code style={{ background: 'rgba(0,87,255,.08)', color: 'var(--accent2)', padding: '1px 5px', borderRadius: '4px' }}>Options.ImageUrl</code>.
                </div>
            </>
        );
    };

    // ── AI generation ────────────────────────────────────────────────
    const runGenerate = (
        topic: string, level: string, count: number,
        setResults: (r: any[]) => void,
        setGenerating: (b: boolean) => void,
    ) => {
        if (!topic) { showToast('Please select a topic.', 'error'); return; }
        setGenerating(true);
        setTimeout(() => {
            const topicName = realTopics.find(t => (t.topicId ?? t.id) === topic)?.name || 'Topic';
            const templates = [
                { text: `What is a key concept in ${topicName}?`,               type: 'MCQ'          as any, options: ['Concept A', 'Concept B', 'Concept C', 'Concept D'], correct: 1,      textAnswer: '', imageOptions: [] },
                { text: `Which features belong to ${topicName}? (select all)`,  type: 'Multi-Select' as any, options: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4'], correct: [0, 1], textAnswer: '', imageOptions: [] },
                { text: `What does the main function do in ${topicName}?`,       type: 'MCQ'          as any, options: ['Option A', 'Option B', 'Option C', 'Option D'],     correct: 2,      textAnswer: '', imageOptions: [] },
                { text: `Explain the purpose of ${topicName}.`,                  type: 'Text'         as any, options: [], correct: 0, textAnswer: 'Model answer here.',     imageOptions: [] },
                { text: `Which statement about ${topicName} is correct?`,        type: 'MCQ'          as any, options: ['A', 'B', 'C', 'D'], correct: 0,                     textAnswer: '', imageOptions: [] },
            ];
            setResults(templates.slice(0, count).map((t, i) => ({
                ...t, topic, level: level || ['Easy', 'Medium', 'Hard'][i % 3], status: 'Active', id: Date.now() + i,
            })));
            setGenerating(false);
        }, 1500);
    };

    const handleGenerateAI  = () => runGenerate(aiTopic,  aiLevel,  aiCount,  setAiResults,  setIsGenerating);
    const handleGenerateAI2 = () => runGenerate(ai2Topic, ai2Level, ai2Count, setAi2Results, setIsGenerating2);

    const importQuestion = (q: any, idx: number, key?: string) => {
        const k = key || `${q.id}-${idx}`;
        if (importedIds.has(k)) { showToast('Already added.', 'info'); return; }
        setImportedIds(prev => new Set(prev).add(k));
        handleAddQuestion({ ...q, imageOptions: q.imageOptions ?? [] });
        setActiveTab('manual');
        showToast('Question added to builder!');
    };

    // ── SAVE ─────────────────────────────────────────────────────────
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
                    if (filled.length < 2) {
                        showToast(`Q${idx + 1}: Add at least 2 image options.`, 'error'); return;
                    }
                    if (!q.imageOptions.some(o => o.isCorrect)) {
                        showToast(`Q${idx + 1}: Mark one image option as correct.`, 'error'); return;
                    }
                }
            }
        }

        setIsSaving(true);

        // ── Build options per type ───────────────────────────────────
        const getOptions = (q: Question) => {
            if (q.type === 'MCQ' || q.type === 'Multi-Select') return buildMCQOptions(q);
            if (q.type === 'Image')                            return buildImageOptions(q);
            return []; // Text type — no options
        };

        if (editMode) {
            let ok = 0, fail = 0;
            for (const q of questions) {
                try {
                    if (q.apiId) {
                        // PUT — UpdateQuestionRequestDto
                        const putPayload: any = {
                            questionText: q.text,
                            status:       q.status,
                        };
                        if (q.type === 'Text') {
                            // textAnswer → stored in Questions.Text (DB column)
                            putPayload.textAnswer = q.textAnswer;
                        } else {
                            putPayload.options = getOptions(q);
                        }
                        await questionsApi.update(q.apiId, putPayload);
                    } else {
                        // POST new question added during edit
                        const postPayload = {
                            isSaveAsDraft: isDraft,
                            questions: [{
                                questionText:   q.text,
                                topicId:        q.topic || presetTopicId,
                                levelId:        LEVEL_IDS[q.level] || LEVEL_IDS['Easy'],
                                questionTypeId: TYPE_IDS[q.type]   || TYPE_IDS['MCQ'],
                                options:        getOptions(q),
                                // textAnswer → Questions.Text DB column (model answer for open text)
                                textAnswer:     q.type === 'Text' ? q.textAnswer : '',
                            }],
                        };
                        await questionsApi.createMultiple(postPayload);
                    }
                    ok++;
                } catch { fail++; }
            }
            setIsSaving(false);
            if (fail === 0) { showToast(`✅ ${ok} question(s) saved!`); setTimeout(() => navigate('/topics'), 1500); }
            else showToast(`${ok} saved, ${fail} failed.`, 'error');

        } else {
            // POST all new questions
            try {
                const payload = {
                    isSaveAsDraft: isDraft,
                    questions: questions.map(q => ({
                        questionText:   q.text,
                        topicId:        q.topic || '00000000-0000-0000-0000-000000000000',
                        levelId:        LEVEL_IDS[q.level] || LEVEL_IDS['Easy'],
                        questionTypeId: TYPE_IDS[q.type]   || TYPE_IDS['MCQ'],
                        options:        getOptions(q),
                        // textAnswer → Questions.Text DB column (only for Text type questions)
                        textAnswer:     q.type === 'Text' ? q.textAnswer : '',
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
        }
    };

    // ── AI Result List ───────────────────────────────────────────────
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
                        const key  = `${keyPrefix}-${q.id}-${i}`;
                        const done = importedIds.has(key);
                        return (
                            <div key={i} className={`ai-result-card ${done ? 'imported' : ''}`} onClick={() => importQuestion(q, i, key)}>
                                <div className="ai-result-q">{q.text}</div>
                                <div className="ai-result-meta">
                                    <span className="ai-result-badge" style={{ background: 'rgba(0,87,255,.25)',   color: '#93c5fd' }}>{q.type}</span>
                                    <span className="ai-result-badge" style={{ background: 'rgba(0,194,113,.2)',   color: '#6ee7b7' }}>{q.level}</span>
                                    <span className="ai-result-import">{done ? '✓ Added' : '+ Add to Builder'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );

    // ── RENDER ───────────────────────────────────────────────────────
    return (
        <div className="add-questions-container">

            <div className="page-header">
                <div>
                    <div className="page-title">{editMode ? `Editing — ${presetTopicName}` : 'Add Questions'}</div>
                    <div className="page-sub">
                        {editMode
                            ? `${existingQuestions.length} question(s) loaded · edit and save to update`
                            : 'Build questions manually or generate them with AI.'}
                    </div>
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

            {/* ── MANUAL / EDIT TAB ── */}
            {(activeTab === 'manual' || editMode) && (
                <div className="add-layout">
                    <div>
                        <div className="builder-area">
                            {questions.map((q, idx) => (
                                <div key={q.id} className={`q-card ${collapsedCards[q.id] ? 'collapsed' : ''}`}>
                                    <div className="q-card-header" onClick={() => toggleCollapse(q.id)}>
                                        <div className="q-card-num">{idx + 1}</div>
                                        <div className={`q-card-preview ${q.text ? 'has-text' : ''}`}>
                                            {q.text ? (q.text.length > 70 ? q.text.slice(0, 70) + '…' : q.text) : 'New Question'}
                                        </div>
                                        {q.apiId && (
                                            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', background: 'rgba(0,87,255,.1)', color: '#0057ff', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                Existing
                                            </span>
                                        )}
                                        <div className="q-card-actions" onClick={e => e.stopPropagation()}>
                                            <div className="q-card-collapse" onClick={() => toggleCollapse(q.id)}>{collapsedCards[q.id] ? '▼' : '▲'}</div>
                                            <div className="q-card-del" onClick={() => removeQuestion(q.id)}>🗑</div>
                                        </div>
                                    </div>

                                    <div className="q-card-body">
                                        {/* Type selector */}
                                        <div className="section-divider">
                                            <div className="section-divider-line"></div>
                                            <div className="section-divider-text">Question Type</div>
                                            <div className="section-divider-line"></div>
                                        </div>
                                        <div className="type-selector">
                                            {[
                                                { key: 'MCQ',          icon: '🔘', name: 'Single Select',  desc: 'One correct answer'   },
                                                { key: 'Multi-Select', icon: '☑️', name: 'Multi-Select',   desc: 'Multiple correct'     },
                                                { key: 'Text',         icon: '📝', name: 'Open Text',      desc: 'Free-form answer'     },
                                                { key: 'Image',        icon: '🖼️', name: 'Image Select',   desc: 'Pick correct image'   },
                                            ].map(t => (
                                                <div
                                                    key={t.key}
                                                    className={`type-opt t-${t.key.toLowerCase().replace('-select', '')} ${q.type === t.key ? 'selected' : ''}`}
                                                    onClick={() => handleTypeSelect(q.id, t.key as QuestionType)}
                                                >
                                                    <div className="type-opt-icon">{t.icon}</div>
                                                    <div className="type-opt-name">{t.name}</div>
                                                    <div className="type-opt-desc">{t.desc}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Meta row */}
                                        <div className="form-row triple">
                                            <div className="form-group">
                                                <label>Topic <span style={{ color: 'var(--red)' }}>*</span></label>
                                                <select value={q.topic} onChange={e => updateQuestion(q.id, { topic: e.target.value })}>
                                                    <option value="">Select…</option>
                                                    {realTopics.map(t => (
                                                        <option key={t.topicId ?? t.id} value={t.topicId ?? t.id}>{t.name}</option>
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

                                        {/* Question text */}
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

                                        {/* Type-specific UI */}
                                        {q.type === '' && (
                                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', border: '1.5px dashed var(--border)', borderRadius: '10px' }}>
                                                ↑ Select a question type to configure answer options
                                            </div>
                                        )}

                                        {(q.type === 'MCQ' || q.type === 'Multi-Select') && <OptionBuilder q={q} />}

                                        {/* ── OPEN TEXT ── */}
                                        {q.type === 'Text' && (
                                            <>
                                                <div className="section-divider">
                                                    <div className="section-divider-line"></div>
                                                    <div className="section-divider-text">Model Answer</div>
                                                    <div className="section-divider-line"></div>
                                                </div>
                                                <div className="form-group">
                                                    <label>
                                                        Model / Expected Answer
                                                        <span style={{ fontSize: '11px', fontWeight: 600, background: 'rgba(0,87,255,.08)', color: 'var(--accent2)', padding: '2px 7px', borderRadius: '4px', marginLeft: '8px' }}>
                                                            → Questions.Text (DB)
                                                        </span>
                                                    </label>
                                                    <textarea
                                                        placeholder="Enter the expected answer for reference or auto-grading…"
                                                        rows={4}
                                                        value={q.textAnswer}
                                                        onChange={e => updateQuestion(q.id, { textAnswer: e.target.value })}
                                                    />
                                                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                                                        This is sent as <code style={{ background: 'rgba(0,87,255,.08)', color: 'var(--accent2)', padding: '1px 5px', borderRadius: '3px' }}>textAnswer</code> and stored in the <code style={{ background: 'rgba(0,87,255,.08)', color: 'var(--accent2)', padding: '1px 5px', borderRadius: '3px' }}>Text</code> column of the Questions table.
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* ── IMAGE SELECT ── */}
                                        {q.type === 'Image' && <ImageOptionBuilder q={q} />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="add-q-btn" style={{ marginTop: '12px' }} onClick={() => handleAddQuestion()}>
                            <span>＋</span> Add {editMode ? 'New' : 'Another'} Question
                        </button>
                    </div>

                    {/* Right Panel */}
                    <div className="right-panel">
                        <div className="info-panel">
                            <div className="info-panel-header">
                                <div className="info-panel-title">📋 {editMode ? 'Edit Summary' : 'Session Summary'}</div>
                            </div>
                            <div className="info-panel-body">
                                <div className="summary-count">{questions.length}</div>
                                <div className="summary-label">
                                    {editMode
                                        ? `${questions.filter(q => !!q.apiId).length} existing · ${questions.filter(q => !q.apiId).length} new`
                                        : 'Question(s) in this session'}
                                </div>
                                <div>
                                    {[
                                        { label: 'MCQ',          color: 'var(--accent2)', type: 'MCQ'          },
                                        { label: 'Multi-Select', color: 'var(--purple)',  type: 'Multi-Select' },
                                        { label: 'Open Text',    color: 'var(--yellow)',  type: 'Text'         },
                                        { label: 'Image Select', color: 'var(--green)',   type: 'Image'        },
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
                                        {isSaving ? 'Saving…' : editMode ? '💾 Save Changes' : '💾 Save as Published'}
                                    </button>
                                    {!editMode && (
                                        <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={() => saveAll(true)} disabled={isSaving}>
                                            📄 Save as Draft
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {!editMode && (
                            <div className="ai-panel">
                                <div className="ai-panel-header">
                                    <div className="ai-panel-title">🤖 AI Generator</div>
                                    <div className="ai-panel-sub">Generate from topic &amp; difficulty</div>
                                </div>
                                <div className="ai-panel-body">
                                    <div className="ai-input-group">
                                        <div className="ai-input-label">Topic</div>
                                        <select className="ai-select" value={aiTopic} onChange={e => setAiTopic(e.target.value)}>
                                            <option value="">Select topic…</option>
                                            {realTopics.map(t => <option key={t.topicId ?? t.id} value={t.topicId ?? t.id}>{t.name}</option>)}
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
                                        <div className="ai-input-label">Type</div>
                                        <select className="ai-select" value={aiType} onChange={e => setAiType(e.target.value)}>
                                            <option value="">Mixed</option>
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
                        )}

                        <div className="info-panel">
                            <div className="info-panel-header">
                                <div className="info-panel-title">💡 Tips</div>
                            </div>
                            <div className="info-panel-body">
                                {(editMode ? [
                                    { icon: '✏️', text: 'All existing questions are pre-loaded. Edit any field and save.' },
                                    { icon: '➕', text: '"Add New Question" appends extra questions to this topic.' },
                                    { icon: '🔵', text: '"Existing" badge = already in DB (updated via PUT).' },
                                ] : [
                                    { icon: '🎯', text: 'Click the radio circle to mark the correct answer.' },
                                    { icon: '✅', text: 'Multi-Select allows multiple correct answers.' },
                                    { icon: '🖼️', text: 'Image Select: upload a file or paste a URL for each option.' },
                                    { icon: '📝', text: 'Open Text: the model answer is stored in Questions.Text.' },
                                    { icon: '🤖', text: 'Use AI Generate to create questions instantly.' },
                                ]).map((tip, i) => (
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
            {activeTab === 'ai' && !editMode && (
                <div style={{ maxWidth: '760px', margin: '0 auto' }}>
                    <div className="ai-panel">
                        <div className="ai-panel-header" style={{ padding: '24px 28px 16px' }}>
                            <div className="ai-panel-title" style={{ fontSize: '20px' }}>🤖 AI Question Generator</div>
                            <div className="ai-panel-sub" style={{ fontSize: '13px', marginTop: '6px' }}>Generate high-quality questions instantly.</div>
                        </div>
                        <div className="ai-panel-body" style={{ padding: '0 28px 28px' }}>
                            <div className="form-row triple" style={{ marginBottom: '14px' }}>
                                <div className="ai-input-group" style={{ marginBottom: 0 }}>
                                    <div className="ai-input-label">Topic</div>
                                    <select className="ai-select" value={ai2Topic} onChange={e => setAi2Topic(e.target.value)}>
                                        <option value="">Select topic…</option>
                                        {realTopics.map(t => <option key={t.topicId ?? t.id} value={t.topicId ?? t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="ai-input-group" style={{ marginBottom: 0 }}>
                                    <div className="ai-input-label">Difficulty</div>
                                    <select className="ai-select" value={ai2Level} onChange={e => setAi2Level(e.target.value)}>
                                        <option value="">Any</option>
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
                                <input type="text" className="ai-input" placeholder="e.g. Focus on ES6 features…"
                                    value={ai2Prompt} onChange={e => setAi2Prompt(e.target.value)} />
                            </div>
                            <div className="ai-input-label" style={{ color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>Number of questions</div>
                            <div className="ai-count-row" style={{ marginBottom: '14px' }}>
                                {[3, 5, 10, 15, 20].map(n => (
                                    <div key={n} className={`ai-count-btn ${ai2Count === n ? 'selected' : ''}`} onClick={() => setAi2Count(n)}>{n}</div>
                                ))}
                            </div>
                            <button className="ai-generate-btn" onClick={handleGenerateAI2} disabled={isGenerating2}>
                                {isGenerating2 ? 'Generating…' : '✨ Generate Now'}
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

            {/* Toast */}
            <div className={`toast ${toast.show ? 'show' : ''}`}
                style={{ background: toast.type === 'error' ? '#c0392b' : '#0d1117' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default AddQuestions;
