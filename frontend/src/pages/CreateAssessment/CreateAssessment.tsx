import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { topicsApi, assessmentsApi } from '../../services/api';
import './CreateAssessment.css';

const FALLBACK_COLORS = ['#ff5c00', '#e03b3b', '#8b5cf6', '#f5a623', '#06b6d4', '#0057ff', '#00c271'];

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
    'Text Answer':  'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    'Image-Based':  'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
};

interface TopicDist {
    topicId: string;        // stores topicId UUID (for display/selection)
    topicVersionId: string; // stores topicVersionId (what the API payload needs)
    pct: number;
}

const CreateAssessment: React.FC = () => {
    const navigate = useNavigate();
    const [realTopics, setRealTopics] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
    const [currentStep, setCurrentStep] = useState(1);

    const getTopicColor = (topicId: string) => {
        const idx = realTopics.findIndex(t => t.topicId === topicId);
        const color = FALLBACK_COLORS[idx % FALLBACK_COLORS.length] || FALLBACK_COLORS[0];
        return {
            badge: `background:rgba(${hexToRgb(color)},.1);color:${color}`,
            bar: color
        };
    };

    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` : '0,0,0';
    };

    const showToast = (msg: string, tType: 'success' | 'info' | 'error' = 'success') => {
        setToast({ show: true, msg, type: tType });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    // Section 1: Basic
    const [title, setTitle] = useState('Web Development Fundamentals Test');
    const [desc, setDesc] = useState('This assessment tests students on core web development skills including HTML structure, CSS styling, and JavaScript fundamentals.');
    const [category, setCategory] = useState('Web Development');
    const [level, setLevel] = useState('Medium');
    const [status, setStatus] = useState('Draft');

    // Section 2: Marks
    const [totalQs, setTotalQs] = useState(20);
    const [duration, setDuration] = useState(30);
    const [marksPerQ, setMarksPerQ] = useState(1);
    const [negMarks, setNegMarks] = useState(0.25);
    const [passPct, setPassPct] = useState(60);
    const [attempts, setAttempts] = useState('1 attempt');

    // Section 3: Topics
    const [topics, setTopics] = useState<TopicDist[]>([]);

    const fetchTopics = async () => {
        try {
            const res = await topicsApi.getAll();
            // API returns: { topicId, name, topicVersionId }
            setRealTopics(res.data);
            if (res.data.length > 0 && topics.length === 0) {
                const first = res.data[0];
                setTopics([{ topicId: first.topicId, topicVersionId: first.topicVersionId, pct: 100 }]);
            }
        } catch {
            showToast('Failed to load topics', 'error');
        }
    };

    useEffect(() => {
        fetchTopics();
    }, []);

    const handleTopicChange = (idx: number, newTopicId: string) => {
        const found = realTopics.find(t => t.topicId === newTopicId);
        setTopics(prev => prev.map((t, i) => i === idx ? {
            ...t,
            topicId: newTopicId,
            topicVersionId: found?.topicVersionId || newTopicId,
        } : t));
    };
    const handlePctChange = (idx: number, newPct: number) => {
        setTopics(prev => prev.map((t, i) => i === idx ? { ...t, pct: newPct } : t));
    };
    const handleRemoveTopic = (idx: number) => {
        setTopics(prev => prev.filter((_, i) => i !== idx));
    };
    const handleAddTopic = () => {
        const used = topics.map(t => t.topicId);
        const next = realTopics.find(t => !used.includes(t.topicId));
        if (!next) {
            showToast('All available topics already added.', 'info');
            return;
        }
        setTopics(prev => [...prev, { topicId: next.topicId, topicVersionId: next.topicVersionId, pct: 0 }]);
    };


    const topicsSum = topics.reduce((acc, t) => acc + (t.pct || 0), 0);
    const topicsOk = topicsSum === 100;

    // Section 4: Difficulty
    const [diffEasy, setDiffEasy] = useState(40);
    const [diffMedium, setDiffMedium] = useState(40);
    const [diffHard, setDiffHard] = useState(20);
    const diffSum = (diffEasy || 0) + (diffMedium || 0) + (diffHard || 0);
    const diffOk = diffSum === 100;

    // Section 5: Ques Types
    const [typeSelected, setTypeSelected] = useState<Record<string, boolean>>({
        'MCQ': true,
        'Multi-Select': false,
        'Text Answer': true,
        'Image-Based': false
    });
    const toggleType = (t: string) => setTypeSelected(p => ({ ...p, [t]: !p[t] }));

    // Section 6: Settings
    const [settings, setSettings] = useState<Record<string, boolean>>({
        shuffleQs: true,
        shuffleOpts: true,
        showResult: true,
        allowBack: true,
        credAccess: true,
        emailVerify: false,
        webProctor: true,
        imgProctor: true,
        vidProctor: false
    });
    const toggleSetting = (s: string) => setSettings(p => ({ ...p, [s]: !p[s] }));
    const [startupInst, setStartupInst] = useState('Please ensure you are in a quiet room with good lighting. Keep your camera on throughout the exam. Do not switch browser tabs — it will be flagged.');
    const [compMsg, setCompMsg] = useState('Thank you for completing the assessment. Your results will be reviewed and shared within 24 hours.');

    // Calculated Summary
    const totalMarks = totalQs * marksPerQ;
    const passScore = Math.round((passPct / 100) * totalMarks);

    const handleCreate = async (isDraft = false) => {
        if (!title.trim()) { showToast('Please enter an assessment title.', 'error'); return; }
        if (!topicsOk) { showToast('Topic distribution must sum to 100%.', 'error'); return; }
        if (!diffOk) { showToast('Difficulty distribution must sum to 100%.', 'error'); return; }

        setIsSaving(true);
        try {
            const payload = {
                name: title,
                description: desc,
                isSaveAsDraft: isDraft,
                assessmentRule: {
                    totalQuestions: totalQs,
                    passPercentage: passPct,
                    assessmentDuration: duration,
                    marksPerCorrectAnswer: marksPerQ,
                    negativeMarksPerWrongAnswer: negMarks,
                    topicDistributions: topics.map(t => ({
                        topicId: t.topicVersionId,   // API expects topicVersionId here
                        questionCount: Math.round((t.pct / 100) * totalQs)
                    })),
                    difficultyRules: [
                        { levelId: MOCK_LEVELS['Easy'], questionCount: Math.round((diffEasy / 100) * totalQs) },
                        { levelId: MOCK_LEVELS['Medium'], questionCount: Math.round((diffMedium / 100) * totalQs) },
                        { levelId: MOCK_LEVELS['Hard'], questionCount: Math.round((diffHard / 100) * totalQs) }
                    ],
                    questionTypeRules: Object.entries(typeSelected)
                        .filter(([_, sel]) => sel)
                        .map(([type, _]) => ({
                            questionTypeId: MOCK_TYPES[type],
                            questionCount: Math.round((1 / Object.values(typeSelected).filter(v => v).length) * totalQs)
                        }))
                },
                examSetting: {
                    isShuffleQuestions: settings.shuffleQs,
                    isShuffleOptions: settings.shuffleOpts,
                    isShowResultImmediate: settings.showResult,
                    isAllowBackNavigation: settings.allowBack,
                    isCredentialBasedAccess: settings.credAccess,
                    isRequireEmailVerification: settings.emailVerify,
                    proctoringType: settings.vidProctor ? 'Video' : settings.imgProctor ? 'Image' : settings.webProctor ? 'Web' : 'None'
                }
            };

            await assessmentsApi.create(payload);
            showToast('Assessment created successfully!', 'success');
            setTimeout(() => navigate('/dashboard'), 1500);
        } catch (err) {
            showToast('Failed to create assessment', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="create-assessment-container">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <div className="page-title">Create Assessment</div>
                    <div className="page-sub">Build a new exam by configuring topics, marks, distribution and settings.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => handleCreate(true)} disabled={isSaving}>💾 {isSaving ? 'Saving...' : 'Save as Draft'}</button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleCreate()} disabled={isSaving}>✅ {isSaving ? 'Creating...' : 'Create Assessment'}</button>
                </div>
            </div>

            {/* Step Bar */}
            <div className="step-bar">
                <div className={`step-item ${currentStep > 1 ? 'done' : currentStep === 1 ? 'active' : ''}`} onClick={() => setCurrentStep(1)}>
                    <div className="step-circle">{currentStep > 1 ? '✓' : '1'}</div>
                    <div className="step-info">
                        <div className="step-label">Step 1</div>
                        <div className="step-name">Basic Info</div>
                    </div>
                </div>
                <div className={`step-line ${currentStep > 1 ? 'done' : ''}`}></div>
                <div className={`step-item ${currentStep > 2 ? 'done' : currentStep === 2 ? 'active' : ''}`} onClick={() => setCurrentStep(2)}>
                    <div className="step-circle">{currentStep > 2 ? '✓' : '2'}</div>
                    <div className="step-info">
                        <div className="step-label">Step 2</div>
                        <div className="step-name">Questions & Distribution</div>
                    </div>
                </div>
                <div className={`step-line ${currentStep > 2 ? 'done' : ''}`}></div>
                <div className={`step-item ${currentStep > 3 ? 'done' : currentStep === 3 ? 'active' : ''}`} onClick={() => setCurrentStep(3)}>
                    <div className="step-circle">{currentStep > 3 ? '✓' : '3'}</div>
                    <div className="step-info">
                        <div className="step-label">Step 3</div>
                        <div className="step-name">Settings & Proctoring</div>
                    </div>
                </div>
                <div className={`step-line ${currentStep > 3 ? 'done' : ''}`}></div>
                <div className={`step-item ${currentStep === 4 ? 'active' : ''}`} onClick={() => setCurrentStep(4)}>
                    <div className="step-circle">4</div>
                    <div className="step-info">
                        <div className="step-label">Step 4</div>
                        <div className="step-name">Review & Publish</div>
                    </div>
                </div>
            </div>

            <div className="form-layout">
                <div>
                    {/* Section 1 */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title">📋 Basic Information</div>
                        </div>
                        <div className="section-body">
                            <div className="form-group" style={{ marginBottom: '18px' }}>
                                <label className="form-label">Assessment Title *</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: '18px' }}>
                                <label className="form-label">Description</label>
                                <textarea value={desc} onChange={e => setDesc(e.target.value)} />
                            </div>
                            <div className="form-row three">
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <select value={category} onChange={e => setCategory(e.target.value)}>
                                        <option>Web Development</option>
                                        <option>Programming</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Difficulty</label>
                                    <select value={level} onChange={e => setLevel(e.target.value)}>
                                        <option>Medium</option><option>Easy</option><option>Hard</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select value={status} onChange={e => setStatus(e.target.value)}>
                                        <option>Draft</option><option>Published</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2 */}
                    <div className="section-card">
                        <div className="section-header"><div className="section-title">⭐ Marks Configuration</div></div>
                        <div className="section-body">
                            <div className="marks-row">
                                <div className="marks-card accent-card">
                                    <div className="marks-card-label">Total Questions</div>
                                    <input type="number" value={totalQs} onChange={e => setTotalQs(parseInt(e.target.value) || 0)} />
                                </div>
                                <div className="marks-card blue-card">
                                    <div className="marks-card-label">Duration (m)</div>
                                    <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 0)} />
                                </div>
                                <div className="marks-card green-card">
                                    <div className="marks-card-label">Marks/Q</div>
                                    <input type="number" value={marksPerQ} onChange={e => setMarksPerQ(parseFloat(e.target.value) || 0)} />
                                </div>
                                <div className="marks-card red-card">
                                    <div className="marks-card-label">Negative</div>
                                    <input type="number" value={negMarks} onChange={e => setNegMarks(parseFloat(e.target.value) || 0)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3 */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title">🗂 Topic Distribution</div>
                            <span className={`total-pill ${topicsOk ? 'ok' : 'err'}`}>{topicsSum}%</span>
                        </div>
                        <div className="section-body">
                            <table className="dist-table">
                                <thead><tr><th>Topic</th><th>Value (%)</th><th>Questions</th><th>Action</th></tr></thead>
                                <tbody>
                                    {topics.map((t, idx) => {
                                        return (
                                            <tr key={idx}>
                                                <td>
                                                    <select className="topic-pill" value={t.topicId} onChange={e => handleTopicChange(idx, e.target.value)}>
                                                        {realTopics.map(tp => <option key={tp.topicId} value={tp.topicId}>{tp.name}</option>)}
                                                    </select>
                                                </td>
                                                <td><input type="number" value={t.pct} onChange={e => handlePctChange(idx, parseInt(e.target.value) || 0)} /></td>
                                                <td>{Math.round((t.pct / 100) * totalQs)}</td>
                                                <td><button onClick={() => handleRemoveTopic(idx)}>✕</button></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <button className="add-topic-btn" onClick={handleAddTopic}>+ Add Topic</button>
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="right-panel">
                    <div className="info-panel">
                        <div className="info-panel-header">📋 Summary</div>
                        <div className="info-panel-body">
                            <div className="summary-row"><span>Total Marks</span><span>{totalMarks}</span></div>
                            <div className="summary-row"><span>Pass Score</span><span>{passScore}</span></div>
                        </div>
                    </div>
                    <div className="info-panel">
                        <div className="info-panel-body">
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleCreate()} disabled={isSaving}>✅ Create Assessment</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`toast ${toast.show ? 'show' : ''}`}>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default CreateAssessment;
