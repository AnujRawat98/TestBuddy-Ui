import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { topicsApi, assessmentsApi, questionsApi } from '../../services/api';
import './CreateAssessment.css';

const FALLBACK_COLORS = ['#ff5c00', '#e03b3b', '#8b5cf6', '#f5a623', '#06b6d4', '#0057ff', '#00c271'];

const MOCK_LEVELS: Record<string, string> = {
    'Easy':   '11111111-1111-1111-1111-111111111111',
    'Medium': '22222222-2222-2222-2222-222222222222',
    'Hard':   '33333333-3333-3333-3333-333333333333',
};

interface TopicDist {
    topicId:             string;
    topicVersionId:      string;
    pct:                 number;
    selectedQuestionIds: string[];
}

interface OptionItem {
    id:        string;
    text:      string;
    isCorrect: boolean;
    imageUrl?: string | null;
}

interface QuestionItem {
    id:           string;
    questionText: string;
    level?:       string;
    type?:        string;
    textAnswer?:  string | null;   // OpenText
    options?:     OptionItem[];    // MCQ | MultiSelect | ImageSelect
}

const CreateAssessment: React.FC = () => {
    const navigate       = useNavigate();
    const initializedRef = React.useRef(false);

    const [realTopics, setRealTopics] = useState<any[]>([]);
    const [isSaving,   setIsSaving]   = useState(false);
    const [toast,      setToast]      = useState({ show: false, msg: '', type: 'success' });

    const showToast = (msg: string, tType: 'success' | 'info' | 'error' = 'success') => {
        setToast({ show: true, msg, type: tType });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    // ── DB columns: Title, TotalQuestions, MarksPerQuestion,
    //               DurationMinutes, IsRandomized, IsActive, NegativeMarks ──
    const [title,        setTitle]        = useState('');
    const [totalQs,      setTotalQs]      = useState(20);
    const [duration,     setDuration]     = useState(30);
    const [marksPerQ,    setMarksPerQ]    = useState(1);
    const [negMarks,     setNegMarks]     = useState(0.25);
    const [isActive,     setIsActive]     = useState(false);   // IsActive — false = Draft, true = Published
    const [isRandomized, setIsRandomized] = useState(true);    // IsRandomized

    const passPct    = 60;
    const totalMarks = totalQs * marksPerQ;
    const passScore  = Math.round((passPct / 100) * totalMarks);

    // ── Topics ────────────────────────────────────────────────────────
    const [topics, setTopics] = useState<TopicDist[]>([]);

    const fetchTopics = async () => {
        try {
            const res  = await topicsApi.getAll();
            const list: any[] = Array.isArray(res.data)
                ? res.data
                : (res.data?.items ?? res.data?.data ?? []);
            setRealTopics(list);
            if (list.length > 0 && !initializedRef.current) {
                initializedRef.current = true;
                const first = list[0];
                setTopics([{
                    topicId:             first.id ?? '',
                    topicVersionId:      first.topicVersionId ?? '',
                    pct:                 100,
                    selectedQuestionIds: [],
                }]);
            }
        } catch {
            showToast('Failed to load topics', 'error');
        }
    };

    useEffect(() => { fetchTopics(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const getTopicColor = (topicVersionId: string) => {
        const idx = realTopics.findIndex(t => t.topicVersionId === topicVersionId);
        return FALLBACK_COLORS[idx % FALLBACK_COLORS.length] || FALLBACK_COLORS[0];
    };

    const handleTopicChange = (idx: number, vId: string) => {
        const found = realTopics.find(t => t.topicVersionId === vId);
        setTopics(prev => prev.map((t, i) => i !== idx ? t : {
            ...t,
            topicId:             found?.id ?? vId,
            topicVersionId:      vId,
            selectedQuestionIds: [],
        }));
    };

    const handlePctChange = (idx: number, v: number) =>
        setTopics(prev => prev.map((t, i) => i === idx ? { ...t, pct: v } : t));

    const handleRemoveTopic = (idx: number) =>
        setTopics(prev => prev.filter((_, i) => i !== idx));

    const handleAddTopic = () => {
        const used = topics.map(t => t.topicVersionId);
        const next = realTopics.find(t => !used.includes(t.topicVersionId));
        if (!next) { showToast('All available topics already added.', 'info'); return; }
        setTopics(prev => [...prev, {
            topicId:             next.id ?? '',
            topicVersionId:      next.topicVersionId ?? '',
            pct:                 0,
            selectedQuestionIds: [],
        }]);
    };

    const topicsSum = topics.reduce((acc, t) => acc + (t.pct || 0), 0);
    const topicsOk  = isRandomized
        ? topicsSum === 100
        : topics.every(t => t.selectedQuestionIds.length > 0);

    // ── Difficulty distribution (randomized mode only) ────────────────
    const [diffEasy,   setDiffEasy]   = useState(40);
    const [diffMedium, setDiffMedium] = useState(40);
    const [diffHard,   setDiffHard]   = useState(20);
    const diffSum = diffEasy + diffMedium + diffHard;
    const diffOk  = diffSum === 100;

    // ── Modal ─────────────────────────────────────────────────────────
    const [modal, setModal] = useState<{
        open: boolean; topicIdx: number; topicName: string;
        topicVersionId: string; mode: 'preview' | 'select';
    }>({ open: false, topicIdx: -1, topicName: '', topicVersionId: '', mode: 'preview' });

    const [modalQuestions, setModalQuestions] = useState<QuestionItem[]>([]);
    const [modalLoading,   setModalLoading]   = useState(false);
    const [modalSelected,  setModalSelected]  = useState<Set<string>>(new Set());

    const openModal = async (idx: number, mode: 'preview' | 'select') => {
        const t  = topics[idx];
        const tp = realTopics.find(r => r.topicVersionId === t.topicVersionId);
        setModal({ open: true, topicIdx: idx, topicName: tp?.name ?? 'Topic', topicVersionId: t.topicVersionId, mode });
        setModalLoading(true);
        setModalQuestions([]);
        setModalSelected(new Set(t.selectedQuestionIds));
        try {
            const res  = await questionsApi.getAllByTopic(t.topicVersionId);
            const list: any[] = Array.isArray(res.data)
                ? res.data
                : (res.data?.items ?? res.data?.data ?? res.data?.questions ?? []);
            setModalQuestions(list.map((q: any) => ({
                id:           q.id ?? q.questionId ?? '',
                questionText: q.questionText ?? q.text ?? 'Question',
                level:        q.level?.name  ?? q.levelName  ?? q.level  ?? '',
                type:         q.questionType?.name ?? q.typeName ?? q.questionType ?? '',
                textAnswer:   q.textAnswer ?? null,
                options:      (q.options ?? []).map((o: any) => ({
                    id:        o.id,
                    text:      o.text      ?? '',
                    isCorrect: o.isCorrect ?? false,
                    imageUrl:  o.imageUrl  ?? null,
                })),
            })));
        } catch {
            showToast('Failed to load questions', 'error');
        } finally {
            setModalLoading(false);
        }
    };

    const closeModal = () => setModal(p => ({ ...p, open: false }));

    const toggleModalQuestion = (qId: string) =>
        setModalSelected(prev => {
            const next = new Set(prev);
            next.has(qId) ? next.delete(qId) : next.add(qId);
            return next;
        });

    const confirmModalSelection = () => {
        setTopics(prev => prev.map((t, i) =>
            i === modal.topicIdx ? { ...t, selectedQuestionIds: Array.from(modalSelected) } : t
        ));
        closeModal();
        showToast(`${modalSelected.size} question${modalSelected.size !== 1 ? 's' : ''} selected for ${modal.topicName}`, 'success');
    };

    // ── Validate + Build Payload ──────────────────────────────────────
    const handleCreate = async (saveAsDraft = false) => {
        if (!title.trim()) {
            showToast('Please enter an assessment title.', 'error'); return;
        }
        if (topics.length === 0) {
            showToast('Add at least one topic.', 'error'); return;
        }
        if (isRandomized) {
            if (!topicsOk)  { showToast(`Topic percentages must sum to 100% (currently ${topicsSum}%).`, 'error'); return; }
            if (!diffOk)    { showToast(`Difficulty percentages must sum to 100% (currently ${diffSum}%).`, 'error'); return; }
        } else {
            if (topics.some(t => t.selectedQuestionIds.length === 0)) {
                showToast('Please select questions for all topics.', 'error'); return;
            }
        }

        setIsSaving(true);
        try {
            // ── Payload maps 1-to-1 to Assessment DB columns ─────────
            // Title, TotalQuestions, MarksPerQuestion,
            // DurationMinutes, IsRandomized, IsActive, NegativeMarks
            const payload = {
                title,
                totalQuestions:   isRandomized
                    ? totalQs
                    : topics.reduce((s, t) => s + t.selectedQuestionIds.length, 0),
                durationMinutes:  duration,
                marksPerQuestion: marksPerQ,
                negativeMarks:    negMarks,
                isRandomized,
                isActive:         saveAsDraft ? false : isActive,
                topics: topics.map(t => ({
                    topicId:       t.topicId,
                    questionCount: isRandomized
                        ? Math.round((t.pct / 100) * totalQs)
                        : t.selectedQuestionIds.length,
                    percentage:    isRandomized ? t.pct : null,
                    ...(isRandomized ? {} : { questionIds: t.selectedQuestionIds }),
                })),
                difficultyRules: isRandomized ? [
                    { levelId: MOCK_LEVELS['Easy'],   percentage: diffEasy   },
                    { levelId: MOCK_LEVELS['Medium'], percentage: diffMedium },
                    { levelId: MOCK_LEVELS['Hard'],   percentage: diffHard   },
                ] : [],
            };

            console.log('[CreateAssessment] payload:', JSON.stringify(payload, null, 2));
            await assessmentsApi.create(payload);
            showToast(saveAsDraft ? 'Saved as draft!' : 'Assessment created successfully!', 'success');
            setTimeout(() => navigate('/assessments'), 1500);
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? err?.response?.data?.title ?? 'Failed to create assessment.';
            showToast(msg, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Checklist items ───────────────────────────────────────────────
    const checklistItems = [
        { label: 'Title entered',            done: !!title.trim()    },
        { label: 'Topics added',             done: topics.length > 0 },
        ...(isRandomized ? [
            { label: 'Topics sum to 100%',       done: topicsOk },
            { label: 'Difficulty sums to 100%',  done: diffOk   },
        ] : [
            { label: 'Questions selected for all topics',
              done: topics.length > 0 && topics.every(t => t.selectedQuestionIds.length > 0) },
        ]),
    ];
    const allChecked = checklistItems.every(c => c.done);

    // ─────────────────────────────────────────────────────────────────
    return (
        <div className="create-assessment-container">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <div className="page-title">Create Assessment</div>
                    <div className="page-sub">Configure questions, marks and distribution — only fields stored in the database.</div>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCreate(true)}
                        disabled={isSaving}
                    >
                        💾 {isSaving ? 'Saving…' : 'Save as Draft'}
                    </button>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleCreate(false)}
                        disabled={isSaving || !allChecked}
                        title={!allChecked ? 'Complete all checklist items first' : ''}
                    >
                        ✅ {isSaving ? 'Creating…' : 'Create Assessment'}
                    </button>
                </div>
            </div>

            <div className="form-layout">
                <div>

                    {/* ══ SECTION 1: Basic Info ══════════════════════════════ */}
                    {/* DB column: Title, IsActive */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title">
                                <div className="section-title-icon si-orange">📋</div>
                                Basic Information
                            </div>
                        </div>
                        <div className="section-body">
                            <div className="form-row full" style={{ marginBottom: '18px' }}>
                                <div className="form-group">
                                    <label className="form-label">
                                        Assessment Title <span className="req">*</span>
                                        <span className="db-col-tag">Title</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="e.g. Web Development Fundamentals Test"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                {/* IsActive */}
                                <div className="form-group">
                                    <label className="form-label">
                                        Publish Status
                                        <span className="db-col-tag">IsActive</span>
                                    </label>
                                    <div className="status-toggle-row">
                                        <div
                                            className={`status-option ${!isActive ? 'selected draft' : ''}`}
                                            onClick={() => setIsActive(false)}
                                        >
                                            <span className="status-dot draft-dot" />
                                            Draft
                                        </div>
                                        <div
                                            className={`status-option ${isActive ? 'selected active' : ''}`}
                                            onClick={() => setIsActive(true)}
                                        >
                                            <span className="status-dot active-dot" />
                                            Published
                                        </div>
                                    </div>
                                    <div className="form-hint">
                                        {isActive
                                            ? 'Assessment is live — students can access it.'
                                            : 'Draft — not visible to students until published.'}
                                    </div>
                                </div>

                                {/* IsRandomized */}
                                <div className="form-group">
                                    <label className="form-label">
                                        Selection Mode
                                        <span className="db-col-tag">IsRandomized</span>
                                    </label>
                                    <div className="status-toggle-row">
                                        <div
                                            className={`status-option ${isRandomized ? 'selected blue' : ''}`}
                                            onClick={() => setIsRandomized(true)}
                                        >
                                            🎲 Randomized
                                        </div>
                                        <div
                                            className={`status-option ${!isRandomized ? 'selected orange' : ''}`}
                                            onClick={() => setIsRandomized(false)}
                                        >
                                            ✋ Manual
                                        </div>
                                    </div>
                                    <div className="form-hint">
                                        {isRandomized
                                            ? 'Questions selected randomly per topic &amp; difficulty.'
                                            : 'You pick specific questions for each topic.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ══ SECTION 2: Marks Configuration ════════════════════ */}
                    {/* DB columns: TotalQuestions, DurationMinutes, MarksPerQuestion, NegativeMarks */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title">
                                <div className="section-title-icon si-blue">⭐</div>
                                Marks Configuration
                            </div>
                            <div className="section-header-right">
                                <span className="score-pill">{totalMarks} total marks</span>
                            </div>
                        </div>
                        <div className="section-body">
                            <div className="marks-row">
                                <div className="marks-card accent-card">
                                    <div className="marks-card-label">
                                        Total Questions
                                        <span className="db-col-tag small">TotalQuestions</span>
                                    </div>
                                    <input
                                        type="number"
                                        min={1}
                                        value={totalQs}
                                        onChange={e => setTotalQs(parseInt(e.target.value) || 0)}
                                    />
                                    <div className="marks-card-sub">questions</div>
                                </div>
                                <div className="marks-card blue-card">
                                    <div className="marks-card-label">
                                        Duration
                                        <span className="db-col-tag small">DurationMinutes</span>
                                    </div>
                                    <input
                                        type="number"
                                        min={1}
                                        value={duration}
                                        onChange={e => setDuration(parseInt(e.target.value) || 0)}
                                    />
                                    <div className="marks-card-sub">minutes</div>
                                </div>
                                <div className="marks-card green-card">
                                    <div className="marks-card-label">
                                        Marks / Q
                                        <span className="db-col-tag small">MarksPerQuestion</span>
                                    </div>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.5}
                                        value={marksPerQ}
                                        onChange={e => setMarksPerQ(parseFloat(e.target.value) || 0)}
                                    />
                                    <div className="marks-card-sub">per correct</div>
                                </div>
                                <div className="marks-card red-card">
                                    <div className="marks-card-label">
                                        Negative
                                        <span className="db-col-tag small">NegativeMarks</span>
                                    </div>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.25}
                                        value={negMarks}
                                        onChange={e => setNegMarks(parseFloat(e.target.value) || 0)}
                                    />
                                    <div className="marks-card-sub">per wrong</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ══ SECTION 3: Topic Distribution ═════════════════════ */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title">
                                <div className="section-title-icon si-purple">🗂</div>
                                Topic Distribution
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {isRandomized && (
                                    <span className={`total-pill ${topicsOk ? 'ok' : 'err'}`}>
                                        {topicsOk ? '✓' : '⚠'} {topicsSum}%
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="section-body">

                            {/* Mode hint */}
                            <div className={`mode-hint ${isRandomized ? 'hint-blue' : 'hint-orange'}`}>
                                {isRandomized
                                    ? '🎲 Questions will be randomly selected per topic based on percentage. Click 👁 to preview.'
                                    : '✋ Click ＋ to manually choose specific questions for each topic.'}
                            </div>

                            <table className="dist-table">
                                <thead>
                                    <tr>
                                        <th>Topic</th>
                                        {isRandomized && <th>Percentage (%)</th>}
                                        <th>Questions</th>
                                        <th style={{ textAlign: 'center' }}>
                                            {isRandomized ? 'Preview' : 'Select'}
                                        </th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topics.map((t, idx) => {
                                        const color  = getTopicColor(t.topicVersionId);
                                        const qCount = isRandomized
                                            ? Math.round((t.pct / 100) * totalQs)
                                            : t.selectedQuestionIds.length;

                                        return (
                                            <tr key={idx}>
                                                {/* Topic selector */}
                                                <td>
                                                    <select
                                                        value={t.topicVersionId}
                                                        onChange={e => handleTopicChange(idx, e.target.value)}
                                                        style={{
                                                            background: `${color}15`,
                                                            color,
                                                            border: `1.5px solid ${color}40`,
                                                            borderRadius: '100px',
                                                            padding: '5px 12px',
                                                            fontWeight: 600,
                                                            fontSize: '13px',
                                                            outline: 'none',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        {realTopics.map(tp => (
                                                            <option key={tp.topicVersionId} value={tp.topicVersionId}>
                                                                {tp.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* % input — randomized only */}
                                                {isRandomized && (
                                                    <td>
                                                        <div className="dist-input-wrap">
                                                            <input
                                                                type="number"
                                                                className="dist-num-input"
                                                                min={0} max={100}
                                                                value={t.pct}
                                                                onChange={e => handlePctChange(idx, parseInt(e.target.value) || 0)}
                                                            />
                                                            <span className="dist-unit">%</span>
                                                        </div>
                                                    </td>
                                                )}

                                                {/* Q count */}
                                                <td>
                                                    <strong style={{ color, fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>
                                                        {qCount}
                                                    </strong>
                                                    {isRandomized && (
                                                        <div className="dist-bar" style={{ width: '80px', marginTop: '6px' }}>
                                                            <div className="dist-fill" style={{ width: `${t.pct}%`, background: color }} />
                                                        </div>
                                                    )}
                                                    {!isRandomized && qCount === 0 && (
                                                        <span style={{ fontSize: '11px', color: 'var(--red)', marginLeft: '6px' }}>
                                                            none selected
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Preview / Select */}
                                                <td style={{ textAlign: 'center' }}>
                                                    {isRandomized ? (
                                                        <button
                                                            className="icon-action-btn preview-btn"
                                                            onClick={() => openModal(idx, 'preview')}
                                                            title="Preview questions"
                                                        >
                                                            👁
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="icon-action-btn select-btn"
                                                            onClick={() => openModal(idx, 'select')}
                                                            title="Select questions manually"
                                                        >
                                                            {t.selectedQuestionIds.length > 0
                                                                ? `✏️ ${t.selectedQuestionIds.length}`
                                                                : '＋'}
                                                        </button>
                                                    )}
                                                </td>

                                                {/* Remove row */}
                                                <td>
                                                    <button
                                                        className="remove-btn"
                                                        onClick={() => handleRemoveTopic(idx)}
                                                        title="Remove topic"
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {isRandomized && !topicsOk && topics.length > 0 && (
                                <div className="validation-msg">
                                    ⚠️ Percentages must sum to 100% — currently {topicsSum}%
                                </div>
                            )}

                            <button className="add-topic-btn" onClick={handleAddTopic}>
                                + Add Topic
                            </button>
                        </div>
                    </div>

                    {/* ══ SECTION 4: Difficulty Distribution (randomized only) */}
                    {isRandomized && (
                        <div className="section-card">
                            <div className="section-header">
                                <div className="section-title">
                                    <div className="section-title-icon si-yellow">📊</div>
                                    Difficulty Distribution
                                </div>
                                <span className={`total-pill ${diffOk ? 'ok' : 'err'}`}>
                                    {diffOk ? '✓' : '⚠'} {diffSum}%
                                </span>
                            </div>
                            <div className="section-body">
                                <div className="diff-grid">
                                    {[
                                        { label: 'Easy',   val: diffEasy,   set: setDiffEasy,   cls: 'easy-card'   },
                                        { label: 'Medium', val: diffMedium, set: setDiffMedium, cls: 'medium-card' },
                                        { label: 'Hard',   val: diffHard,   set: setDiffHard,   cls: 'hard-card'   },
                                    ].map(d => (
                                        <div key={d.label} className={`diff-card ${d.cls}`}>
                                            <div className="diff-card-label">{d.label}</div>
                                            <div className="diff-input-wrap">
                                                <input
                                                    type="number"
                                                    min={0} max={100}
                                                    value={d.val}
                                                    onChange={e => d.set(parseInt(e.target.value) || 0)}
                                                />
                                                <span className="diff-percent">%</span>
                                            </div>
                                            <div className="diff-sub">
                                                {Math.round((d.val / 100) * totalQs)} questions
                                            </div>
                                            <div className="diff-bar">
                                                <div className="diff-fill" style={{ width: `${d.val}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {!diffOk && (
                                    <div className="validation-msg">
                                        ⚠️ Must sum to 100% — currently {diffSum}%
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>{/* /left column */}

                {/* ══ RIGHT PANEL ════════════════════════════════════════ */}
                <div className="right-panel">

                    {/* Score Preview */}
                    <div className="info-panel">
                        <div className="info-panel-header">
                            <div className="info-panel-title">📊 Score Preview</div>
                        </div>
                        <div className="info-panel-body" style={{ padding: '16px' }}>
                            <div className="score-preview">
                                <div className="score-big">{totalMarks}</div>
                                <div className="score-label">Total Marks</div>
                            </div>
                            <div className="score-breakdown">
                                <div className="score-item">
                                    <div className="score-item-num">{totalQs}</div>
                                    <div className="score-item-label">Questions</div>
                                </div>
                                <div className="score-item">
                                    <div className="score-item-num">{duration}m</div>
                                    <div className="score-item-label">Duration</div>
                                </div>
                                <div className="score-item">
                                    <div className="score-item-num">{passScore}</div>
                                    <div className="score-item-label">Pass ({passPct}%)</div>
                                </div>
                                <div className="score-item">
                                    <div className="score-item-num" style={{ color: '#f87171' }}>−{negMarks}</div>
                                    <div className="score-item-label">Negative</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* DB Column Summary */}
                    <div className="info-panel">
                        <div className="info-panel-header">
                            <div className="info-panel-title">📋 Assessment Summary</div>
                        </div>
                        <div className="info-panel-body">
                            {[
                                { key: 'Title',           val: title || '—',    col: 'Title'           },
                                { key: 'Total Questions', val: totalQs,          col: 'TotalQuestions'  },
                                { key: 'Duration',        val: `${duration} min`,col: 'DurationMinutes' },
                                { key: 'Marks/Q',         val: marksPerQ,        col: 'MarksPerQuestion'},
                                { key: 'Negative',        val: negMarks,         col: 'NegativeMarks'   },
                                { key: 'Mode',            val: isRandomized ? '🎲 Randomized' : '✋ Manual', col: 'IsRandomized' },
                                { key: 'Status',          val: isActive ? '✅ Published' : '📄 Draft',      col: 'IsActive'     },
                                { key: 'Topics',          val: `${topics.length} topic(s)` },
                                ...(isRandomized ? [{ key: 'Difficulty', val: `${diffEasy}E / ${diffMedium}M / ${diffHard}H` }] : []),
                            ].map(r => (
                                <div className="summary-row" key={r.key}>
                                    <div>
                                        <div className="summary-key">{r.key}</div>
                                        {'col' in r && r.col && (
                                            <div className="summary-db-col">{r.col}</div>
                                        )}
                                    </div>
                                    <span className="summary-val">{r.val}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Checklist */}
                    <div className="info-panel">
                        <div className="info-panel-header">
                            <div className="info-panel-title">✅ Ready to Create?</div>
                        </div>
                        <div className="info-panel-body">
                            <div className="checklist">
                                {checklistItems.map((c, i) => (
                                    <div key={i} className={`check-item ${c.done ? 'done-item' : 'pending-item'}`}>
                                        <div className={`check-dot ${c.done ? 'done' : 'pending'}`}>
                                            {c.done ? '✓' : '○'}
                                        </div>
                                        <span>{c.label}</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
                                onClick={() => handleCreate(false)}
                                disabled={isSaving || !allChecked}
                            >
                                {isSaving ? '⏳ Creating…' : '✅ Create Assessment'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
                                onClick={() => handleCreate(true)}
                                disabled={isSaving}
                            >
                                💾 Save as Draft
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* ── MODAL: Preview / Select Questions ── */}
            {modal.open && (
                <div
                    className="modal-overlay open"
                    onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
                >
                    <div className="modal modal-lg">
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">
                                    {modal.mode === 'preview' ? '👁 Preview Questions' : '＋ Select Questions'}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>
                                    {modal.topicName} —&nbsp;
                                    {modal.mode === 'preview'
                                        ? 'These questions may be randomly selected'
                                        : `${modalSelected.size} selected`}
                                </div>
                            </div>
                            <div className="modal-close" onClick={closeModal}>✕</div>
                        </div>

                        <div className="modal-body">
                            {modalLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                                    ⏳ Loading questions…
                                </div>
                            ) : modalQuestions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                                    <div>No questions found for this topic.</div>
                                    <div style={{ fontSize: '12px', marginTop: '6px' }}>
                                        Add questions to this topic first.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {modal.mode === 'select' && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                                                {modalQuestions.length} questions available
                                            </span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setModalSelected(new Set(modalQuestions.map(q => q.id)))}
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setModalSelected(new Set())}
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {modalQuestions.map((q, i) => {
                                        const isSel = modalSelected.has(q.id);
                                        return (
                                            <div
                                                key={q.id}
                                                className={`modal-question-row ${modal.mode === 'select' ? 'selectable' : ''} ${isSel ? 'selected' : ''}`}
                                                onClick={() => modal.mode === 'select' && toggleModalQuestion(q.id)}
                                            >
                                                {modal.mode === 'select' && (
                                                    <div className={`q-checkbox ${isSel ? 'checked' : ''}`}>
                                                        {isSel && '✓'}
                                                    </div>
                                                )}
                                                <div className="q-num">{i + 1}</div>
                                                <div className="q-body">
                                                    <div className="q-text">{q.questionText}</div>
                                                    <div className="q-meta">
                                                        {q.level && <span className="q-tag">{q.level}</span>}
                                                        {q.type  && <span className="q-tag">{q.type}</span>}
                                                    </div>

                                                    {/* MCQ / MultiSelect — text options */}
                                                    {(q.type === 'MCQ' || q.type === 'MultiSelect') && (q.options ?? []).length > 0 && (
                                                        <div className="q-options-list">
                                                            {(q.options ?? []).map((o: OptionItem, oi: number) => (
                                                                <div key={oi} className={`q-option-chip ${o.isCorrect ? 'correct' : ''}`}>
                                                                    {o.isCorrect && <span className="q-option-tick">✓</span>}
                                                                    {o.text}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* OpenText — model answer */}
                                                    {q.type === 'OpenText' && q.textAnswer && (
                                                        <div className="q-text-answer">
                                                            📝 <strong>Model Answer:</strong> {q.textAnswer}
                                                        </div>
                                                    )}
                                                    {q.type === 'OpenText' && !q.textAnswer && (
                                                        <div className="q-text-answer empty">
                                                            ✍️ Open text — no model answer set
                                                        </div>
                                                    )}

                                                    {/* ImageSelect — image thumbnails */}
                                                    {q.type === 'ImageSelect' && (q.options ?? []).length > 0 && (
                                                        <div className="q-image-options">
                                                            {(q.options ?? []).map((o: OptionItem, oi: number) => (
                                                                <div key={oi} className={`q-image-chip ${o.isCorrect ? 'correct' : ''}`}>
                                                                    {o.imageUrl
                                                                        ? <img src={o.imageUrl} alt={o.text || `Option ${oi + 1}`} />
                                                                        : <div className="q-image-placeholder">🖼️</div>
                                                                    }
                                                                    {o.isCorrect && <span className="q-image-correct-badge">✓</span>}
                                                                    {o.text && <div className="q-image-label">{o.text}</div>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary btn-sm"
                                style={{ flex: 1, justifyContent: 'center' }}
                                onClick={closeModal}
                            >
                                Cancel
                            </button>
                            {modal.mode === 'select' && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    style={{ flex: 2, justifyContent: 'center' }}
                                    onClick={confirmModalSelection}
                                    disabled={modalSelected.size === 0}
                                >
                                    ✅ Confirm {modalSelected.size > 0 ? `(${modalSelected.size})` : ''} Questions
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            <div
                className={`toast ${toast.show ? 'show' : ''}`}
                style={{
                    background: toast.type === 'error' ? '#c0392b'
                              : toast.type === 'info'  ? '#1a2540'
                              : '#0d1117',
                }}
            >
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default CreateAssessment;
