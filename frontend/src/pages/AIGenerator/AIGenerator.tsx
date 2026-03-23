import React, { useState, useEffect, useCallback } from 'react';
import { topicsApi, aiQuestionsApi, questionsApi, levelsApi, questionTypesApi } from '../../services/api';
import './AIGenerator.css';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LookupItem { id: string; name: string; }

interface DistSlice {
    key:     string;   // display name
    apiKey:  string;   // sent to AI
    pct:     number;   // 0-100
    color:   string;
}

interface AIOption {
    text:     string;
    correct:  boolean;
    imageUrl: string | null;
}

interface AIQuestion {
    id:        number;
    text:      string;
    type:      string;   // display label
    level:     string;   // display label
    topicName: string;
    topicId?:  string;   // actual DB GUID — stored per question for accurate saving
    options:   AIOption[];
    textAnswer?: string;
    saved:     boolean;
    error?:    string;   // if this batch item failed
}

interface BatchJob {
    level:     string;
    type:      string;
    count:     number;
    apiLevel:  string;
    apiType:   string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_DB: Record<string, string> = {
    'Single Select': 'Single Select',
    'Multi Select':  'Multi Select',
    'Open Text':     'Open Text',
    'Image Select':  'Image Select',
};

// ── Seeded GUIDs from TestBuddyDbContext.OnModelCreating ─────────────────────
// These match the HasData() seed exactly — used as fallback if /api/levels
// or /api/question-types are unavailable.
const LEVEL_GUID_FALLBACK: Record<string, string> = {
    'Easy':   '11111111-1111-1111-1111-111111111111',
    'Medium': '22222222-2222-2222-2222-222222222222',
    'Hard':   '33333333-3333-3333-3333-333333333333',
};
const TYPE_GUID_FALLBACK: Record<string, string> = {
    'Single Select': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Multi Select':  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Open Text':     'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Image Select':  'dddddddd-dddd-dddd-dddd-dddddddddddd',
};
const LEVEL_COLORS  = ['#16a34a','#f59e0b','#ef4444'];
const TYPE_COLORS   = ['#2563eb','#7c3aed','#0891b2','#d97706'];

// ─── Distribute total count by percentages ────────────────────────────────────
function distribute(total: number, slices: DistSlice[]): number[] {
    const active = slices.filter(s => s.pct > 0);
    if (active.length === 0) return slices.map(() => 0);
    const raw    = slices.map(s => (s.pct / 100) * total);
    const floors = raw.map(Math.floor);
    let   rem    = total - floors.reduce((a, b) => a + b, 0);
    // Distribute remainder to highest fractional parts
    const order  = raw.map((v, i) => ({ i, frac: v - Math.floor(v) }))
                      .sort((a, b) => b.frac - a.frac);
    order.forEach(({ i }) => { if (rem > 0) { floors[i]++; rem--; } });
    return floors;
}

// ─── Percentage slider row ────────────────────────────────────────────────────
const SliceRow: React.FC<{
    label:    string;
    pct:      number;
    color:    string;
    count:    number;
    onChange: (v: number) => void;
}> = ({ label, pct, color, count, onChange }) => (
    <div className="slice-row">
        <div className="slice-label">
            <span className="slice-dot" style={{ background: color }} />
            <span>{label}</span>
        </div>
        <div className="slice-slider-wrap">
            <input type="range" min={0} max={100} step={5} value={pct}
                onChange={e => onChange(Number(e.target.value))}
                className="slice-slider"
                style={{ '--thumb-color': color } as React.CSSProperties} />
        </div>
        <div className="slice-pct" style={{ color }}>{pct}%</div>
        <div className="slice-count">{count}Q</div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const AIGenerator: React.FC = () => {
    // ── Form ──────────────────────────────────────────────────────────────────
    const [selectedTopicId, setSelectedTopicId] = useState('');
    const [topicMode,       setTopicMode]       = useState<'existing' | 'new'>('existing');
    const [newTopicName,    setNewTopicName]    = useState('');
    const [totalCount,      setTotalCount]      = useState(10);

    // ── Difficulty distribution ───────────────────────────────────────────────
    const [levelDist, setLevelDist] = useState<DistSlice[]>([
        { key: 'Easy',   apiKey: 'Easy',   pct: 33, color: LEVEL_COLORS[0] },
        { key: 'Medium', apiKey: 'Medium', pct: 34, color: LEVEL_COLORS[1] },
        { key: 'Hard',   apiKey: 'Hard',   pct: 33, color: LEVEL_COLORS[2] },
    ]);

    // ── Type distribution ─────────────────────────────────────────────────────
    const [typeDist, setTypeDist] = useState<DistSlice[]>([
        { key: 'Single Select', apiKey: 'SingleSelect', pct: 60, color: TYPE_COLORS[0] },
        { key: 'Multi Select',  apiKey: 'MultiSelect',  pct: 20, color: TYPE_COLORS[1] },
        { key: 'Open Text',     apiKey: 'OpenText',     pct: 20, color: TYPE_COLORS[2] },
        { key: 'Image Select',  apiKey: 'ImageSelect',  pct: 0,  color: TYPE_COLORS[3] },
    ]);

    // ── Lookup data ───────────────────────────────────────────────────────────
    const [topics,        setTopics]        = useState<any[]>([]);
    const [levels,        setLevels]        = useState<LookupItem[]>([]);
    const [questionTypes, setQuestionTypes] = useState<LookupItem[]>([]);

    // ── Generation state ──────────────────────────────────────────────────────
    const [viewState,      setViewState]      = useState<'empty'|'loading'|'results'>('empty');
    const [questions,      setQuestions]      = useState<AIQuestion[]>([]);
    const [batchProgress,  setBatchProgress]  = useState({ done: 0, total: 0, current: '' });
    const [isSavingAll,    setIsSavingAll]    = useState(false);

    const [discardedCount, setDiscardedCount] = useState(0);
    const [toast,          setToast]          = useState({ show: false, msg: '', type: 'success' });

    // ── Load lookups on mount ─────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            const [tRes, lRes, qtRes] = await Promise.allSettled([
                topicsApi.getAll(),
                levelsApi.getAll(),
                questionTypesApi.getAll(),
            ]);
            if (tRes.status  === 'fulfilled') {
                const list = Array.isArray(tRes.value.data) ? tRes.value.data : tRes.value.data?.items ?? [];
                setTopics(list);
                if (list.length > 0) setSelectedTopicId(list[0].id ?? list[0].topicId ?? '');
            }
            if (lRes.status  === 'fulfilled') setLevels(Array.isArray(lRes.value.data)  ? lRes.value.data  : []);
            if (qtRes.status === 'fulfilled') setQuestionTypes(Array.isArray(qtRes.value.data) ? qtRes.value.data : []);
        })();
    }, []);

    const showToast = (msg: string, type: 'success'|'info'|'error' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(p => ({ ...p, show: false })), 3500);
    };

    // ── Validation ────────────────────────────────────────────────────────────
    const levelTotal = levelDist.reduce((a, s) => a + s.pct, 0);
    const typeTotal  = typeDist.reduce((a,  s) => a + s.pct, 0);
    const isValid    = levelTotal === 100 && typeTotal === 100
                    && (topicMode === 'existing' ? !!selectedTopicId : newTopicName.trim().length > 0)
                    && totalCount > 0;

    const updateLevelPct = (idx: number, val: number) => {
        setLevelDist(prev => prev.map((s, i) => i === idx ? { ...s, pct: val } : s));
    };
    const updateTypePct  = (idx: number, val: number) => {
        setTypeDist(prev => prev.map((s, i) => i === idx ? { ...s, pct: val } : s));
    };

    // ── Computed counts ───────────────────────────────────────────────────────
    const levelCounts = distribute(totalCount, levelDist);
    const typeCounts  = distribute(totalCount, typeDist);

    // ── Build batch jobs ──────────────────────────────────────────────────────
    // For each level × type combination where both have allocated count
    const buildJobs = useCallback((): BatchJob[] => {
        const jobs: BatchJob[] = [];
        levelDist.forEach((lv, li) => {
            const lvCount = levelCounts[li];
            if (lvCount === 0) return;
            typeDist.forEach((ty, ti) => {
                const tyCount = typeCounts[ti];
                if (tyCount === 0) return;
                // Split level count proportionally by type
                const jobCount = Math.round((lv.pct / 100) * (ty.pct / 100) * totalCount);
                if (jobCount === 0) return;
                jobs.push({
                    level:    lv.key,
                    type:     ty.key,
                    count:    jobCount,
                    apiLevel: lv.apiKey,
                    apiType:  ty.apiKey,
                });
            });
        });
        // Adjust for rounding: total of all jobs should equal totalCount
        const jobTotal = jobs.reduce((a, j) => a + j.count, 0);
        if (jobs.length > 0 && jobTotal !== totalCount) {
            jobs[0].count += totalCount - jobTotal;
        }
        return jobs.filter(j => j.count > 0);
    }, [levelDist, typeDist, levelCounts, typeCounts, totalCount]);

    // ── Lookup helpers ────────────────────────────────────────────────────────
    const getTopicName = () => {
        if (topicMode === 'new') return newTopicName.trim();
        const t = topics.find(t => (t.id ?? t.topicId) === selectedTopicId);
        return t?.name ?? t?.Name ?? '';
    };
    const getLevelId = (label: string): string =>
        levels.find(l => l.name.toLowerCase() === label.toLowerCase())?.id
        ?? LEVEL_GUID_FALLBACK[label]   // fallback to seeded GUID
        ?? '';

    const getTypeId = (label: string): string => {
        const dbName = TYPE_DB[label] ?? label;
        return questionTypes.find(t => t.name.toLowerCase() === dbName.toLowerCase())?.id
            ?? TYPE_GUID_FALLBACK[label]   // fallback to seeded GUID
            ?? '';
    };

    // ── Generate ──────────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (topicMode === 'existing' && !selectedTopicId) { showToast('Please select a topic', 'error'); return; }
        if (topicMode === 'new' && !newTopicName.trim()) { showToast('Please enter a new topic name', 'error'); return; }
        if (levelTotal !== 100) { showToast(`Difficulty must total 100% (currently ${levelTotal}%)`, 'error'); return; }
        if (typeTotal  !== 100) { showToast(`Question type must total 100% (currently ${typeTotal}%)`, 'error'); return; }

        // ── If new topic mode: create topic first, get its ID ─────────────────
        let activeTopicId = selectedTopicId;
        if (topicMode === 'new') {
            try {
                showToast(`Creating topic "${newTopicName.trim()}"…`, 'info');
                const res = await topicsApi.create({ name: newTopicName.trim() });
                // Response shape: { topicId, id, name } — try all
                const createdId = res.data?.topicId ?? res.data?.id ?? res.data?.Id ?? '';
                if (!createdId) throw new Error('No topic ID returned');
                activeTopicId = createdId;
                setSelectedTopicId(createdId);
                setTopicMode('existing');
                // Refresh topics list
                const topicsRes = await topicsApi.getAll();
                const list = Array.isArray(topicsRes.data) ? topicsRes.data : topicsRes.data?.items ?? [];
                setTopics(list);
                showToast(`Topic "${newTopicName.trim()}" created!`);
                setNewTopicName('');
            } catch (err: any) {
                showToast(`Failed to create topic: ${err?.response?.data?.message ?? err?.message ?? 'Unknown error'}`, 'error');
                return;
            }
        }

        const topicName = getTopicName() || newTopicName.trim();
        const jobs      = buildJobs();

        if (jobs.length === 0) { showToast('No questions to generate', 'error'); return; }

        setViewState('loading');
        setQuestions([]);
        setBatchProgress({ done: 0, total: jobs.length, current: '' });

        // Store activeTopicId in a local var so buildPayload can use it
        // (setSelectedTopicId is async and may not be ready yet)
        const finalTopicId = activeTopicId;

        const allQuestions: AIQuestion[] = [];
        let idCounter = Date.now();

        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            setBatchProgress({
                done:    i,
                total:   jobs.length,
                current: `${job.level} · ${job.type} (${job.count}Q)`,
            });

            try {
                const res = await aiQuestionsApi.generate({
                    topic:         topicName,
                    level:         job.apiLevel,
                    questionType:  job.apiType,
                    questionCount: job.count,
                });
                const raw: any[] = Array.isArray(res.data) ? res.data : [];
                raw.forEach(q => {
                    allQuestions.push({
                        id:        idCounter++,
                        text:      q.questionText ?? q.QuestionText ?? '',
                        type:      job.type,
                        level:     job.level,
                        topicName,
                        topicId:   finalTopicId,
                        options:   (q.options ?? q.Options ?? []).map((o: any) => ({
                            text:     o.text      ?? o.Text      ?? '',
                            correct:  o.isCorrect ?? o.IsCorrect ?? false,
                            imageUrl: o.imageUrl  ?? o.ImageUrl  ?? null,
                        })),
                        textAnswer: q.textAnswer ?? q.TextAnswer ?? undefined,
                        saved: false,
                    });
                });
            } catch {
                allQuestions.push({
                    id:        idCounter++,
                    text:      `⚠ Failed to generate ${job.count} ${job.level} ${job.type} questions`,
                    type:      job.type,
                    level:     job.level,
                    topicName,
                    topicId:   finalTopicId,
                    options:   [],
                    saved:     false,
                    error:     'generation_failed',
                });
            }
        }

        setBatchProgress(p => ({ ...p, done: jobs.length, current: 'Done!' }));

        setTimeout(() => {
            const validQs = allQuestions.filter(q => !q.error);
            setQuestions(allQuestions);
            setViewState('results');
            showToast(`${validQs.length} questions generated successfully!`);
        }, 400);
    };

    // ── Save ──────────────────────────────────────────────────────────────────
    const buildPayload = (q: AIQuestion) => ({
        questionText:   q.text,
        topicId:        q.topicId ?? selectedTopicId,
        levelId:        getLevelId(q.level),
        questionTypeId: getTypeId(q.type),
        options:        q.options.map(o => ({ text: o.text, isCorrect: o.correct, imageUrl: o.imageUrl ?? '' })),
        textAnswer:     q.textAnswer ?? '',
    });

    const saveOne = async (id: number) => {
        const q = questions.find(q => q.id === id);
        if (!q || q.saved || q.error) return;
        try {
            await questionsApi.createMultiple({ isSaveAsDraft: false, questions: [buildPayload(q)] });
            setQuestions(prev => prev.map(qq => qq.id === id ? { ...qq, saved: true } : qq));
            showToast('Saved!');
        } catch { showToast('Failed to save', 'error'); }
    };

    const saveAll = async () => {
        const unsaved = questions.filter(q => !q.saved && !q.error);
        if (unsaved.length === 0) { showToast('All saved already.', 'info'); return; }
        setIsSavingAll(true);
        try {
            await questionsApi.createMultiple({ isSaveAsDraft: false, questions: unsaved.map(buildPayload) });
            setQuestions(prev => prev.map(q => q.error ? q : { ...q, saved: true }));
            showToast(`${unsaved.length} questions saved to bank!`);
        } catch { showToast('Failed to save all', 'error'); }
        finally { setIsSavingAll(false); }
    };

    const discardOne = (id: number) => {
        const newQs = questions.filter(q => q.id !== id);
        setQuestions(newQs);
        setDiscardedCount(d => d + 1);
        if (newQs.length === 0) setViewState('empty');
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const saved    = questions.filter(q => q.saved).length;
    const errored  = questions.filter(q => !!q.error).length;
    const pending  = questions.filter(q => !q.saved && !q.error).length;

    const levelBadge = (l: string) =>
        l === 'Easy' ? 'badge-easy' : l === 'Medium' ? 'badge-medium' : 'badge-hard';
    const typeBadge = (t: string) =>
        t.includes('Multi') ? 'badge-multi' :
        t.includes('Text')  ? 'badge-text'  :
        t.includes('Image') ? 'badge-dbms'  : 'badge-mcq';
    const isText = (t: string) => t === 'Open Text';

    return (
        <div className="ai-generator-container">

            {/* ── Header ── */}
            <div className="page-header">
                <div>
                    <div className="page-title">AI Question Generator</div>
                    <div className="page-sub">Set topic, difficulty mix and type mix — AI generates exactly what you need.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => window.location.href = '/questions/add'}>← Question Bank</button>
                    {viewState === 'results' && (
                        <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={isSavingAll}>
                            {isSavingAll ? 'Saving…' : `💾 Save All (${pending})`}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Config Panel ── */}
            <div className="ai-config-panel">

                {/* Row 1: Topic + Count */}
                <div className="ai-config-top">
                    <div className="ai-config-section" style={{ flex: 2 }}>
                        <div className="ai-config-label">🗂 Topic</div>
                        {/* ── Topic mode toggle ── */}
                        <div className="topic-mode-tabs">
                            <button
                                className={`topic-mode-tab ${topicMode === 'existing' ? 'active' : ''}`}
                                onClick={() => { setTopicMode('existing'); setNewTopicName(''); }}>
                                Existing Topic
                            </button>
                            <button
                                className={`topic-mode-tab ${topicMode === 'new' ? 'active' : ''}`}
                                onClick={() => { setTopicMode('new'); setSelectedTopicId(''); }}>
                                + New Topic
                            </button>
                        </div>
                        {topicMode === 'existing' ? (
                            <select className="ai-select" value={selectedTopicId}
                                onChange={e => setSelectedTopicId(e.target.value)}>
                                <option value="">Select a topic…</option>
                                {topics.map(t => {
                                    const id   = t.id ?? t.topicId;
                                    const name = t.name ?? t.Name;
                                    return <option key={id} value={id}>{name}</option>;
                                })}
                            </select>
                        ) : (
                            <input
                                className="ai-select"
                                style={{ cursor: 'text' }}
                                placeholder="Type new topic name e.g. Docker, GraphQL…"
                                value={newTopicName}
                                onChange={e => setNewTopicName(e.target.value)}
                            />
                        )}
                    </div>
                    <div className="ai-config-section">
                        <div className="ai-config-label">🔢 Total Questions</div>
                        <div className="count-input-wrap">
                            <button className="count-btn" onClick={() => setTotalCount(c => Math.max(1, c - 1))}>−</button>
                            <input type="number" className="count-input" value={totalCount} min={1} max={50}
                                onChange={e => setTotalCount(Math.max(1, Math.min(50, parseInt(e.target.value)||1)))} />
                            <button className="count-btn" onClick={() => setTotalCount(c => Math.min(50, c + 1))}>+</button>
                        </div>
                    </div>
                    <div className="ai-config-section ai-generate-col">
                        <button className="btn-generate-big"
                            onClick={handleGenerate}
                            disabled={viewState === 'loading' || !isValid}>
                            {viewState === 'loading' ? '⏳ Generating…' : '✨ Generate Questions'}
                        </button>
                        {!isValid && viewState !== 'loading' && (
                            <div className="validation-hint">
                                {topicMode === 'existing' && !selectedTopicId && '• Select a topic  '}
                                {topicMode === 'new' && !newTopicName.trim() && '• Enter new topic name  '}
                                {levelTotal !== 100 && `• Difficulty = ${levelTotal}%  `}
                                {typeTotal  !== 100 && `• Type = ${typeTotal}%`}
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 2: Difficulty + Type distributions */}
                <div className="ai-dist-grid">

                    {/* Difficulty distribution */}
                    <div className="dist-card">
                        <div className="dist-card-header">
                            <div className="dist-card-title">📊 Difficulty Distribution</div>
                            <div className={`dist-total ${levelTotal === 100 ? 'valid' : 'invalid'}`}>
                                {levelTotal}% / 100%
                            </div>
                        </div>

                        {/* Visual bar */}
                        <div className="dist-bar">
                            {levelDist.map((s) => (
                                s.pct > 0 && (
                                    <div key={s.key} className="dist-bar-seg"
                                        style={{ width: `${s.pct}%`, background: s.color }}
                                        title={`${s.key}: ${s.pct}%`} />
                                )
                            ))}
                        </div>

                        {/* Sliders */}
                        <div className="dist-slices">
                            {levelDist.map((s, i) => (
                                <SliceRow key={s.key} label={s.key} pct={s.pct}
                                    color={s.color} count={levelCounts[i]}
                                    onChange={v => updateLevelPct(i, v)} />
                            ))}
                        </div>

                        {/* Quick presets */}
                        <div className="dist-presets">
                            <span className="preset-label">Presets:</span>
                            {[
                                { label: 'Equal',      vals: [33,34,33] },
                                { label: 'Easy Heavy', vals: [60,30,10] },
                                { label: 'Hard Heavy', vals: [20,30,50] },
                                { label: 'No Easy',    vals: [0, 50,50] },
                            ].map(p => (
                                <button key={p.label} className="preset-btn"
                                    onClick={() => setLevelDist(prev => prev.map((s, i) => ({ ...s, pct: p.vals[i] })))}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Type distribution */}
                    <div className="dist-card">
                        <div className="dist-card-header">
                            <div className="dist-card-title">📝 Question Type Distribution</div>
                            <div className={`dist-total ${typeTotal === 100 ? 'valid' : 'invalid'}`}>
                                {typeTotal}% / 100%
                            </div>
                        </div>

                        {/* Visual bar */}
                        <div className="dist-bar">
                            {typeDist.map((s) => (
                                s.pct > 0 && (
                                    <div key={s.key} className="dist-bar-seg"
                                        style={{ width: `${s.pct}%`, background: s.color }}
                                        title={`${s.key}: ${s.pct}%`} />
                                )
                            ))}
                        </div>

                        {/* Sliders */}
                        <div className="dist-slices">
                            {typeDist.map((s, i) => (
                                <SliceRow key={s.key} label={s.key} pct={s.pct}
                                    color={s.color} count={typeCounts[i]}
                                    onChange={v => updateTypePct(i, v)} />
                            ))}
                        </div>

                        {/* Quick presets */}
                        <div className="dist-presets">
                            <span className="preset-label">Presets:</span>
                            {[
                                { label: 'MCQ Only',    vals: [100,0,0,0] },
                                { label: 'Mixed',       vals: [50,25,25,0] },
                                { label: 'With Image',  vals: [40,20,20,20] },
                                { label: 'No Image',    vals: [50,30,20,0] },
                            ].map(p => (
                                <button key={p.label} className="preset-btn"
                                    onClick={() => setTypeDist(prev => prev.map((s, i) => ({ ...s, pct: p.vals[i] })))}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Batch preview table */}
                {isValid && (
                    <div className="batch-preview">
                        <div className="batch-preview-title">Generation Plan — {buildJobs().reduce((a,j) => a+j.count, 0)} questions in {buildJobs().length} batch{buildJobs().length !== 1 ? 'es' : ''}</div>
                        <div className="batch-table-wrap">
                            <table className="batch-table">
                                <thead>
                                    <tr>
                                        <th>Level</th>
                                        <th>Type</th>
                                        <th>Count</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {buildJobs().map((j, idx) => (
                                        <tr key={idx}>
                                            <td><span className={`badge ${levelBadge(j.level)}`}>{j.level}</span></td>
                                            <td><span className={`badge ${typeBadge(j.type)}`}>{j.type}</span></td>
                                            <td><strong>{j.count}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Results Area ── */}
            <div className="layout-main">
                <div className="results-card">
                    <div className="card-header">
                        <div className="card-title">
                            🧾 Generated Questions
                            <span className="result-count">{questions.filter(q => !q.error).length} questions</span>
                        </div>
                        {viewState === 'results' && (
                            <div className="card-header-actions">
                                <button className="btn btn-secondary btn-sm" onClick={handleGenerate}>↻ Regenerate</button>
                                <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={isSavingAll}>
                                    {isSavingAll ? 'Saving…' : `💾 Save All (${pending})`}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Empty */}
                    {viewState === 'empty' && (
                        <div className="empty-state-wrap">
                            <div className="empty-icon">🧠</div>
                            <div className="empty-title">Configure and Generate</div>
                            <div className="empty-sub">Set your topic, adjust the difficulty and type percentages above until both reach 100%, then click <strong>Generate Questions</strong>.</div>
                        </div>
                    )}

                    {/* Loading */}
                    {viewState === 'loading' && (
                        <div className="batch-loading">
                            <div className="batch-loading-header">
                                <div className="spinner" />
                                <div>
                                    <div className="batch-loading-title">
                                        Generating batch {batchProgress.done + 1} of {batchProgress.total}
                                    </div>
                                    <div className="batch-loading-sub">{batchProgress.current}</div>
                                </div>
                            </div>
                            <div className="progress-track">
                                <div className="progress-bar"
                                    style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }} />
                            </div>
                            <div className="skeleton-list">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="skel-card">
                                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                            <div className="skel" style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                <div className="skel skel-line skel-sm" style={{ marginBottom: '8px' }} />
                                                <div className="skel skel-line skel-lg" />
                                                <div className="skel skel-line skel-md" />
                                            </div>
                                        </div>
                                        <div className="skel-opts">
                                            <div className="skel skel-opt" /><div className="skel skel-opt" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {viewState === 'results' && (
                        <div>
                            {/* Group by level */}
                            {['Easy','Medium','Hard'].map(lv => {
                                const group = questions.filter(q => q.level === lv);
                                if (group.length === 0) return null;
                                return (
                                    <div key={lv} className="q-group">
                                        <div className="q-group-header">
                                            <span className={`badge ${levelBadge(lv)}`}>{lv}</span>
                                            <span className="q-group-count">{group.filter(q=>!q.error).length} questions</span>
                                        </div>
                                        <div className="q-list">
                                            {group.map((q, i) => (
                                                q.error ? (
                                                    <div key={q.id} className="q-card q-card-error">
                                                        <div style={{ padding: '12px 16px', color: '#e03b3b', fontSize: '13px' }}>
                                                            ⚠ {q.text}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div key={q.id} className={`q-card ${q.saved ? 'saved-card' : ''}`}>
                                                        <div className="q-card-top">
                                                            <div className="q-num-badge">{i + 1}</div>
                                                            <div className="q-card-body">
                                                                <div className="q-badges">
                                                                    <span className="badge badge-js"><span className="bdot"/>{q.topicName}</span>
                                                                    <span className={`badge ${levelBadge(q.level)}`}><span className="bdot"/>{q.level}</span>
                                                                    <span className={`badge ${typeBadge(q.type)}`}>{q.type}</span>
                                                                    {q.saved && <span className="badge badge-ai">⭐ Saved</span>}
                                                                </div>
                                                                <div className="q-card-text" dangerouslySetInnerHTML={{ __html: q.text }} />

                                                                {!isText(q.type) && q.options.length > 0 && (
                                                                    <div className="q-options">
                                                                        {q.options.map((o, oi) => (
                                                                            <div key={oi} className={`q-option ${o.correct ? 'correct' : ''}`}>
                                                                                <div className="q-radio">
                                                                                    {o.correct && <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                                                                                </div>
                                                                                {o.imageUrl
                                                                                    ? <img src={o.imageUrl} alt="" style={{ maxHeight: '56px', borderRadius: '6px' }} />
                                                                                    : <span>{o.text}</span>}
                                                                                {o.correct && <span className="correct-tag">✓ Correct</span>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {isText(q.type) && (
                                                                    <div className="text-answer-box">
                                                                        <div className="ta-label">Model Answer</div>
                                                                        <div className="ta-text">{q.textAnswer || '—'}</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="q-card-actions">
                                                                <div className="act-btn del" onClick={() => discardOne(q.id)}>✕</div>
                                                            </div>
                                                        </div>
                                                        <div className="q-card-footer">
                                                            <div className="q-meta">
                                                                <span>🗂 {q.topicName}</span>
                                                                <span>📊 {q.level}</span>
                                                                <span>📝 {q.type}</span>
                                                            </div>
                                                            <button className={`save-btn ${q.saved ? 'is-saved' : ''}`}
                                                                onClick={() => saveOne(q.id)} disabled={q.saved}>
                                                                {q.saved ? '⭐ Saved' : '+ Save to Bank'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="results-footer">
                                <div className="footer-info">
                                    {questions.filter(q=>!q.error).length} generated · {saved} saved · {pending} pending
                                    {errored > 0 && <span style={{ color: '#e03b3b' }}> · {errored} failed</span>}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={handleGenerate}>↻ Regenerate</button>
                                    <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={isSavingAll}>
                                        {isSavingAll ? 'Saving…' : `💾 Save All (${pending})`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Session stats */}
                <div className="right-panel">
                    <div className="info-panel">
                        <div className="info-panel-header"><div className="info-panel-title">📊 This Session</div></div>
                        <div className="info-panel-body">
                            <div className="quick-stats">
                                {[
                                    { num: questions.filter(q=>!q.error).length, label: 'Generated', color: 'var(--accent)'  },
                                    { num: saved,                                label: 'Saved',     color: 'var(--green)'   },
                                    { num: discardedCount,                       label: 'Discarded', color: 'var(--red)'     },
                                    { num: pending,                              label: 'Pending',   color: 'var(--accent2)' },
                                ].map(s => (
                                    <div key={s.label} className="qs-item">
                                        <div className="qs-num" style={{ color: s.color }}>{s.num}</div>
                                        <div className="qs-label">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Current plan */}
                    <div className="info-panel">
                        <div className="info-panel-header"><div className="info-panel-title">🎯 Current Plan</div></div>
                        <div className="info-panel-body" style={{ padding: '12px 16px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>Topic</div>
                            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>{getTopicName() || '—'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Difficulty</div>
                            {levelDist.filter(s => s.pct > 0).map((s) => (
                                <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: s.color, fontWeight: 600 }}>{s.key}</span>
                                    <span>{s.pct}% → {levelCounts[levelDist.indexOf(s)]}Q</span>
                                </div>
                            ))}
                            <div style={{ fontSize: '12px', color: 'var(--muted)', margin: '10px 0 6px' }}>Types</div>
                            {typeDist.filter(s => s.pct > 0).map((s) => (
                                <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: s.color, fontWeight: 600 }}>{s.key}</span>
                                    <span>{s.pct}% → {typeCounts[typeDist.indexOf(s)]}Q</span>
                                </div>
                            ))}
                            <div style={{ borderTop: '1px solid var(--border)', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '13px' }}>
                                <span>Total</span>
                                <span>{totalCount}Q</span>
                            </div>
                        </div>
                    </div>

                    <div className="info-panel">
                        <div className="info-panel-header"><div className="info-panel-title">💡 Tips</div></div>
                        <div className="info-panel-body">
                            <div className="tip-list">
                                <div className="tip-item"><div className="tip-icon">🎯</div><span>Both sliders must total <strong>100%</strong> before generating.</span></div>
                                <div className="tip-item"><div className="tip-icon">⚡</div><span>Use presets to quickly set common distributions.</span></div>
                                <div className="tip-item"><div className="tip-icon">💾</div><span>Save individual questions or use Save All for bulk saving.</span></div>
                                <div className="tip-item"><div className="tip-icon">📊</div><span>Questions are grouped by difficulty in the results.</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast */}
            <div className={`toast ${toast.show ? 'show' : ''}`}
                style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'info' ? '#1a2540' : '#0d1117' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default AIGenerator;