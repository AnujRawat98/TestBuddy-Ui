import React, { useState, useMemo, useRef, useEffect } from 'react';
import { topicsApi } from '../../services/api';
import './Topics.css';

// Mock initial data based on HTML
const initialTopics = [
    { id: 1, name: 'JavaScript', color: '#ff5c00', questions: 98, assessments: 4, date: 'Jan 10, 2025' },
    { id: 2, name: 'HTML', color: '#e03b3b', questions: 72, assessments: 3, date: 'Jan 10, 2025' },
    { id: 3, name: 'CSS', color: '#8b5cf6', questions: 54, assessments: 3, date: 'Jan 11, 2025' },
    { id: 4, name: 'DBMS', color: '#f5a623', questions: 44, assessments: 2, date: 'Jan 13, 2025' },
    { id: 5, name: 'C#', color: '#0057ff', questions: 38, assessments: 1, date: 'Jan 14, 2025' },
    { id: 6, name: 'React', color: '#06b6d4', questions: 22, assessments: 0, date: 'Feb 01, 2025' },
    { id: 7, name: 'Node.js', color: '#00c271', questions: 18, assessments: 0, date: 'Feb 05, 2025' },
    { id: 8, name: 'SQL', color: '#f5a623', questions: 30, assessments: 1, date: 'Feb 08, 2025' },
    { id: 9, name: 'Python', color: '#8b5cf6', questions: 14, assessments: 0, date: 'Feb 12, 2025' },
    { id: 10, name: 'TypeScript', color: '#0057ff', questions: 10, assessments: 0, date: 'Feb 18, 2025' },
    { id: 11, name: 'Vue.js', color: '#00c271', questions: 0, assessments: 0, date: 'Mar 01, 2025' },
    { id: 12, name: 'Angular', color: '#e03b3b', questions: 0, assessments: 0, date: 'Mar 05, 2025' },
];

const COLORS = ['#ff5c00', '#0057ff', '#00c271', '#f5a623', '#8b5cf6', '#e03b3b', '#06b6d4', '#ec4899'];

