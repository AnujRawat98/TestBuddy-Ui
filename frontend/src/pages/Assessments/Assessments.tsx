import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Copy, Eye, Link2, Mail, Plus, QrCode, Search } from 'lucide-react';
import { assessmentsApi, assessmentLinksApi } from '../../services/api';
import './Assessments.css';

function ModalPortal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
    return ReactDOM.createPortal(
        <div className="modal-overlay open" onClick={onClose}>
            <div onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>,
        document.body
    );
}

interface AssessmentLink {
    id:                string;
    name:              string;
    examStartDateTime: string;
    examEndDateTime:   string;
    isCredentialBased: boolean;
    isActive:          boolean;
    accessCode:        string;
    isExpired?:        boolean;
}

const Assessments: React.FC = () => {
    const navigate = useNavigate();

    const [assessments,  setAssessments]  = useState<any[]>([]);
    const [filtered,     setFiltered]     = useState<any[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [search,       setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
    const [toast,        setToast]        = useState({ show: false, msg: '', type: 'success' });
    const [togglingId,   setTogglingId]   = useState<string | null>(null);

    const [viewModal, setViewModal] = useState<{
        open: boolean; assessmentId: string; assessmentTitle: string;
        links: AssessmentLink[]; loading: boolean;
    }>({ open: false, assessmentId: '', assessmentTitle: '', links: [], loading: false });

    const [qrModal, setQrModal] = useState<{ open: boolean; url: string; name: string }>
        ({ open: false, url: '', name: '' });

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

            // Sort newest first
            const sorted = list.sort((a, b) => {
                const dateA = new Date(a.createdAt ?? a.CreatedAt ?? 0).getTime();
                const dateB = new Date(b.createdAt ?? b.CreatedAt ?? 0).getTime();
                return dateB - dateA;
            });

            setAssessments(sorted);
            setFiltered(sorted);
        } catch { showToast('Failed to load assessments', 'error'); }
        finally  { setLoading(false); }
    };

    useEffect(() => { fetchAssessments(); }, []);

    useEffect(() => {
        let list = [...assessments];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(a => (a.title ?? a.Title ?? '').toLowerCase().includes(q));
        }
        if (statusFilter === 'active') list = list.filter(a =>  (a.isActive ?? a.IsActive));
        if (statusFilter === 'draft')  list = list.filter(a => !(a.isActive ?? a.IsActive));
        setFiltered(list);
    }, [search, statusFilter, assessments]);

    const getVal = (a: any, ...keys: string[]) => {
        for (const k of keys) if (a[k] !== undefined && a[k] !== null) return a[k];
        return null;
    };

    // ── Toggle Draft ↔ Published ─────────────────────────────────────────────
    const handleToggleStatus = async (a: any) => {
        const id      = getVal(a, 'id', 'Id') ?? '';
        const current = getVal(a, 'isActive', 'IsActive') ?? false;
        setTogglingId(id);
        try {
            await assessmentsApi.updateStatus(id, !current);
            setAssessments(prev => prev.map(x =>
                getVal(x, 'id', 'Id') === id
                    ? { ...x, isActive: !current, IsActive: !current }
                    : x
            ));
            showToast(!current ? 'Assessment published.' : 'Assessment set to draft.');
        } catch { showToast('Failed to update status.', 'error'); }
        finally   { setTogglingId(null); }
    };

    // ── Open view links modal ────────────────────────────────────────────────
    const handleViewLinks = async (a: any) => {
        const id    = getVal(a, 'id', 'Id') ?? '';
        const title = getVal(a, 'title', 'Title') ?? 'Untitled';
        setViewModal({ open: true, assessmentId: id, assessmentTitle: title, links: [], loading: true });
        try {
            const res  = await assessmentLinksApi.getByAssessment(id);
            const list: AssessmentLink[] = Array.isArray(res.data)
                ? res.data
                : (res.data?.items ?? res.data?.data ?? []);
            setViewModal(prev => ({ ...prev, links: list, loading: false }));
        } catch { setViewModal(prev => ({ ...prev, loading: false })); }
    };

    // ── Navigate to CreateLink ───────────────────────────────────────────────
    const handleCreateLink = (a: any) => {
        setViewModal(prev => ({ ...prev, open: false }));
        setQrModal(prev => ({ ...prev, open: false }));
        navigate('/links/create', {
            state: {
                prefill: {
                    assessmentId:     getVal(a, 'id',              'Id')               ?? '',
                    assessmentTitle:  getVal(a, 'title',           'Title')            ?? 'Untitled',
                    totalQuestions:   getVal(a, 'totalQuestions',  'TotalQuestions')   ?? 0,
                    durationMinutes:  getVal(a, 'durationMinutes', 'DurationMinutes')  ?? 0,
                    marksPerQuestion: getVal(a, 'marksPerQuestion','MarksPerQuestion') ?? 1,
                    negativeMarks:    getVal(a, 'negativeMarks',   'NegativeMarks')    ?? 0,
                    isActive:         getVal(a, 'isActive',        'IsActive')         ?? false,
                },
            },
        });
    };

    // ── Navigate to Report page ──────────────────────────────────────────────
    const handleViewReport = (a: any) => {
        const id    = getVal(a, 'id', 'Id') ?? '';
        const title = getVal(a, 'title', 'Title') ?? 'Untitled';
        navigate(`/assessments/${id}/report`, {
            state: { assessmentTitle: title },
        });
    };

    // ── Share helpers ────────────────────────────────────────────────────────
    const examUrl    = (id: string)         => `${window.location.origin}/exam-entry/${id}`;
    const fmtDT      = (s: string)          => !s ? '—' : new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const linkStatus = (l: AssessmentLink)  => {
        if (l.isExpired || new Date(l.examEndDateTime) < new Date()) return 'expired';
        if (!l.isActive) return 'inactive';
        return 'active';
    };

    const copyLink   = (l: AssessmentLink) => { navigator.clipboard.writeText(examUrl(l.id)); showToast('Link copied!'); };
    const shareWA    = (l: AssessmentLink) => {
        const text = encodeURIComponent(`📝 Exam: ${viewModal.assessmentTitle}\n🔗 ${examUrl(l.id)}\n🔑 Code: ${l.accessCode}\n⏰ ${fmtDT(l.examStartDateTime)} → ${fmtDT(l.examEndDateTime)}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };
    const shareEmail = (l: AssessmentLink) => {
        const sub  = encodeURIComponent(`Exam Invitation: ${viewModal.assessmentTitle}`);
        const body = encodeURIComponent(`You are invited to: ${viewModal.assessmentTitle}\n\nLink: ${examUrl(l.id)}\nAccess Code: ${l.accessCode}\n\nStart: ${fmtDT(l.examStartDateTime)}\nEnd: ${fmtDT(l.examEndDateTime)}\n\nOpen the link, enter your email and the access code to begin.`);
        window.location.href = `mailto:?subject=${sub}&body=${body}`;
    };

    // ────────────────────────────────────────────────────────────────────────
    return (
        <div className="assessments-container">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <div className="page-title">Assessments</div>
                    <div className="page-sub">Manage all your assessments and generate exam links.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/assessments/create')}>
                        <Plus size={16} />
                        New Assessment
                    </button>
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="stats-row">
                {[
                    { label: 'Total',     val: assessments.length,                                          color: 'var(--accent2)' },
                    { label: 'Published', val: assessments.filter(a =>  (a.isActive ?? a.IsActive)).length, color: 'var(--green)'   },
                    { label: 'Draft',     val: assessments.filter(a => !(a.isActive ?? a.IsActive)).length, color: 'var(--yellow)'  },
                ].map(s => (
                    <div className="stat-card" key={s.label}>
                        <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="toolbar">
                <div className="search-wrap">
                    <span className="search-icon"><Search size={15} /></span>
                    <input className="search-input" type="text" placeholder="Search assessments…"
                        value={search} onChange={e => setSearch(e.target.value)} />
                    {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
                </div>
                <div className="filter-tabs">
                    {(['all', 'active', 'draft'] as const).map(f => (
                        <button key={f} className={`filter-tab ${statusFilter === f ? 'active' : ''}`}
                            onClick={() => setStatusFilter(f)}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <div className="result-count">{filtered.length} assessment{filtered.length !== 1 ? 's' : ''}</div>
            </div>

            {/* ── Table ── */}
            <div className="table-card">
                {loading ? (
                    <div className="empty-state">
                        <div className="empty-icon">⏳</div>
                        <div className="empty-title">Loading…</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <div className="empty-title">{search ? 'No results found' : 'No assessments yet'}</div>
                        <div className="empty-sub">{search ? 'Try a different search term.' : 'Create your first assessment to get started.'}</div>
                        {!search && (
                            <button className="btn btn-primary btn-sm" style={{ marginTop: '16px' }} onClick={() => navigate('/assessments/create')}>
                                <Plus size={16} />
                                Create Assessment
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
                                <th>Created</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((a, i) => {
                                const id       = getVal(a, 'id', 'Id') ?? '';
                                const title    = getVal(a, 'title', 'Title') ?? 'Untitled';
                                const qs       = getVal(a, 'totalQuestions',  'TotalQuestions')   ?? 0;
                                const dur      = getVal(a, 'durationMinutes', 'DurationMinutes')  ?? 0;
                                const mpq      = getVal(a, 'marksPerQuestion','MarksPerQuestion') ?? 1;
                                const neg      = getVal(a, 'negativeMarks',   'NegativeMarks')    ?? 0;
                                const isActive = getVal(a, 'isActive', 'IsActive') ?? false;
                                const toggling = togglingId === id;

                                const createdAt  = getVal(a, 'createdAt', 'CreatedAt');
                                const createdStr = createdAt
                                    ? new Date(createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : '—';

                                return (
                                    <tr key={id || i} style={{ animationDelay: `${i * 0.03}s` }}>

                                        {/* Assessment name + ID */}
                                        <td>
                                            <div className="assessment-name">{title}</div>
                                            <div className="assessment-id">{id.slice(0, 8)}…</div>
                                        </td>

                                        {/* Questions */}
                                        <td><span className="pill pill-blue">{qs} Q</span></td>

                                        {/* Duration */}
                                        <td><span className="pill pill-purple">{dur} min</span></td>

                                        {/* Marks */}
                                        <td>
                                            <span className="marks-val">{qs * mpq}</span>
                                            <span className="marks-sub"> ({mpq}/Q)</span>
                                        </td>

                                        {/* Negative marks */}
                                        <td>
                                            {neg > 0
                                                ? <span className="pill pill-red">-{neg}/wrong</span>
                                                : <span style={{ color: 'var(--muted)', fontSize: '13px' }}>None</span>}
                                        </td>

                                        {/* Created date */}
                                        <td>
                                            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{createdStr}</span>
                                        </td>

                                        {/* Status toggle */}
                                        <td>
                                            <button
                                                className={`status-badge status-toggle ${isActive ? 'badge-active' : 'badge-draft'} ${toggling ? 'toggling' : ''}`}
                                                onClick={() => handleToggleStatus(a)}
                                                disabled={toggling}
                                                title={`Click to ${isActive ? 'set as Draft' : 'Publish'}`}
                                            >
                                                <span className="bdot" />
                                                {toggling ? '…' : isActive ? 'Published' : 'Draft'}
                                            </button>
                                        </td>

                                        {/* Actions: Create Link | View Links | Report */}
                                        <td>
                                            <div className="action-btns">
                                                <button
                                                    className="act-btn act-link"
                                                    title="Create Exam Link"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCreateLink(a);
                                                    }}
                                                >
                                                    <Link2 size={15} />
                                                </button>
                                                <button
                                                    className="act-btn act-view"
                                                    title="View Links"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleViewLinks(a);
                                                    }}
                                                >
                                                    <Eye size={15} />
                                                </button>
                                                <button
                                                    className="act-btn act-report"
                                                    title="View Report"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleViewReport(a);
                                                    }}
                                                >
                                                    <BarChart3 size={15} />
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

            {/* ── View Links Modal ─────────────────────────────────────────────── */}
            {viewModal.open && (
                <ModalPortal onClose={() => setViewModal(p => ({ ...p, open: false }))}>
                    <div className="modal" style={{ maxWidth: '820px', width: '96vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">Exam Links</div>
                                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>{viewModal.assessmentTitle}</div>
                            </div>
                            <button className="modal-close" onClick={() => setViewModal(p => ({ ...p, open: false }))}>✕</button>
                        </div>

                        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: 0 }}>
                            {viewModal.loading ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>⏳ Loading links…</div>
                            ) : viewModal.links.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                                    <div className="modal-empty-icon"><Link2 size={30} /></div>
                                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px', color: 'var(--ink)' }}>No links yet</div>
                                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Create a link to share this assessment with students.</div>
                                    <button className="btn btn-primary btn-sm" onClick={() => {
                                        setViewModal(p => ({ ...p, open: false }));
                                        const found = assessments.find(a => getVal(a, 'id', 'Id') === viewModal.assessmentId);
                                        if (found) handleCreateLink(found);
                                    }}>
                                        <Link2 size={16} />
                                        Create Exam Link
                                    </button>
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                                            {['Link Name', 'Start', 'End', 'Type', 'Status', 'Share'].map(h => (
                                                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewModal.links.map((lnk, i) => {
                                            const st     = linkStatus(lnk);
                                            const sColor = st === 'active' ? 'var(--green)' : st === 'expired' ? 'var(--red)' : 'var(--muted)';
                                            const sBg    = st === 'active' ? 'rgba(0,194,113,.12)' : st === 'expired' ? 'rgba(224,59,59,.1)' : 'rgba(138,138,138,.1)';
                                            return (
                                                <tr key={lnk.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '13px 16px' }}>
                                                        <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: '3px' }}>{lnk.name || '—'}</div>
                                                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent2)', background: 'rgba(0,87,255,.07)', padding: '1px 6px', borderRadius: '4px' }}>🔑 {lnk.accessCode}</span>
                                                    </td>
                                                    <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>{fmtDT(lnk.examStartDateTime)}</td>
                                                    <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>{fmtDT(lnk.examEndDateTime)}</td>
                                                    <td style={{ padding: '13px 16px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '100px', background: lnk.isCredentialBased ? 'rgba(139,92,246,.12)' : 'rgba(0,87,255,.1)', color: lnk.isCredentialBased ? '#8b5cf6' : 'var(--accent2)' }}>
                                                            {lnk.isCredentialBased ? 'Credential' : 'Direct'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '13px 16px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '100px', background: sBg, color: sColor }}>
                                                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 5, verticalAlign: 'middle' }} />
                                                            {st === 'active' ? 'Active' : st === 'expired' ? 'Expired' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '13px 16px' }}>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button className="share-btn" title="Copy link" onClick={() => copyLink(lnk)}><Copy size={14} /></button>
                                                            <button className="share-btn share-wa" title="WhatsApp" onClick={() => shareWA(lnk)}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                                                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.528 5.855L0 24l6.326-1.508C8.02 23.459 9.972 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.907 0-3.682-.527-5.192-1.438l-.37-.22-3.753.894.939-3.652-.243-.385C2.618 15.452 2.182 13.77 2.182 12 2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                                                                </svg>
                                                            </button>
                                                            <button className="share-btn share-email" title="Email" onClick={() => shareEmail(lnk)}><Mail size={14} /></button>
                                                            <button className="share-btn share-qr" title="QR Code" onClick={() => setQrModal({ open: true, url: examUrl(lnk.id), name: lnk.name || viewModal.assessmentTitle })}><QrCode size={14} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary btn-sm" onClick={() => setViewModal(p => ({ ...p, open: false }))}>Close</button>
                            <button className="btn btn-primary btn-sm" onClick={() => {
                                setViewModal(p => ({ ...p, open: false }));
                                const found = assessments.find(a => getVal(a, 'id', 'Id') === viewModal.assessmentId);
                                if (found) handleCreateLink(found);
                            }}>
                                <Link2 size={16} />
                                Create New Link
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* ── QR Modal ─────────────────────────────────────────────────────── */}
            {qrModal.open && (
                <ModalPortal onClose={() => setQrModal(p => ({ ...p, open: false }))}>
                    <div className="modal" style={{ maxWidth: '360px', width: '90vw' }}>
                        <div className="modal-header">
                            <div className="modal-title">QR Code</div>
                            <button className="modal-close" onClick={() => setQrModal(p => ({ ...p, open: false }))}>✕</button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '28px 24px' }}>
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrModal.url)}`}
                                alt="QR"
                                style={{ width: 200, height: 200, borderRadius: 12, border: '1px solid var(--border)' }}
                            />
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px' }}>{qrModal.name}</div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setQrModal(p => ({ ...p, open: false }))}>Close</button>
                            <button className="btn btn-primary btn-sm"   style={{ flex: 1, justifyContent: 'center' }} onClick={() => { navigator.clipboard.writeText(qrModal.url); showToast('Link copied!'); }}>
                                <Copy size={15} />
                                Copy
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* ── Toast ── */}
            <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'info' ? '#1a2540' : '#0d1117' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
                <span>{toast.msg}</span>
            </div>

        </div>
    );
};

export default Assessments;
