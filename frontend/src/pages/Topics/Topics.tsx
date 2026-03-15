import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { topicsApi, questionsApi } from '../../services/api';
import './Topics.css';

const COLORS = ['#ff5c00', '#0057ff', '#00c271', '#f5a623', '#8b5cf6', '#e03b3b', '#06b6d4', '#ec4899'];

// ── Safely parse any date string → "02 Jan 2025" or null ──────────────
const formatDate = (raw: any): string | null => {
    if (!raw) return null;
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return null; }
};

const Topics: React.FC = () => {
    const navigate = useNavigate();

    const [topics, setTopics]         = useState<any[]>([]);
    const [isLoading, setIsLoading]   = useState(true);
    const [isGridView, setIsGridView] = useState(false);

    // Create Form
    const [topicName, setTopicName]         = useState('');
    const [topicDesc, setTopicDesc]         = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [editingId, setEditingId]         = useState<string | number | null>(null);

    // Search & Filter
    const [searchQuery, setSearchQuery]   = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [sortFilter, setSortFilter]     = useState('name');

    // Toast
    const [toast, setToast] = useState<{ type: string; msg: string; show: boolean }>({
        type: '', msg: '', show: false,
    });

    // Delete modal
    const [deleteCandidate, setDeleteCandidate] = useState<{ id: string | number; name: string } | null>(null);

    // View Questions Modal
    const [viewModal, setViewModal] = useState<{
        open: boolean; topic: any; questions: any[]; loading: boolean;
    }>({ open: false, topic: null, questions: [], loading: false });

    const createFormRef     = useRef<HTMLDivElement>(null);
    const topicNameInputRef = useRef<HTMLInputElement>(null);

    // ── FETCH TOPICS + QUESTION COUNTS ───────────────────────────────
    const fetchTopics = async () => {
        setIsLoading(true);
        try {
            const res      = await topicsApi.getAll();
            const rawList: any[] = Array.isArray(res.data)
                ? res.data
                : (res.data?.items ?? res.data?.data ?? []);

            const mapped = await Promise.all(
                rawList.map(async (t: any, i: number) => {

                    // ── topicVersionId is required for GET /api/questions ──
                    const tvId: string = t.topicVersionId ?? t.TopicVersionId ?? '';

                    // ── Question count via GET /api/questions?topicVersionId= ──
                    let questionCount = 0;
                    if (tvId) {
                        try {
                            // api.ts getAllByTopic now sends the correct param
                            const qRes = await questionsApi.getAllByTopic(tvId);
                            const d    = qRes.data;
                            questionCount = Array.isArray(d)
                                ? d.length
                                : (d?.totalCount ?? d?.count ?? d?.items?.length ?? 0);
                        } catch {
                            // keep 0 — question fetch failed for this topic
                        }
                    }

                    // ── Date: walk every likely field the API might return ──
                    const dateStr =
                        formatDate(t.createdAt)           ??   // flat on topic
                        formatDate(t.CreatedAt)           ??   // PascalCase variant
                        formatDate(t.topicVersion?.createdAt)  ??   // nested object
                        formatDate(t.versionCreatedAt)    ??   // flat version date
                        formatDate(t.dateCreated)         ??
                        null;

                    return {
                        id:             t.topicId   ?? t.TopicId   ?? t.id,
                        topicVersionId: tvId,
                        name:           t.name      ?? t.Name      ?? '—',
                        color:          COLORS[i % COLORS.length],
                        questions:      questionCount,
                        date:           dateStr,          // null means "N/A" in render
                    };
                })
            );

            setTopics(mapped);
        } catch {
            showToast('error', 'Failed to fetch topics');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTopics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── TOAST ─────────────────────────────────────────────────────────
    const showToast = (type: string, msg: string) => {
        setToast({ type, msg, show: true });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    // ── CREATE TOPIC ──────────────────────────────────────────────────
    const handleCreateOrUpdate = async () => {
        const name = topicName.trim();
        if (!name) {
            if (topicNameInputRef.current) {
                topicNameInputRef.current.focus();
                topicNameInputRef.current.style.borderColor = 'var(--red)';
                setTimeout(() => {
                    if (topicNameInputRef.current) topicNameInputRef.current.style.borderColor = '';
                }, 1500);
            }
            return;
        }
        try {
            if (editingId) {
                showToast('info', 'Topic name update not yet supported by backend.');
                setEditingId(null);
            } else {
                if (topics.some(t => t.name.toLowerCase() === name.toLowerCase())) {
                    showToast('error', `Topic "${name}" already exists!`);
                    return;
                }
                await topicsApi.create({ name });
                showToast('success', `Topic "${name}" created successfully!`);
                fetchTopics();
            }
            setTopicName('');
            setTopicDesc('');
            setSelectedColor(COLORS[0]);
        } catch {
            showToast('error', 'Operation failed');
        }
    };

    // ── DELETE ────────────────────────────────────────────────────────
    const confirmDelete = async () => {
        if (!deleteCandidate) return;
        showToast('delete', 'Delete operation restricted in this demo mode.');
        setDeleteCandidate(null);
    };

    // ── VIEW QUESTIONS MODAL ──────────────────────────────────────────
    const openTopicQuestions = async (topic: any) => {
        setViewModal({ open: true, topic, questions: [], loading: true });
        try {
            // Correct param: topicVersionId
            const qRes = await questionsApi.getAllByTopic(topic.topicVersionId);
            const data = qRes.data;
            const qs   = Array.isArray(data) ? data : (data?.items ?? []);
            setViewModal(prev => ({ ...prev, questions: qs, loading: false }));
        } catch {
            setViewModal(prev => ({ ...prev, loading: false }));
            showToast('error', 'Failed to load questions');
        }
    };

    // ── EDIT: fetch questions → navigate to AddQuestions prefilled ────
    const handleEditQuestions = async (topic: any) => {
        if (!topic.topicVersionId) {
            showToast('error', 'Topic version ID is missing — cannot load questions.');
            return;
        }
        showToast('info', `Loading questions for "${topic.name}"…`);
        try {
            // Uses corrected getAllByTopic → GET /api/questions?topicVersionId=
            const qRes = await questionsApi.getAllByTopic(topic.topicVersionId);
            const data = qRes.data;
            const existingQuestions: any[] = Array.isArray(data) ? data : (data?.items ?? []);

            navigate('/questions/add', {
                state: {
                    editMode:          true,
                    topicId:           topic.id,
                    topicVersionId:    topic.topicVersionId,
                    topicName:         topic.name,
                    existingQuestions,
                },
            });
        } catch {
            showToast('error', 'Failed to load questions. Please try again.');
        }
    };

    // ── DERIVED STATE ─────────────────────────────────────────────────
    const filteredTopics = useMemo(() => {
        let result = topics.filter(t => {
            const matchName   = t.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchStatus = statusFilter === 'active' ? t.questions > 0
                : statusFilter === 'empty'  ? t.questions === 0
                : true;
            return matchName && matchStatus;
        });
        if (sortFilter === 'questions') result.sort((a, b) => b.questions - a.questions);
        else if (sortFilter === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortFilter === 'date') result.sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        return result;
    }, [topics, searchQuery, statusFilter, sortFilter]);

    const maxQuestions       = Math.max(...topics.map(t => t.questions), 1);
    const top5Topics         = [...topics].sort((a, b) => b.questions - a.questions).slice(0, 5);
    const totalTop5Questions = top5Topics.reduce((s, t) => s + t.questions, 0) || 1;

    let toastIcon = '✅';
    if (toast.type === 'error')  toastIcon = '❌';
    if (toast.type === 'info')   toastIcon = 'ℹ️';
    if (toast.type === 'delete') toastIcon = '🗑️';

    return (
        <div className="topics-container">

            {/* ── PAGE HEADER ── */}
            <div className="page-header">
                <div>
                    <div className="page-title">Topics Management</div>
                    <div className="page-sub">Organise your question bank by creating and managing topics.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm">📥 Export CSV</button>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                            createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            topicNameInputRef.current?.focus();
                        }}
                    >+ Create Topic</button>
                </div>
            </div>

            {/* ── STAT CARDS ── */}
            <div className="stats-row">
                <div className="stat-card sc1">
                    <div className="stat-top"><div className="stat-icon">🗂</div><span className="stat-chip">↑ 2 new</span></div>
                    <div className="stat-num">{topics.length}</div>
                    <div className="stat-label">Total Topics</div>
                </div>
                <div className="stat-card sc2">
                    <div className="stat-top"><div className="stat-icon">❓</div><span className="stat-chip">↑ 24</span></div>
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

                    {/* Toolbar */}
                    <div className="table-toolbar">
                        <div className="search-wrap">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                placeholder="Search topics…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
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

                        /* ── TABLE VIEW ── */
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
                                                <td style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 600 }}>
                                                    {String(i + 1).padStart(2, '0')}
                                                </td>

                                                {/* Topic Name */}
                                                <td>
                                                    <div className="topic-cell">
                                                        <div className="topic-color-dot" style={{ background: t.color, boxShadow: `0 0 0 3px ${t.color}22` }}></div>
                                                        <span className="topic-name-text">{t.name}</span>
                                                    </div>
                                                </td>

                                                {/* Questions count + bar */}
                                                <td>
                                                    <div className="qcount-cell">
                                                        <div className="mini-bar">
                                                            <div className="mini-fill" style={{ width: `${pct}%`, background: t.color }}></div>
                                                        </div>
                                                        <span className="qcount-num">{t.questions}</span>
                                                    </div>
                                                </td>

                                                {/* Status badge */}
                                                <td>
                                                    {t.questions > 0
                                                        ? <span className="badge badge-active"><span className="bdot"></span> Active</span>
                                                        : <span className="badge badge-empty"><span className="bdot"></span> Empty</span>
                                                    }
                                                </td>

                                                {/* Date Added */}
                                                <td style={{ color: 'var(--muted)', fontSize: '13px' }}>
                                                    {t.date ?? <span style={{ opacity: 0.45 }}>N/A</span>}
                                                </td>

                                                {/* Actions */}
                                                <td>
                                                    <div className="action-btns">
                                                        {/* Eye */}
                                                        <div className="act-btn" title="View Questions" onClick={() => openTopicQuestions(t)}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                                            </svg>
                                                        </div>
                                                        {/* Pencil → navigate to AddQuestions prefilled */}
                                                        <div className="act-btn" title={t.questions > 0 ? 'Edit Questions' : 'Add Questions'} onClick={() => handleEditQuestions(t)}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                            </svg>
                                                        </div>
                                                        {/* Trash */}
                                                        <div className="act-btn delete" title="Delete Topic" onClick={() => setDeleteCandidate({ id: t.id, name: t.name })}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="3 6 5 6 21 6"/>
                                                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                                                <path d="M10 11v6"/><path d="M14 11v6"/>
                                                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                                            </svg>
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

                        /* ── GRID VIEW ── */
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '14px' }}>
                                {filteredTopics.map(t => (
                                    <div
                                        key={t.id}
                                        style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: '14px', padding: '18px', cursor: 'default', transition: 'all .2s', textAlign: 'center' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.08)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                                    >
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

                    {/* Table Footer */}
                    <div className="table-footer">
                        <div className="table-footer-info">
                            Showing {filteredTopics.length > 0 ? 1 : 0}–{filteredTopics.length} of {filteredTopics.length} topics
                        </div>
                        <div className="pagination">
                            <div className="page-btn">‹</div>
                            <div className="page-btn active">1</div>
                            <div className="page-btn">›</div>
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="right-panel">

                    {/* Create Topic Card */}
                    <div className="create-card" ref={createFormRef}>
                        <div className="create-card-header">
                            <div className="create-icon">🗂</div>
                            <div className="create-card-title">{editingId ? 'Edit Topic' : 'Create New Topic'}</div>
                        </div>
                        <div className="create-body">
                            <div className="form-group">
                                <label>Topic Name <span style={{ color: 'var(--red)' }}>*</span></label>
                                <input
                                    type="text"
                                    ref={topicNameInputRef}
                                    placeholder="e.g. JavaScript, HTML, CSS…"
                                    maxLength={40}
                                    value={topicName}
                                    onChange={e => setTopicName(e.target.value)}
                                />
                                <div className="char-count"><span>{topicName.length}</span>/40</div>
                            </div>
                            <div className="form-group">
                                <label>Description <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                                <textarea
                                    placeholder="Briefly describe what this topic covers…"
                                    value={topicDesc}
                                    onChange={e => setTopicDesc(e.target.value)}
                                ></textarea>
                            </div>
                            <div className="form-group">
                                <label>Topic Color</label>
                                <div className="color-picker-row">
                                    {COLORS.map(color => (
                                        <div
                                            key={color}
                                            className={`color-swatch ${selectedColor === color ? 'selected' : ''}`}
                                            style={{ background: color }}
                                            onClick={() => setSelectedColor(color)}
                                        ></div>
                                    ))}
                                </div>
                            </div>
                            {editingId && (
                                <button
                                    className="btn btn-secondary"
                                    style={{ width: '100%', justifyContent: 'center', marginBottom: '10px' }}
                                    onClick={() => { setEditingId(null); setTopicName(''); setTopicDesc(''); setSelectedColor(COLORS[0]); }}
                                >Cancel</button>
                            )}
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
                                onClick={handleCreateOrUpdate}
                            >{editingId ? '💾 Save Changes' : '+ Create Topic'}</button>
                        </div>
                    </div>

                    {/* Distribution Chart */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">📊 Question Distribution</div>
                        </div>
                        <div className="dist-chart">
                            {top5Topics.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                                    No data yet
                                </div>
                            ) : top5Topics.map(t => {
                                const pct = Math.round((t.questions / totalTop5Questions) * 100);
                                return (
                                    <div className="dist-row" key={t.id}>
                                        <div className="dist-label">
                                            <div className="dist-name">
                                                <div className="dist-dot" style={{ background: t.color }}></div>
                                                {t.name}
                                            </div>
                                            <div className="dist-pct">{pct}%</div>
                                        </div>
                                        <div className="dist-bar">
                                            <div className="dist-fill" style={{ width: `${pct}%`, background: t.color }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Info Card */}
                    <div className="info-card">
                        <div className="info-card-title">💡 Topic Tips</div>
                        <div className="info-card-sub">Keep topics focused and distinct for better question organisation and accurate assessment results.</div>
                        <div className="info-stat-row">
                            <div className="info-stat"><div className="info-stat-num">29</div><div className="info-stat-label">Avg Questions</div></div>
                            <div className="info-stat"><div className="info-stat-num">82%</div><div className="info-stat-label">Topics Active</div></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ VIEW QUESTIONS MODAL ════════════════════════════════ */}
            {viewModal.open && (
                <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setViewModal(prev => ({ ...prev, open: false })); }}>
                    <div className="modal" style={{ maxWidth: '640px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div>
                                <div className="modal-title" style={{ marginBottom: '4px' }}>
                                    <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: viewModal.topic?.color, marginRight: '8px', verticalAlign: 'middle' }}></span>
                                    {viewModal.topic?.name} — Questions
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{viewModal.questions.length} question(s) found</div>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => setViewModal(prev => ({ ...prev, open: false }))}>✕ Close</button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {viewModal.loading ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                                    <div className="spinner"></div>
                                    <div style={{ marginTop: '10px' }}>Fetching questions…</div>
                                </div>
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
                                            <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--ink)', lineHeight: 1.5 }}>
                                                {i + 1}. {q.questionText ?? q.text ?? '—'}
                                            </div>
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

            {/* ═══ DELETE MODAL ════════════════════════════════════════ */}
            {deleteCandidate && (
                <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setDeleteCandidate(null); }}>
                    <div className="modal">
                        <div className="modal-icon">🗑️</div>
                        <div className="modal-title">Delete Topic?</div>
                        <div className="modal-desc">
                            You're about to delete <strong>"{deleteCandidate.name}"</strong>.
                            This cannot be undone. Questions linked to this topic will become unassigned.
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setDeleteCandidate(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={confirmDelete}>Yes, Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TOAST ══════════════════════════════════════════════ */}
            <div
                className={`toast ${toast.show ? 'show' : ''}`}
                style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'delete' ? '#444' : '#0d1117' }}
            >
                <span className="toast-icon">{toastIcon}</span>
                <span>{toast.msg}</span>
            </div>

        </div>
    );
};

export default Topics;