const Topics: React.FC = () => {
    const [topics, setTopics] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGridView, setIsGridView] = useState(false);

    // Create / Edit Form State
    const [topicName, setTopicName] = useState('');
    const [topicDesc, setTopicDesc] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [editingId, setEditingId] = useState<string | number | null>(null);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [sortFilter, setSortFilter] = useState('name');

    // Modal & Toast State
    const [deleteCandidate, setDeleteCandidate] = useState<{ id: string | number; name: string } | null>(null);
    const [toast, setToast] = useState<{ type: string; msg: string; show: boolean }>({ type: '', msg: '', show: false });

    const createFormRef = useRef<HTMLDivElement>(null);
    const topicNameInputRef = useRef<HTMLInputElement>(null);

    const fetchTopics = async () => {
        setIsLoading(true);
        try {
            const res = await topicsApi.getAll();
            console.log("topic list", res.data);
            // Map backend data to UI structure if needed
            const mapped = res.data.map((t: any, i: number) => ({
                id: t.id,
                name: t.name,
                color: COLORS[i % COLORS.length],
                questions: t.questionsCount || 0,
                assessments: t.assessmentsCount || 0,
                date: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A'
            }));
            setTopics(mapped);
        } catch (err) {
            showToast('error', 'Failed to fetch topics');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTopics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showToast = (type: string, msg: string) => {
        setToast({ type, msg, show: true });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

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
                // Assuming update works similarly or use a separate endpoint if available
                // Swagger didn't show PUT /topics/{id} in my brief read, let's re-check
                showToast('info', 'Update not fully implemented in backend yet.');
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
        } catch (err) {
            showToast('error', 'Operation failed');
        }
    };

    const handleEdit = (id: string | number) => {
        const t = topics.find(topic => topic.id === id);
        if (!t) return;
        setEditingId(t.id);
        setTopicName(t.name);
        setSelectedColor(t.color);
        if (createFormRef.current) {
            createFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        if (topicNameInputRef.current) {
            topicNameInputRef.current.focus();
        }
        showToast('info', `Editing "${t.name}"`);
    };

    const confirmDelete = async () => {
        if (!deleteCandidate) return;
        // Mock delete as there's no DELETE /topics in swagger (or I missed it)
        showToast('delete', 'Delete operation restricted in this demo mode.');
        setDeleteCandidate(null);
    };

    // Derived state: Filtered & Sorted Topics
    const filteredTopics = useMemo(() => {
        let result = topics.filter(t => {
            const matchName = t.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchStatus = statusFilter === 'active' ? t.questions > 0
                : statusFilter === 'empty' ? t.questions === 0
                    : true;
            return matchName && matchStatus;
        });

        if (sortFilter === 'questions') {
            result.sort((a, b) => b.questions - a.questions);
        } else if (sortFilter === 'name') {
            result.sort((a, b) => a.name.localeCompare(b.name));
        }
        // Else leave as date added (default order array)
        return result;
    }, [topics, searchQuery, statusFilter, sortFilter]);

    const maxQuestions = Math.max(...topics.map(t => t.questions), 1);
    const top5Topics = [...topics].sort((a, b) => b.questions - a.questions).slice(0, 5);
    const totalTop5Questions = top5Topics.reduce((s, t) => s + t.questions, 0) || 1;

    let toastIcon = '✅';
    if (toast.type === 'error') toastIcon = '❌';
    if (toast.type === 'info') toastIcon = 'ℹ️';
    if (toast.type === 'delete') toastIcon = '🗑️';

    return (
        <div className="topics-container">
            {/* Page Header */}
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
                            if (createFormRef.current) createFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            if (topicNameInputRef.current) topicNameInputRef.current.focus();
                        }}
                    >
                        + Create Topic
                    </button>
                </div>
            </div>

            {/* STAT CARDS */}
            <div className="stats-row">
                <div className="stat-card sc1">
                    <div className="stat-top">
                        <div className="stat-icon">🗂</div>
                        <span className="stat-chip">↑ 2 new</span>
                    </div>
                    <div className="stat-num">{topics.length}</div>
                    <div className="stat-label">Total Topics</div>
                </div>
                <div className="stat-card sc2">
                    <div className="stat-top">
                        <div className="stat-icon">❓</div>
                        <span className="stat-chip">↑ 24</span>
                    </div>
                    <div className="stat-num">{topics.reduce((acc, t) => acc + t.questions, 0)}</div>
                    <div className="stat-label">Total Questions</div>
                </div>
                <div className="stat-card sc3">
                    <div className="stat-top">
                        <div className="stat-icon">📝</div>
                    </div>
                    <div className="stat-num">{topics.filter(t => t.assessments > 0).length}</div>
                    <div className="stat-label">Topics in Assessments</div>
                </div>
                <div className="stat-card sc4">
                    <div className="stat-top">
                        <div className="stat-icon">🚫</div>
                    </div>
                    <div className="stat-num">{topics.filter(t => t.questions === 0).length}</div>
                    <div className="stat-label">Empty Topics</div>
                </div>
            </div>

            {/* MAIN LAYOUT */}
            <div className="layout-2">
                {/* LEFT: Topics Table */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">
                            📋 All Topics
                            <span className="card-count">{filteredTopics.length} topics</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setIsGridView(!isGridView)}>
                                {isGridView ? '☰ Table View' : '⊞ Grid View'}
                            </button>
                        </div>
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

                    {/* TABLE VIEW */}
                    {isLoading ? (
                        <div className="loading-state" style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
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
                                        <th>In Assessments</th>
                                        <th>Status</th>
                                        <th>Date Added</th>
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
                                                        <div className="mini-bar">
                                                            <div className="mini-fill" style={{ width: `${pct}%`, background: t.color }}></div>
                                                        </div>
                                                        <span className="qcount-num">{t.questions}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {t.assessments > 0 ? (
                                                        <span className="badge" style={{ background: 'rgba(0,87,255,.1)', color: '#0040bb' }}>
                                                            <span className="bdot"></span> {t.assessments} assessment{t.assessments > 1 ? 's' : ''}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--muted)', fontSize: '13px' }}>—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {t.questions > 0 ? (
                                                        <span className="badge badge-active"><span className="bdot"></span> Active</span>
                                                    ) : (
                                                        <span className="badge badge-empty"><span className="bdot"></span> Empty</span>
                                                    )}
                                                </td>
                                                <td style={{ color: 'var(--muted)', fontSize: '13px' }}>{t.date}</td>
                                                <td>
                                                    <div className="action-btns">
                                                        <div className="act-btn" title="View Questions" onClick={() => showToast('info', `Opening ${t.name} questions…`)}>👁</div>
                                                        <div className="act-btn" title="Edit Topic" onClick={() => handleEdit(t.id)}>✏️</div>
                                                        <div className="act-btn delete" title="Delete Topic" onClick={() => setDeleteCandidate({ id: t.id, name: t.name })}>🗑️</div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Empty state */}
                            {filteredTopics.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-icon">🗂</div>
                                    <div className="empty-title">No topics found</div>
                                    <div className="empty-sub">Try a different search or create a new topic.</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* GRID VIEW */
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '14px' }}>
                                {filteredTopics.map(t => (
                                    <div
                                        key={t.id}
                                        style={{
                                            background: '#fff', border: '1.5px solid var(--border)', borderRadius: '14px',
                                            padding: '18px', cursor: 'default', transition: 'all .2s', textAlign: 'center'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = t.color;
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.08)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = 'var(--border)';
                                            e.currentTarget.style.transform = '';
                                            e.currentTarget.style.boxShadow = '';
                                        }}
                                    >
                                        <div style={{
                                            width: '44px', height: '44px', borderRadius: '12px', background: `${t.color}18`, margin: '0 auto 12px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                                        }}>📂</div>
                                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{t.name}</div>
                                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 800, color: t.color, margin: '6px 0' }}>{t.questions}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>questions</div>
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', justifyContent: 'center' }}>
                                            <div className="act-btn delete" onClick={() => setDeleteCandidate({ id: t.id, name: t.name })}>🗑️</div>
                                            <div className="act-btn" onClick={() => handleEdit(t.id)}>✏️</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                    {/* Table Footer */}
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
                                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px', marginBottom: '10px' }} onClick={() => {
                                    setEditingId(null);
                                    setTopicName('');
                                    setTopicDesc('');
                                    setSelectedColor(COLORS[0]);
                                }}>
                                    Cancel Edit
                                </button>
                            )}

                            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }} onClick={handleCreateOrUpdate}>
                                {editingId ? '💾 Save Changes' : '+ Create Topic'}
                            </button>
                        </div>
                    </div>

                    {/* Distribution Chart */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">📊 Question Distribution</div>
                        </div>
                        <div className="dist-chart">
                            {top5Topics.map(t => {
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
                            <div className="info-stat">
                                <div className="info-stat-num">29</div>
                                <div className="info-stat-label">Avg Questions</div>
                            </div>
                            <div className="info-stat">
                                <div className="info-stat-num">82%</div>
                                <div className="info-stat-label">Topics Active</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ DELETE MODAL ═══════════════════════════════════════════ */}
            {deleteCandidate && (
                <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setDeleteCandidate(null); }}>
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

            {/* ═══ TOAST ═════════════════════════════════════════════════ */}
            <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : (toast.type === 'delete' ? '#444' : '#0d1117') }}>
                <span className="toast-icon">{toastIcon}</span>
                <span>{toast.msg}</span>
            </div>

        </div>
    );
};

export default Topics;
