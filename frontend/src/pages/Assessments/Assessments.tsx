import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assessmentsApi } from '../../services/api';
import './Assessments.css';

const Assessments: React.FC = () => {
    const navigate = useNavigate();
    const [assessments, setAssessments]   = useState<any[]>([]);
    const [filtered,    setFiltered]      = useState<any[]>([]);
    const [loading,     setLoading]       = useState(true);
    const [search,      setSearch]        = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
    const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
    };

    const fetchAssessments = async () => {
        setLoading(true);
        try {
            const res  = await assessmentsApi.getAll();
            const list: any[] = Array.isArray(res.data)
                ? res.data
                : (res.data?.items ?? res.data?.data ?? res.data?.value ?? []);
            setAssessments(list);
            setFiltered(list);
        } catch (err: any) {
            showToast('Failed to load assessments', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAssessments(); }, []);

    // ── Search + filter ───────────────────────────────────────────────
    useEffect(() => {
        let list = [...assessments];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(a => (a.title ?? a.Title ?? '').toLowerCase().includes(q));
        }
        if (statusFilter === 'active') list = list.filter(a => a.isActive ?? a.IsActive);
        if (statusFilter === 'draft')  list = list.filter(a => !(a.isActive ?? a.IsActive));
        setFiltered(list);
    }, [search, statusFilter, assessments]);

    const getVal = (a: any, ...keys: string[]) => {
        for (const k of keys) if (a[k] !== undefined && a[k] !== null) return a[k];
        return null;
    };

    const totalMarks = (a: any) => {
        const q = getVal(a, 'totalQuestions', 'TotalQuestions') ?? 0;
        const m = getVal(a, 'marksPerQuestion', 'MarksPerQuestion') ?? 1;
        return q * m;
    };

    // ── Navigate to CreateLink with FULL prefill nested under 'prefill' key ──
    // CreateLink reads:  location.state?.prefill
    const handleCreateLink = (a: any) => {
        const id    = getVal(a, 'id', 'Id') ?? '';
        const title = getVal(a, 'title', 'Title') ?? 'Untitled';

        navigate('/links/create', {
            state: {
                // ↓ Nest under 'prefill' so CreateLink.tsx can read location.state?.prefill
                prefill: {
                    assessmentId:       id,
                    assessmentTitle:    title,
                    totalQuestions:     getVal(a, 'totalQuestions',  'TotalQuestions')  ?? 0,
                    durationMinutes:    getVal(a, 'durationMinutes', 'DurationMinutes') ?? 0,
                    marksPerQuestion:   getVal(a, 'marksPerQuestion','MarksPerQuestion') ?? 1,
                    negativeMarks:      getVal(a, 'negativeMarks',   'NegativeMarks')   ?? 0,
                    isActive:           getVal(a, 'isActive',        'IsActive')        ?? false,
                },
            },
        });
    };

    return (
        <div className="assessments-container">

            {/* Page Header */}
            <div className="page-header">
                <div>
                    <div className="page-title">Assessments</div>
                    <div className="page-sub">Manage all your assessments and generate exam links.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/assessments/create')}>
                        + New Assessment
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="stats-row">
                {[
                    { label: 'Total',  val: assessments.length,                                          color: 'var(--accent2)' },
                    { label: 'Active', val: assessments.filter(a => a.isActive ?? a.IsActive).length,    color: 'var(--green)'   },
                    { label: 'Draft',  val: assessments.filter(a => !(a.isActive ?? a.IsActive)).length, color: 'var(--yellow)'  },
                ].map(s => (
                    <div className="stat-card" key={s.label}>
                        <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="toolbar">
                <div className="search-wrap">
                    <span className="search-icon">🔍</span>
                    <input
                        className="search-input"
                        type="text"
                        placeholder="Search assessments…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="search-clear" onClick={() => setSearch('')}>✕</button>
                    )}
                </div>
                <div className="filter-tabs">
                    {(['all', 'active', 'draft'] as const).map(f => (
                        <button
                            key={f}
                            className={`filter-tab ${statusFilter === f ? 'active' : ''}`}
                            onClick={() => setStatusFilter(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <div className="result-count">{filtered.length} assessment{filtered.length !== 1 ? 's' : ''}</div>
            </div>

            {/* Table */}
            <div className="table-card">
                {loading ? (
                    <div className="empty-state">
                        <div className="empty-icon">⏳</div>
                        <div className="empty-title">Loading assessments…</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <div className="empty-title">{search ? 'No results found' : 'No assessments yet'}</div>
                        <div className="empty-sub">{search ? 'Try a different search term.' : 'Create your first assessment to get started.'}</div>
                        {!search && (
                            <button
                                className="btn btn-primary btn-sm"
                                style={{ marginTop: '16px' }}
                                onClick={() => navigate('/assessments/create')}
                            >
                                + Create Assessment
                            </button>
                        )}
                    </div>
                ) : (
                    <table className="assessments-table">
                        <thead>
                            <tr>
                                <th>Assessment</th>
                                <th>Questions</th>
                                <th>Duration</th>
                                <th>Marks</th>
                                <th>Negative</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((a, i) => {
                                const id       = getVal(a, 'id', 'Id') ?? '';
                                const title    = getVal(a, 'title', 'Title') ?? 'Untitled';
                                const qs       = getVal(a, 'totalQuestions',  'TotalQuestions')  ?? 0;
                                const dur      = getVal(a, 'durationMinutes', 'DurationMinutes') ?? 0;
                                const mpq      = getVal(a, 'marksPerQuestion','MarksPerQuestion') ?? 1;
                                const neg      = getVal(a, 'negativeMarks',   'NegativeMarks')   ?? 0;
                                const isActive = getVal(a, 'isActive', 'IsActive') ?? false;
                                const marks    = totalMarks(a);

                                return (
                                    <tr key={id || i} style={{ animationDelay: `${i * 0.03}s` }}>
                                        <td>
                                            <div className="assessment-name">{title}</div>
                                            <div className="assessment-id">{id.slice(0, 8)}…</div>
                                        </td>
                                        <td><span className="pill pill-blue">{qs} Q</span></td>
                                        <td><span className="pill pill-purple">{dur} min</span></td>
                                        <td>
                                            <span className="marks-val">{marks}</span>
                                            <span className="marks-sub"> ({mpq}/Q)</span>
                                        </td>
                                        <td>
                                            {neg > 0
                                                ? <span className="pill pill-red">-{neg}/wrong</span>
                                                : <span style={{ color: 'var(--muted)', fontSize: '13px' }}>None</span>
                                            }
                                        </td>
                                        <td>
                                            <span className={`status-badge ${isActive ? 'badge-active' : 'badge-draft'}`}>
                                                <span className="bdot"></span>
                                                {isActive ? 'Active' : 'Draft'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-btns">
                                                {/* ── 🔗 passes full prefill so CreateLink pre-selects this assessment ── */}
                                                <button
                                                    className="act-btn act-link"
                                                    title="Create Exam Link"
                                                    onClick={() => handleCreateLink(a)}
                                                >
                                                    🔗
                                                </button>
                                                <button
                                                    className="act-btn act-copy"
                                                    title="Copy ID"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(id);
                                                        showToast('Assessment ID copied!', 'info');
                                                    }}
                                                >
                                                    📋
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

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

export default Assessments;
