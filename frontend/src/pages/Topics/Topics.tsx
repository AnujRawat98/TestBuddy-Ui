import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { topicsApi, questionsApi, bulkUploadApi } from '../../services/api';
import './Topics.css';

const COLORS = ['#ff5c00', '#0057ff', '#00c271', '#f5a623', '#8b5cf6', '#e03b3b', '#06b6d4', '#ec4899'];

const formatDate = (raw: any): string | null => {
    if (!raw) return null;
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return null; }
};

// ═════════════════════════════════════════════════════════════════════════════
// BULK UPLOAD MODAL
// ═════════════════════════════════════════════════════════════════════════════

interface BulkUploadResult {
    topicsCreated:    number;
    topicsReused:     number;
    questionsCreated: number;
    questionsSkipped: number;
    errors:           { row: number; field: string; message: string }[];
    summary:          { topicName: string; isNew: boolean; questionsAdded: number }[];
}

interface BulkUploadModalProps {
    isOpen:    boolean;
    onClose:   () => void;
    onSuccess: () => void;
}

const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [step,        setStep]        = useState<'initial' | 'uploading' | 'result'>('initial');
    const [saveAsDraft, setSaveAsDraft] = useState(false);
    const [result,      setResult]      = useState<BulkUploadResult | null>(null);
    const [error,       setError]       = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setStep('initial'); setResult(null); setError(''); setSaveAsDraft(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    const handleClose = () => { reset(); onClose(); };

    const handleDownloadTemplate = async () => {
        try {
            const res  = await bulkUploadApi.downloadTemplate();
            const url  = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
            const a    = document.createElement('a');
            a.href     = url;
            a.download = 'BulkUpload_Template.csv';
            a.click();
            URL.revokeObjectURL(url);
        } catch { setError('Failed to download template.'); }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.csv')) { setError('Only .csv files are supported.'); return; }
        if (file.size > 10 * 1024 * 1024) { setError('File must be under 10 MB.'); return; }
        setError('');
        setStep('uploading');
        try {
            const res  = await bulkUploadApi.uploadTopicsQuestions(file, saveAsDraft);
            setResult(res.data);
            setStep('result');
            if (res.data.questionsCreated > 0) onSuccess();
        } catch (err: any) {
            setError(err?.response?.data?.message ?? 'Upload failed. Check your file and try again.');
            setStep('initial');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={e => { if (e.target === e.currentTarget && step !== 'uploading') handleClose(); }}>
            <div style={{ background: '#fff', borderRadius: '16px', width: '660px', maxWidth: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.22)' }}>

                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>📊 Bulk Upload Topics & Questions</div>
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Upload a CSV to create topics and questions in bulk</div>
                    </div>
                    <button onClick={handleClose} disabled={step === 'uploading'}
                        style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888', padding: '4px 8px', borderRadius: '6px' }}>✕</button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

                    {/* ── initial ── */}
                    {step === 'initial' && (
                        <div>
                            {/* Format table */}
                            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: '#333' }}>📋 Required CSV Format</div>
                            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '16px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'monospace' }}>
                                    <thead>
                                        <tr style={{ background: '#f0f4ff' }}>
                                            {['TopicName','Question','Level','QuestionType','OpenTextAnswer','Option1','Option2','Option3','Option4','CorrectOption(#Seprated)'].map(h => (
                                                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#0040bb', whiteSpace: 'nowrap', borderRight: '1px solid #e5e7eb' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            ['HTML','What is HTML?','Easy','MCQ','','Option A','Option B','Option C','Option D','Option A'],
                                            ['HTML','Best for styling?','Medium','MCQ','','CSS','JS','PHP','SQL','CSS'],
                                            ['CSS','What is CSS?','Easy','Text','Cascading Style Sheets','','','','',''],
                                        ].map((row, ri) => (
                                            <tr key={ri} style={{ borderTop: '1px solid #f3f4f6' }}>
                                                {row.map((cell, ci) => (
                                                    <td key={ci} style={{ padding: '5px 10px', color: cell ? '#333' : '#ccc', whiteSpace: 'nowrap', borderRight: '1px solid #f3f4f6' }}>{cell || '—'}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Rules */}
                            <div style={{ padding: '14px', background: '#f8faff', border: '1px solid rgba(0,87,255,.15)', borderRadius: '8px', fontSize: '12px', color: '#444', marginBottom: '16px', lineHeight: 1.9 }}>
                                <div style={{ fontWeight: 700, marginBottom: '4px', color: '#0040bb' }}>📌 Rules</div>
                                <div>• <strong>TopicName</strong> — reuses existing topic if name matches, otherwise creates new</div>
                                <div>• <strong>CorrectOption</strong> — use <code style={{ background: '#e8f0ff', padding: '1px 4px', borderRadius: '3px' }}>#</code> for multiple correct: <code style={{ background: '#e8f0ff', padding: '1px 4px', borderRadius: '3px' }}>Option A#Option C</code></div>
                                <div>• <strong>OpenTextAnswer</strong> — only for text-type questions, leave empty for MCQ</div>
                                <div>• <strong>Level</strong> — must match an existing level (e.g. Easy, Medium, Hard)</div>
                                <div>• <strong>QuestionType</strong> — plain name or with brackets: <code style={{ background: '#e8f0ff', padding: '1px 4px', borderRadius: '3px' }}>&lt;Dropdown&gt;</code></div>
                                <div>• Max <strong>500 rows</strong> per upload</div>
                            </div>

                            {/* Save as draft */}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '12px 14px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                                <input type="checkbox" checked={saveAsDraft} onChange={e => setSaveAsDraft(e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: '#0057FF', cursor: 'pointer' }} />
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600 }}>Save as Draft</div>
                                    <div style={{ fontSize: '11px', color: '#888' }}>Questions won't be active until manually published</div>
                                </div>
                            </label>

                            {error && (
                                <div style={{ padding: '10px 14px', background: 'rgba(224,59,59,.08)', border: '1px solid rgba(224,59,59,.2)', borderRadius: '8px', fontSize: '13px', color: '#c0392b', marginBottom: '16px' }}>
                                    ⚠️ {error}
                                </div>
                            )}

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={handleDownloadTemplate}
                                    style={{ flex: 1, padding: '11px 16px', border: '1.5px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'border-color .15s' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = '#0057FF'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = '#d1d5db'}>
                                    ⬇ Download Template
                                </button>
                                <label style={{ flex: 1, padding: '11px 16px', background: '#0057FF', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background .15s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#0040bb')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '#0057FF')}>
                                    📁 Choose CSV & Upload
                                    <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* ── uploading ── */}
                    {step === 'uploading' && (
                        <div style={{ textAlign: 'center', padding: '50px 0' }}>
                            <div style={{ width: '64px', height: '64px', margin: '0 auto 20px', background: 'rgba(0,87,255,.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', animation: 'bspin 1s linear infinite' }}>⏳</div>
                            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Processing your CSV…</div>
                            <div style={{ fontSize: '13px', color: '#888' }}>Creating topics and questions. This may take a moment.</div>
                            <style>{`@keyframes bspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                        </div>
                    )}

                    {/* ── result ── */}
                    {step === 'result' && result && (
                        <div>
                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
                                {[
                                    { icon: '🆕', label: 'Topics Created',    val: result.topicsCreated,    color: '#0057FF' },
                                    { icon: '♻️', label: 'Topics Reused',     val: result.topicsReused,     color: '#8b5cf6' },
                                    { icon: '✅', label: 'Questions Added',   val: result.questionsCreated, color: '#00c271' },
                                    { icon: '⚠️', label: 'Questions Skipped', val: result.questionsSkipped, color: result.questionsSkipped > 0 ? '#e03b3b' : '#aaa' },
                                ].map(s => (
                                    <div key={s.label} style={{ padding: '14px', background: '#f8faff', border: '1px solid #e5e7eb', borderRadius: '10px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
                                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '24px', fontWeight: 800, color: s.color }}>{s.val}</div>
                                        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Per-topic breakdown */}
                            {result.summary.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>📋 Topic Breakdown</div>
                                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                        {result.summary.map((s, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < result.summary.length - 1 ? '1px solid #f3f4f6' : 'none', gap: '10px' }}>
                                                <span style={{ fontSize: '14px' }}>{s.isNew ? '🆕' : '♻️'}</span>
                                                <span style={{ flex: 1, fontWeight: 500, fontSize: '13px' }}>{s.topicName}</span>
                                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '100px', background: s.isNew ? 'rgba(0,87,255,.1)' : 'rgba(139,92,246,.1)', color: s.isNew ? '#0040bb' : '#6d28d9' }}>
                                                    {s.isNew ? 'New' : 'Existing'}
                                                </span>
                                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#00c271' }}>+{s.questionsAdded} Q</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {result.errors.length > 0 && (
                                <div style={{ padding: '12px 14px', background: 'rgba(224,59,59,.06)', border: '1px solid rgba(224,59,59,.2)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#c0392b', marginBottom: '8px' }}>⚠ {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} had errors</div>
                                    <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '12px', color: '#666' }}>
                                        {result.errors.map((err, i) => (
                                            <div key={i} style={{ marginBottom: '3px' }}>Row {err.row} [{err.field}]: {err.message}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer for result step */}
                {step === 'result' && (
                    <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px' }}>
                        <button onClick={reset} style={{ flex: 1, padding: '10px', border: '1.5px solid #e5e7eb', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                            Upload Another File
                        </button>
                        <button onClick={handleClose} style={{ flex: 1, padding: '10px', background: '#0057FF', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                            Done ✓
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN TOPICS COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

const Topics: React.FC = () => {
    const navigate = useNavigate();

    const [topics,      setTopics]      = useState<any[]>([]);
    const [isLoading,   setIsLoading]   = useState(true);
    const [isGridView,  setIsGridView]  = useState(false);
    const [bulkModal,   setBulkModal]   = useState(false);   // ← NEW

    const [topicName,      setTopicName]      = useState('');
    const [topicDesc,      setTopicDesc]      = useState('');
    const [selectedColor,  setSelectedColor]  = useState(COLORS[0]);
    const [editingId,      setEditingId]      = useState<string | number | null>(null);
    const [searchQuery,    setSearchQuery]    = useState('');
    const [statusFilter,   setStatusFilter]   = useState('');
    const [sortFilter,     setSortFilter]     = useState('name');
    const [deleteCandidate, setDeleteCandidate] = useState<{ id: string | number; name: string } | null>(null);
    const [viewModal,      setViewModal]      = useState<{ open: boolean; topic: any; questions: any[]; loading: boolean }>
        ({ open: false, topic: null, questions: [], loading: false });
    const [toast, setToast] = useState<{ type: string; msg: string; show: boolean }>
        ({ type: '', msg: '', show: false });

    const createFormRef     = useRef<HTMLDivElement>(null);
    const topicNameInputRef = useRef<HTMLInputElement>(null);

    const fetchTopics = async () => {
        setIsLoading(true);
        try {
            const res     = await topicsApi.getAll();
            const rawList = Array.isArray(res.data) ? res.data : (res.data?.items ?? res.data?.data ?? []);
            const mapped  = await Promise.all(
                rawList.map(async (t: any, i: number) => {
                    const tvId: string = t.topicVersionId ?? t.TopicVersionId ?? '';
                    let questionCount  = 0;
                    if (tvId) {
                        try {
                            const qRes    = await questionsApi.getAllByTopic(tvId);
                            const d       = qRes.data;
                            questionCount = Array.isArray(d) ? d.length : (d?.totalCount ?? d?.count ?? d?.items?.length ?? 0);
                        } catch {}
                    }
                    const dateStr =
                        formatDate(t.createdAt) ?? formatDate(t.CreatedAt) ??
                        formatDate(t.topicVersion?.createdAt) ?? formatDate(t.versionCreatedAt) ??
                        formatDate(t.dateCreated) ?? null;
                    return {
                        id: t.topicId ?? t.TopicId ?? t.id,
                        topicVersionId: tvId,
                        name:      t.name  ?? t.Name  ?? '—',
                        color:     COLORS[i % COLORS.length],
                        questions: questionCount,
                        date:      dateStr,
                    };
                })
            );
            setTopics(mapped);
        } catch { showToast('error', 'Failed to fetch topics'); }
        finally  { setIsLoading(false); }
    };

    useEffect(() => { fetchTopics(); }, []); // eslint-disable-line

    const showToast = (type: string, msg: string) => {
        setToast({ type, msg, show: true });
        setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
    };

    const handleCreateOrUpdate = async () => {
        const name = topicName.trim();
        if (!name) {
            if (topicNameInputRef.current) {
                topicNameInputRef.current.focus();
                topicNameInputRef.current.style.borderColor = 'var(--red)';
                setTimeout(() => { if (topicNameInputRef.current) topicNameInputRef.current.style.borderColor = ''; }, 1500);
            }
            return;
        }
        try {
            if (editingId) {
                showToast('info', 'Topic name update not yet supported by backend.');
                setEditingId(null);
            } else {
                if (topics.some(t => t.name.toLowerCase() === name.toLowerCase())) {
                    showToast('error', `Topic "${name}" already exists!`); return;
                }
                await topicsApi.create({ name });
                showToast('success', `Topic "${name}" created successfully!`);
                fetchTopics();
            }
            setTopicName(''); setTopicDesc(''); setSelectedColor(COLORS[0]);
        } catch { showToast('error', 'Operation failed'); }
    };

    const confirmDelete = async () => {
        if (!deleteCandidate) return;
        showToast('delete', 'Delete operation restricted in this demo mode.');
        setDeleteCandidate(null);
    };

    const openTopicQuestions = async (topic: any) => {
        setViewModal({ open: true, topic, questions: [], loading: true });
        try {
            const qRes = await questionsApi.getAllByTopic(topic.topicVersionId);
            const data = qRes.data;
            setViewModal(prev => ({ ...prev, questions: Array.isArray(data) ? data : (data?.items ?? []), loading: false }));
        } catch {
            setViewModal(prev => ({ ...prev, loading: false }));
            showToast('error', 'Failed to load questions');
        }
    };

    const handleEditQuestions = async (topic: any) => {
        if (!topic.topicVersionId) { showToast('error', 'Topic version ID missing.'); return; }
        showToast('info', `Loading questions for "${topic.name}"…`);
        try {
            const qRes = await questionsApi.getAllByTopic(topic.topicVersionId);
            const data = qRes.data;
            navigate('/questions/add', {
                state: {
                    editMode: true, topicId: topic.id,
                    topicVersionId: topic.topicVersionId,
                    topicName: topic.name,
                    existingQuestions: Array.isArray(data) ? data : (data?.items ?? []),
                },
            });
        } catch { showToast('error', 'Failed to load questions.'); }
    };

    const filteredTopics = useMemo(() => {
        let result = topics.filter(t => {
            const matchName   = t.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchStatus = statusFilter === 'active' ? t.questions > 0 : statusFilter === 'empty' ? t.questions === 0 : true;
            return matchName && matchStatus;
        });
        if (sortFilter === 'questions') result.sort((a, b) => b.questions - a.questions);
        else if (sortFilter === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortFilter === 'date') result.sort((a, b) => {
            if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        return result;
    }, [topics, searchQuery, statusFilter, sortFilter]);

    const maxQuestions       = Math.max(...topics.map(t => t.questions), 1);
    const top5Topics         = [...topics].sort((a, b) => b.questions - a.questions).slice(0, 5);
    const totalTop5Questions = top5Topics.reduce((s, t) => s + t.questions, 0) || 1;
    const toastIcon          = toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : toast.type === 'delete' ? '🗑️' : '✅';

    // ── Export CSV of current topics ──────────────────────────────────────────
    const handleExportCsv = () => {
        const rows = [
            ['Topic Name', 'Questions', 'Date Added'],
            ...topics.map(t => [t.name, t.questions, t.date ?? 'N/A']),
        ];
        const csv  = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url; a.download = 'topics.csv'; a.click();
        URL.revokeObjectURL(url);
        showToast('success', 'Topics exported!');
    };

    return (
        <div className="topics-container">

            {/* ── PAGE HEADER ── */}
            <div className="page-header">
                <div>
                    <div className="page-title">Topics Management</div>
                    <div className="page-sub">Organise your question bank by creating and managing topics.</div>
                </div>
                <div className="header-actions">
                    {/* ── Export CSV (now actually works) ── */}
                    <button className="btn btn-secondary btn-sm" onClick={handleExportCsv}>
                        📥 Export CSV
                    </button>
                    {/* ── NEW: Bulk Upload button ── */}
                    <button className="btn btn-secondary btn-sm" onClick={() => setBulkModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📊 Bulk Upload
                    </button>
                    <button className="btn btn-primary btn-sm"
                        onClick={() => {
                            createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            topicNameInputRef.current?.focus();
                        }}>
                        + Create Topic
                    </button>
                </div>
            </div>

            {/* ── STAT CARDS ── */}
            <div className="stats-row">
                <div className="stat-card sc1">
                    <div className="stat-top"><div className="stat-icon">🗂</div><span className="stat-chip">↑ {topics.length} total</span></div>
                    <div className="stat-num">{topics.length}</div>
                    <div className="stat-label">Total Topics</div>
                </div>
                <div className="stat-card sc2">
                    <div className="stat-top"><div className="stat-icon">❓</div></div>
                    <div className="stat-num">{topics.reduce((acc, t) => acc + t.questions, 0)}</div>
                    <div className="stat-label">Total Questions</div>
                </div>
                <div className="stat-card sc3">
                    <div className="stat-top"><div className="stat-icon">📝</div></div>
                    <div className="stat-num">{topics.filter(t => t.questions > 0).length}</div>
                    <div className="stat-label">Topics with Questions</div>
                </div>
                <div className="stat-card sc4">
                    <div className="stat-top"><div className="stat-icon">🚫</div></div>
                    <div className="stat-num">{topics.filter(t => t.questions === 0).length}</div>
                    <div className="stat-label">Empty Topics</div>
                </div>
            </div>

            {/* ── MAIN LAYOUT ── */}
            <div className="layout-2">

                {/* LEFT: Topics Table */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">
                            📋 All Topics
                            <span className="card-count">{filteredTopics.length} topics</span>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => setIsGridView(!isGridView)}>
                            {isGridView ? '☰ Table View' : '⊞ Grid View'}
                        </button>
                    </div>

                    <div className="table-toolbar">
                        <div className="search-wrap">
                            <span className="search-icon">🔍</span>
                            <input type="text" placeholder="Search topics…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">All Status</option>
                            <option value="active">Has Questions</option>
                            <option value="empty">Empty</option>
                        </select>
                        <select className="filter-select" value={sortFilter} onChange={e => setSortFilter(e.target.value)}>
                            <option value="name">Sort: Name</option>
                            <option value="questions">Sort: Questions</option>
                            <option value="date">Sort: Date Added</option>
                        </select>
                    </div>

                    {isLoading ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
                            <div className="spinner"></div>
                            <div style={{ marginTop: '10px' }}>Loading topics…</div>
                        </div>
                    ) : !isGridView ? (
                        <div>
                            <table className="topics-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}>#</th>
                                        <th className={sortFilter === 'name' ? 'sorted' : ''}>Topic Name <span className="sort-icon">↑</span></th>
                                        <th className={sortFilter === 'questions' ? 'sorted' : ''}>Questions <span className="sort-icon">↕</span></th>
                                        <th>Status</th>
                                        <th className={sortFilter === 'date' ? 'sorted' : ''}>Date Added <span className="sort-icon">↕</span></th>
                                        <th style={{ width: '100px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTopics.map((t, i) => {
                                        const pct = (t.questions / maxQuestions) * 100;
                                        return (
                                            <tr key={t.id}>
                                                <td style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 600 }}>{String(i + 1).padStart(2, '0')}</td>
                                                <td>
                                                    <div className="topic-cell">
                                                        <div className="topic-color-dot" style={{ background: t.color, boxShadow: `0 0 0 3px ${t.color}22` }}></div>
                                                        <span className="topic-name-text">{t.name}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="qcount-cell">
                                                        <div className="mini-bar"><div className="mini-fill" style={{ width: `${pct}%`, background: t.color }}></div></div>
                                                        <span className="qcount-num">{t.questions}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {t.questions > 0
                                                        ? <span className="badge badge-active"><span className="bdot"></span> Active</span>
                                                        : <span className="badge badge-empty"><span className="bdot"></span> Empty</span>}
                                                </td>
                                                <td style={{ color: 'var(--muted)', fontSize: '13px' }}>{t.date ?? <span style={{ opacity: 0.45 }}>N/A</span>}</td>
                                                <td>
                                                    <div className="action-btns">
                                                        <div className="act-btn" title="View Questions" onClick={() => openTopicQuestions(t)}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                        </div>
                                                        <div className="act-btn" title={t.questions > 0 ? 'Edit Questions' : 'Add Questions'} onClick={() => handleEditQuestions(t)}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                        </div>
                                                        <div className="act-btn delete" title="Delete Topic" onClick={() => setDeleteCandidate({ id: t.id, name: t.name })}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filteredTopics.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-icon">🗂</div>
                                    <div className="empty-title">No topics found</div>
                                    <div className="empty-sub">Try a different search or create a new topic.</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '14px' }}>
                                {filteredTopics.map(t => (
                                    <div key={t.id} style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: '14px', padding: '18px', cursor: 'default', transition: 'all .2s', textAlign: 'center' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.08)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${t.color}18`, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📂</div>
                                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{t.name}</div>
                                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 800, color: t.color, margin: '6px 0' }}>{t.questions}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>questions</div>
                                        {t.date && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{t.date}</div>}
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', justifyContent: 'center' }}>
                                            <div className="act-btn" title={t.questions > 0 ? 'Edit Questions' : 'Add Questions'} onClick={() => handleEditQuestions(t)}>✏️</div>
                                            <div className="act-btn delete" onClick={() => setDeleteCandidate({ id: t.id, name: t.name })}>🗑️</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="table-footer">
                        <div className="table-footer-info">Showing {filteredTopics.length > 0 ? 1 : 0}–{filteredTopics.length} of {filteredTopics.length} topics</div>
                        <div className="pagination">
                            <div className="page-btn">‹</div>
                            <div className="page-btn active">1</div>
                            <div className="page-btn">›</div>
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="right-panel">
                    <div className="create-card" ref={createFormRef}>
                        <div className="create-card-header">
                            <div className="create-icon">🗂</div>
                            <div className="create-card-title">{editingId ? 'Edit Topic' : 'Create New Topic'}</div>
                        </div>
                        <div className="create-body">
                            <div className="form-group">
                                <label>Topic Name <span style={{ color: 'var(--red)' }}>*</span></label>
                                <input type="text" ref={topicNameInputRef} placeholder="e.g. JavaScript, HTML, CSS…" maxLength={40}
                                    value={topicName} onChange={e => setTopicName(e.target.value)} />
                                <div className="char-count"><span>{topicName.length}</span>/40</div>
                            </div>
                            <div className="form-group">
                                <label>Description <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                                <textarea placeholder="Briefly describe what this topic covers…" value={topicDesc} onChange={e => setTopicDesc(e.target.value)}></textarea>
                            </div>
                            <div className="form-group">
                                <label>Topic Color</label>
                                <div className="color-picker-row">
                                    {COLORS.map(color => (
                                        <div key={color} className={`color-swatch ${selectedColor === color ? 'selected' : ''}`}
                                            style={{ background: color }} onClick={() => setSelectedColor(color)}></div>
                                    ))}
                                </div>
                            </div>
                            {editingId && (
                                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: '10px' }}
                                    onClick={() => { setEditingId(null); setTopicName(''); setTopicDesc(''); setSelectedColor(COLORS[0]); }}>
                                    Cancel
                                </button>
                            )}
                            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }} onClick={handleCreateOrUpdate}>
                                {editingId ? '💾 Save Changes' : '+ Create Topic'}
                            </button>

                            {/* ── NEW: Bulk Upload shortcut inside the create card ── */}
                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                <button
                                    className="btn btn-secondary"
                                    style={{ width: '100%', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
                                    onClick={() => setBulkModal(true)}
                                >
                                    📊 Bulk Upload Topics & Questions
                                </button>
                                <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', marginTop: '6px' }}>
                                    Upload a CSV to create multiple topics and questions at once
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Distribution Chart */}
                    <div className="card">
                        <div className="card-header"><div className="card-title">📊 Question Distribution</div></div>
                        <div className="dist-chart">
                            {top5Topics.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No data yet</div>
                            ) : top5Topics.map(t => {
                                const pct = Math.round((t.questions / totalTop5Questions) * 100);
                                return (
                                    <div className="dist-row" key={t.id}>
                                        <div className="dist-label">
                                            <div className="dist-name"><div className="dist-dot" style={{ background: t.color }}></div>{t.name}</div>
                                            <div className="dist-pct">{pct}%</div>
                                        </div>
                                        <div className="dist-bar"><div className="dist-fill" style={{ width: `${pct}%`, background: t.color }}></div></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="info-card">
                        <div className="info-card-title">💡 Topic Tips</div>
                        <div className="info-card-sub">Keep topics focused and distinct for better question organisation and accurate assessment results.</div>
                        <div className="info-stat-row">
                            <div className="info-stat"><div className="info-stat-num">{topics.length > 0 ? Math.round(topics.reduce((s,t)=>s+t.questions,0)/topics.length) : 0}</div><div className="info-stat-label">Avg Questions</div></div>
                            <div className="info-stat"><div className="info-stat-num">{topics.length > 0 ? Math.round((topics.filter(t=>t.questions>0).length/topics.length)*100) : 0}%</div><div className="info-stat-label">Topics Active</div></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── BULK UPLOAD MODAL ── */}
            <BulkUploadModal isOpen={bulkModal} onClose={() => setBulkModal(false)} onSuccess={fetchTopics} />

            {/* ── VIEW QUESTIONS MODAL ── */}
            {viewModal.open && (
                <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setViewModal(p => ({ ...p, open: false })); }}>
                    <div className="modal" style={{ maxWidth: '640px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div>
                                <div className="modal-title" style={{ marginBottom: '4px' }}>
                                    <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: viewModal.topic?.color, marginRight: '8px', verticalAlign: 'middle' }}></span>
                                    {viewModal.topic?.name} — Questions
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{viewModal.questions.length} question(s) found</div>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => setViewModal(p => ({ ...p, open: false }))}>✕ Close</button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {viewModal.loading ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}><div className="spinner"></div><div style={{ marginTop: '10px' }}>Fetching questions…</div></div>
                            ) : viewModal.questions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>No questions yet</div>
                                    <div style={{ fontSize: '13px' }}>Use the edit button to add questions to this topic.</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {viewModal.questions.map((q: any, i: number) => (
                                        <div key={q.questionId ?? q.id ?? i} style={{ padding: '14px 16px', border: '1.5px solid var(--border)', borderRadius: '10px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--ink)', lineHeight: 1.5 }}>{i + 1}. {q.questionText ?? q.text ?? '—'}</div>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                {(q.questionType ?? q.type) && <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', background: 'rgba(0,87,255,.1)', color: '#0040bb' }}>{q.questionType ?? q.type}</span>}
                                                {(q.level ?? q.difficulty) && <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', background: 'rgba(0,194,113,.1)', color: '#006e40' }}>{q.level ?? q.difficulty}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── DELETE MODAL ── */}
            {deleteCandidate && (
                <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setDeleteCandidate(null); }}>
                    <div className="modal">
                        <div className="modal-icon">🗑️</div>
                        <div className="modal-title">Delete Topic?</div>
                        <div className="modal-desc">You're about to delete <strong>"{deleteCandidate.name}"</strong>. This cannot be undone.</div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setDeleteCandidate(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={confirmDelete}>Yes, Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TOAST ── */}
            <div className={`toast ${toast.show ? 'show' : ''}`}
                style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'delete' ? '#444' : '#0d1117' }}>
                <span className="toast-icon">{toastIcon}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default Topics;
