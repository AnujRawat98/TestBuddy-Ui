import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { assessmentLinksApi, assessmentsApi, proctoringApi } from '../../services/api';
import './AssessmentReport.css';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AssessmentLink {
    id: string; name: string;
    examStartDateTime: string; examEndDateTime: string;
    isCredentialBased: boolean; isActive: boolean; accessCode: string;
    maxAttempts: number; isWebProctoring: boolean;
    isImageProctoring: boolean; isScreenRecording: boolean;
    warningAction?: string;
}

interface SnapshotItem {
    originalUrl: string;
    blobUrl:     string;
    capturedAt?: string;
    isFlagged?:  boolean;
    loading:     boolean;
    error:       boolean;
}

interface CandidateSession {
    sessionId:              string;
    assessmentAttemptId:    string;
    proctoringSessionId:    string;
    candidateEmail:         string;
    startedAt:              string;
    endedAt:                string | null;
    status?:                string;
    score?:                 number;
    totalMarks?:            number;
    correct?:               number;
    wrong?:                 number;
    unattempted?:           number;
    percentage?:            number;
    passed?:                boolean;
    totalQuestions?:        number;
    obtainedMarks?:         number;
    riskScore:              number;
    riskLevel:              string;
    totalViolations:        number;
    tabSwitchCount:         number;
    fullscreenExitCount:    number;
    devToolsCount:          number;
    copyPasteCount:         number;
    totalSnapshots:         number;
    flaggedSnapshots:       number;
    reviewStatus:           string;
    recordingUrl:           string | null;
    screenRecordingEnabled: boolean;
    snapshotItems:          SnapshotItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDT = (s: string) =>
    !s ? '—' : new Date(s).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });

const fmtDate = (s: string) =>
    !s ? '—' : new Date(s).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });

const riskColor = (level: string) => {
    switch ((level ?? '').toLowerCase()) {
        case 'high':   return { color: '#e03b3b',      bg: 'rgba(224,59,59,.12)'  };
        case 'medium': return { color: '#f5a623',      bg: 'rgba(245,166,35,.12)' };
        case 'low':    return { color: '#00c271',      bg: 'rgba(0,194,113,.12)'  };
        default:       return { color: 'var(--muted)', bg: 'rgba(138,138,138,.1)' };
    }
};

const reviewColor = (status: string) => {
    switch ((status ?? '').toLowerCase()) {
        case 'flagged': return { color: '#e03b3b', bg: 'rgba(224,59,59,.12)'  };
        case 'cleared': return { color: '#00c271', bg: 'rgba(0,194,113,.12)'  };
        default:        return { color: '#f5a623', bg: 'rgba(245,166,35,.12)' };
    }
};

// ─── Images load directly now that CORS is fixed in Program.cs ───────────────
// No blob conversion needed — just return the URL as-is.
const fetchBlobUrl = async (url: string): Promise<string> => url;

// ─── Main Component ───────────────────────────────────────────────────────────
const AssessmentReport: React.FC = () => {
    const { assessmentId } = useParams<{ assessmentId: string }>();
    const location         = useLocation();
    const navigate         = useNavigate();
    const printRef         = useRef<HTMLDivElement>(null);

    const state            = location.state as any;
    const assessmentTitle  = state?.assessmentTitle  ?? 'Assessment';
    const totalQuestions   = state?.totalQuestions   ?? 0;
    const durationMinutes  = state?.durationMinutes  ?? 0;
    const marksPerQuestion = state?.marksPerQuestion ?? 1;
    const negativeMarks    = state?.negativeMarks    ?? 0;

    const [linkType,        setLinkType]        = useState<'credential' | 'direct'>('credential');
    const [links,           setLinks]           = useState<AssessmentLink[]>([]);
    const [selectedLink,    setSelectedLink]    = useState<AssessmentLink | null>(null);
    const [sessions,        setSessions]        = useState<CandidateSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<CandidateSession | null>(null);
    const [loadingLinks,    setLoadingLinks]    = useState(true);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [loadingReport,   setLoadingReport]   = useState(false);
    const [search,          setSearch]          = useState('');
    const [shareModal,      setShareModal]      = useState(false);
    const [toast,           setToast]           = useState({ show: false, msg: '', type: 'success' });

    // Photo gallery
    const [photoModal, setPhotoModal] = useState(false);
    const [photoIndex, setPhotoIndex] = useState(0);
    const [snapItems,  setSnapItems]  = useState<SnapshotItem[]>([]);

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
    };

    const filteredLinks    = links.filter(l => l.isCredentialBased === (linkType === 'credential'));
    const filteredSessions = sessions.filter(s =>
        !search.trim() || s.candidateEmail?.toLowerCase().includes(search.toLowerCase()));

    const linkStats = selectedLink ? {
        total:   sessions.length,
        passed:  sessions.filter(s => s.status === 'Submitted' || s.passed === true).length,
        ongoing: sessions.filter(s => !s.endedAt && s.status !== 'Submitted').length,
    } : null;

    // ── No blob URLs to revoke — images use direct URLs ──────────────────────────
    const revokeBlobUrls = useCallback(() => {}, []);

    // ── Load each snapshot image as a blob ────────────────────────────────────
        const loadSnapshotBlobs = useCallback((
        rawItems: { originalUrl: string; capturedAt?: string; isFlagged?: boolean }[]
    ) => {
        revokeBlobUrls();
        // CORS is now fixed in Program.cs — images load directly via src URL
        setSnapItems(rawItems.map(it => ({
            ...it,
            blobUrl: it.originalUrl,
            loading: false,
            error:   false,
        })));
    }, [revokeBlobUrls]);

    // ── Fetch snapshots: GET /api/proctoring/snapshots/{sessionId} ────────────
    // Matches your existing ProctoringController → GetSnapshots(Guid sessionId)
    const loadSnapshotsForSession = useCallback(async (proctoringSessionId: string) => {
        if (!proctoringSessionId) return;
        try {
            const res  = await proctoringApi.getSnapshots(proctoringSessionId);
            const list: any[] = Array.isArray(res.data)
                ? res.data
                : (res.data?.items ?? res.data?.data ?? []);

            if (list.length === 0) { showToast('No snapshot images found', 'info'); return; }

            const rawItems = list.map((item: any) => ({
                // SnapshotDto fields from your backend
                originalUrl: item.url        ?? item.imageUrl  ?? item.snapshotUrl
                          ?? item.filePath   ?? item.path      ?? item.src ?? '',
                capturedAt:  item.capturedAt ?? item.takenAt   ?? item.timestamp ?? '',
                isFlagged:   item.isFlagged  ?? item.flagged   ?? false,
            })).filter((i: any) => i.originalUrl);

            loadSnapshotBlobs(rawItems);
        } catch (err) {
            console.error('Failed to fetch snapshots:', err);
            showToast('Could not load snapshot images', 'error');
        }
    }, [loadSnapshotBlobs]);

    // ── Load links ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!assessmentId) return;
        (async () => {
            setLoadingLinks(true);
            try {
                const res  = await assessmentLinksApi.getByAssessment(assessmentId);
                const list: AssessmentLink[] = Array.isArray(res.data)
                    ? res.data : (res.data?.items ?? res.data?.data ?? []);
                setLinks(list);
                const first = list.find(l => l.isCredentialBased === (linkType === 'credential'));
                if (first) handleSelectLink(first);
            } catch { showToast('Failed to load links', 'error'); }
            finally  { setLoadingLinks(false); }
        })();
    }, [assessmentId]);

    useEffect(() => {
        const first = filteredLinks[0];
        if (first && first.id !== selectedLink?.id) handleSelectLink(first);
        else if (!first) { setSelectedLink(null); setSessions([]); setSelectedSession(null); }
    }, [linkType]);

    // ── Select link → load candidates ────────────────────────────────────────
    const handleSelectLink = async (link: AssessmentLink) => {
        setSelectedLink(link);
        setSelectedSession(null);
        setSearch('');
        setLoadingSessions(true);
        setSessions([]);
        revokeBlobUrls();
        setSnapItems([]);
        try {
            const res  = await assessmentsApi.getAttemptsByLink(link.id);
            const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? res.data?.data ?? []);
            const mapped: CandidateSession[] = list.map((a: any) => ({
                sessionId:           a.attemptId   ?? a.id       ?? '',
                assessmentAttemptId: a.attemptId   ?? a.id       ?? '',
                proctoringSessionId: '',
                candidateEmail:      a.userEmail   ?? a.UserEmail ?? '—',
                startedAt:           a.startedAt   ?? a.StartedAt ?? '',
                endedAt:             a.submittedAt ?? a.SubmittedAt ?? null,
                score:               a.score       ?? undefined,
                status:              a.status      ?? '',
                riskScore: 0, riskLevel: '', totalViolations: 0,
                tabSwitchCount: 0, fullscreenExitCount: 0, devToolsCount: 0,
                copyPasteCount: 0, totalSnapshots: 0, flaggedSnapshots: 0,
                reviewStatus: '', recordingUrl: null, screenRecordingEnabled: false,
                snapshotItems: [],
            }));
            setSessions(mapped);
        } catch { showToast('Failed to load candidates', 'error'); }
        finally  { setLoadingSessions(false); }
    };

    // ── Select candidate → load full report ───────────────────────────────────
    const handleSelectCandidate = async (s: CandidateSession) => {
        setSelectedSession(s);
        setLoadingReport(true);
        setPhotoIndex(0);
        revokeBlobUrls();
        setSnapItems([]);

        try {
            const res = await assessmentsApi.getAttemptFullReport(s.assessmentAttemptId);
            if (res?.data) {
                const d        = res.data;
                const totalM   = d.totalMarks    ?? (totalQuestions * marksPerQuestion);
                const obtained = d.obtainedMarks ?? d.score ?? 0;
                const pct      = totalM > 0 ? Math.round((obtained / totalM) * 100) : 0;

                // proctoringSessionId is returned by GetAttemptFullReport stored procedure
                const sessionId = d.proctoringSessionId ?? '';

                setSelectedSession(prev => prev ? {
                    ...prev,
                    proctoringSessionId:    sessionId,
                    score:                  obtained,
                    obtainedMarks:          obtained,
                    totalMarks:             totalM,
                    totalQuestions:         d.totalQuestions        ?? totalQuestions,
                    correct:                d.correct               ?? 0,
                    wrong:                  d.wrong                 ?? 0,
                    unattempted:            d.unattempted           ?? 0,
                    percentage:             pct,
                    status:                 d.status                ?? prev.status,
                    endedAt:                d.endedAt               ?? prev.endedAt,
                    riskScore:              d.riskScore             ?? 0,
                    riskLevel:              d.riskLevel             ?? '',
                    totalViolations:        d.totalViolations       ?? 0,
                    tabSwitchCount:         d.tabSwitchCount        ?? 0,
                    fullscreenExitCount:    d.fullscreenExitCount   ?? 0,
                    devToolsCount:          d.devToolsCount         ?? 0,
                    copyPasteCount:         d.copyPasteCount        ?? 0,
                    totalSnapshots:         d.totalSnapshots        ?? 0,
                    flaggedSnapshots:       d.flaggedSnapshots      ?? 0,
                    reviewStatus:           d.reviewStatus          ?? '',
                    recordingUrl:           d.recordingUrl          ?? null,
                    screenRecordingEnabled: d.screenRecordingEnabled ?? false,
                    snapshotItems:          [],
                } : prev);

                // Load snapshot images using proctoringSessionId
                // Calls: GET /api/proctoring/snapshots/{sessionId}
                if ((d.totalSnapshots ?? 0) > 0 && sessionId) {
                    loadSnapshotsForSession(sessionId);
                }
            }
        } catch {
            // show basic info only
        } finally {
            setLoadingReport(false);
        }
    };

    const handleDownloadPDF = () => { if (!selectedSession) return; window.print(); showToast('Preparing PDF…', 'info'); };

    const handleShareWA = () => {
        if (!selectedSession || !selectedLink) return;
        const s      = selectedSession;
        const totalM = (s.totalMarks ?? (totalQuestions * marksPerQuestion)) || 0;
        const text   = encodeURIComponent(
            `📋 *Exam Report — ${assessmentTitle}*\n` +
            `👤 ${s.candidateEmail}\n` +
            `🎯 Score: ${s.obtainedMarks ?? s.score ?? '—'} / ${totalM || '—'}\n` +
            `✅ Correct: ${s.correct ?? '—'}   ❌ Wrong: ${s.wrong ?? '—'}\n` +
            `📊 ${s.percentage ?? '—'}%\n` +
            `⚠️ Violations: ${s.totalViolations ?? 0}\n` +
            `🔗 ${selectedLink.name}`
        );
        window.open(`https://wa.me/?text=${text}`, '_blank');
        setShareModal(false);
    };

    const computeTotalMarks = (s: CandidateSession): string | number =>
        (s.totalMarks ?? (totalQuestions * marksPerQuestion)) || '—';

    // ── Photo gallery helpers ──────────────────────────────────────────────────
    const openPhotoModal = () => { setPhotoIndex(0); setPhotoModal(true); };

    const goPhoto = useCallback((dir: 1 | -1) => {
        setPhotoIndex(i => Math.max(0, Math.min(snapItems.length - 1, i + dir)));
    }, [snapItems.length]);

    useEffect(() => {
        if (!photoModal) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft')  goPhoto(-1);
            if (e.key === 'ArrowRight') goPhoto(1);
            if (e.key === 'Escape')     setPhotoModal(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [photoModal, goPhoto]);

    const currentSnap     = snapItems[photoIndex];
    const totalSnapsCount = selectedSession?.totalSnapshots ?? snapItems.length;
    const flaggedCount    = selectedSession?.flaggedSnapshots ?? snapItems.filter(s => s.isFlagged).length;

    return (
        <div className="rp-root">

            {/* ── Top Bar ── */}
            <div className="rp-topbar">
                <div className="rp-topbar-left">
                    <button className="rp-back-btn" onClick={() => navigate('/assessments')}>← Back</button>
                    <div className="rp-assessment-info">
                        <div className="rp-assessment-name">{assessmentTitle}</div>
                        <div className="rp-assessment-meta">
                            {totalQuestions   > 0 && <span className="rp-meta-pill">{totalQuestions} Questions</span>}
                            {durationMinutes  > 0 && <span className="rp-meta-pill">{durationMinutes} min</span>}
                            {marksPerQuestion > 0 && <span className="rp-meta-pill">{marksPerQuestion} marks/Q</span>}
                            {negativeMarks    > 0 && <span className="rp-meta-pill rp-meta-red">-{negativeMarks} negative</span>}
                            <span className="rp-meta-pill">{links.length} link{links.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>
                <div className="rp-toggle-wrap">
                    <button className={`rp-toggle-btn ${linkType === 'credential' ? 'active' : ''}`} onClick={() => setLinkType('credential')}>🔐 Credential</button>
                    <button className={`rp-toggle-btn ${linkType === 'direct'     ? 'active' : ''}`} onClick={() => setLinkType('direct')}>🔓 Direct</button>
                </div>
            </div>

            {/* ── 3-Panel Body ── */}
            <div className="rp-body">

                {/* ══ PANEL 1 — Links ══ */}
                <div className="rp-panel rp-panel-links">
                    <div className="rp-panel-header">
                        <span className="rp-panel-title">Exam Links</span>
                        <span className="rp-panel-count">{filteredLinks.length}</span>
                    </div>
                    <div className="rp-links-list">
                        {loadingLinks ? <div className="rp-empty">⏳ Loading…</div>
                        : filteredLinks.length === 0 ? (
                            <div className="rp-empty"><div style={{ fontSize: '28px', marginBottom: '8px' }}>🔗</div>No {linkType} links yet</div>
                        ) : filteredLinks.map(link => {
                            const expired  = new Date() > new Date(link.examEndDateTime);
                            const active   = link.isActive && !expired;
                            const selected = selectedLink?.id === link.id;
                            return (
                                <div key={link.id} className={`rp-link-item ${selected ? 'selected' : ''}`} onClick={() => handleSelectLink(link)}>
                                    <div className="rp-link-item-top">
                                        <div className="rp-link-item-name">{link.name || '—'}</div>
                                        <span className="rp-status-dot" style={{ background: active ? '#00c271' : expired ? '#e03b3b' : '#aaa' }} />
                                    </div>
                                    <div className="rp-link-item-dates">{fmtDate(link.examStartDateTime)} → {fmtDate(link.examEndDateTime)}</div>
                                    <div className="rp-link-item-footer">
                                        <span className="rp-link-code">🔑 {link.accessCode}</span>
                                        <div className="rp-link-proc-tags">
                                            {link.isWebProctoring   && <span className="rp-ptag">🌐</span>}
                                            {link.isImageProctoring && <span className="rp-ptag">📸</span>}
                                            {link.isScreenRecording && <span className="rp-ptag">🖥</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {selectedLink && (
                        <div className="rp-link-detail-footer">
                            <div className="rp-ldf-title">Link Details</div>
                            <div className="rp-ldf-row"><span>Max Attempts</span><span>{selectedLink.maxAttempts === 0 ? 'Unlimited' : selectedLink.maxAttempts}</span></div>
                            <div className="rp-ldf-row"><span>Web Proctoring</span><span style={{ color: selectedLink.isWebProctoring ? '#00c271' : 'var(--muted)' }}>{selectedLink.isWebProctoring ? '✓ On' : '✗ Off'}</span></div>
                            <div className="rp-ldf-row"><span>Camera</span><span style={{ color: selectedLink.isImageProctoring ? '#00c271' : 'var(--muted)' }}>{selectedLink.isImageProctoring ? '✓ On' : '✗ Off'}</span></div>
                            <div className="rp-ldf-row"><span>Screen Rec.</span><span style={{ color: selectedLink.isScreenRecording ? '#00c271' : 'var(--muted)' }}>{selectedLink.isScreenRecording ? '✓ On' : '✗ Off'}</span></div>
                        </div>
                    )}
                </div>

                {/* ══ PANEL 2 — Candidates ══ */}
                <div className="rp-panel rp-panel-candidates">
                    {!selectedLink ? (
                        <div className="rp-empty rp-empty-full"><div style={{ fontSize: '36px', marginBottom: '12px' }}>👈</div>Select a link to view candidates</div>
                    ) : (
                        <>
                            <div className="rp-panel-header">
                                <div>
                                    <span className="rp-panel-title">Candidates</span>
                                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{selectedLink.name}</div>
                                </div>
                                <span className="rp-panel-count">{filteredSessions.length}</span>
                            </div>
                            <div className="rp-candidate-search">
                                <span className="rp-search-icon">🔍</span>
                                <input type="text" placeholder="Search by email…" value={search} onChange={e => setSearch(e.target.value)} className="rp-search-input" />
                                {search && <button className="rp-search-clear" onClick={() => setSearch('')}>✕</button>}
                            </div>
                            <div className="rp-candidates-list">
                                {loadingSessions ? <div className="rp-empty">⏳ Loading candidates…</div>
                                : filteredSessions.length === 0 ? (
                                    <div className="rp-empty">
                                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>👤</div>
                                        {sessions.length === 0 ? 'No candidates have attempted this exam yet' : 'No results'}
                                    </div>
                                ) : filteredSessions.map((s, i) => {
                                    const rc       = riskColor(s.riskLevel);
                                    const selected = selectedSession?.sessionId === s.sessionId;
                                    const initials = (s.candidateEmail ?? '?')[0].toUpperCase();
                                    const submitted = s.status === 'Submitted' || !!s.endedAt;
                                    return (
                                        <div key={s.sessionId || i} className={`rp-candidate-item ${selected ? 'selected' : ''}`} onClick={() => handleSelectCandidate(s)}>
                                            <div className="rp-candidate-avatar">{initials}</div>
                                            <div className="rp-candidate-info">
                                                <div className="rp-candidate-email">{s.candidateEmail || '—'}</div>
                                                <div className="rp-candidate-meta">
                                                    {fmtDate(s.startedAt)}
                                                    {submitted
                                                        ? <span style={{ color: '#00c271', marginLeft: '6px', fontWeight: 600 }}>● Submitted</span>
                                                        : <span style={{ color: '#f5a623', marginLeft: '6px' }}>● In Progress</span>}
                                                </div>
                                            </div>
                                            <div className="rp-candidate-right">
                                                {s.score !== undefined && <div className="rp-candidate-score">{s.score}</div>}
                                                {s.riskLevel && <span className="rp-candidate-risk" style={{ color: rc.color, background: rc.bg }}>{s.riskLevel}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {linkStats && (
                                <div className="rp-candidates-footer">
                                    <div className="rp-cf-stat"><span className="rp-cf-val">{linkStats.total}</span><span className="rp-cf-lbl">Total</span></div>
                                    <div className="rp-cf-stat"><span className="rp-cf-val" style={{ color: '#00c271' }}>{linkStats.passed}</span><span className="rp-cf-lbl">Submitted</span></div>
                                    <div className="rp-cf-stat"><span className="rp-cf-val" style={{ color: '#f5a623' }}>{linkStats.ongoing}</span><span className="rp-cf-lbl">Ongoing</span></div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ══ PANEL 3 — Report Card ══ */}
                <div className="rp-panel rp-panel-report">
                    {!selectedSession ? (
                        <div className="rp-empty rp-empty-full"><div style={{ fontSize: '36px', marginBottom: '12px' }}>👤</div>Select a candidate to view their report</div>
                    ) : (
                        <>
                            <div className="rp-report-header">
                                <div className="rp-report-candidate-info">
                                    <div className="rp-report-avatar">{(selectedSession.candidateEmail ?? '?')[0].toUpperCase()}</div>
                                    <div>
                                        <div className="rp-report-email">{selectedSession.candidateEmail}</div>
                                        <div className="rp-report-date">📅 {fmtDT(selectedSession.startedAt)}</div>
                                    </div>
                                </div>
                                <div className="rp-report-actions">
                                    <button className="rp-action-btn rp-btn-share" onClick={() => setShareModal(true)}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>
                                        Share
                                    </button>
                                    <button className="rp-action-btn rp-btn-download" onClick={handleDownloadPDF}>↓ Download PDF</button>
                                </div>
                            </div>

                            <div className="rp-report-body" ref={printRef}>
                                {loadingReport && (
                                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: '13px' }}>
                                        ⏳ Loading full report…
                                    </div>
                                )}

                                {/* Score card */}
                                <div className="rp-score-card">
                                    <div className="rp-score-main">
                                        <div className="rp-score-circle" style={{ borderColor: selectedSession.passed === true ? '#00c271' : selectedSession.passed === false ? '#e03b3b' : 'var(--accent2)' }}>
                                            <div className="rp-score-num">{selectedSession.obtainedMarks ?? selectedSession.score ?? '—'}</div>
                                            <div className="rp-score-denom">/ {computeTotalMarks(selectedSession)}</div>
                                        </div>
                                        <div className="rp-score-details">
                                            {selectedSession.passed !== undefined ? (
                                                <div className="rp-pass-badge" style={{ background: selectedSession.passed ? 'rgba(0,194,113,.12)' : 'rgba(224,59,59,.12)', color: selectedSession.passed ? '#00c271' : '#e03b3b' }}>
                                                    {selectedSession.passed ? '✅ PASSED' : '❌ FAILED'}
                                                </div>
                                            ) : (
                                                <div className="rp-pass-badge" style={{ background: 'rgba(0,87,255,.1)', color: 'var(--accent2)' }}>
                                                    📋 {selectedSession.status || 'Submitted'}
                                                </div>
                                            )}
                                            {selectedSession.percentage !== undefined && (
                                                <div className="rp-score-pct">{selectedSession.percentage}% Score</div>
                                            )}
                                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{selectedLink?.name}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Exam Performance */}
                                <div className="rp-section-title">📋 Exam Performance</div>
                                <div className="rp-stats-grid">
                                    {[
                                        { label: 'Total Questions', val: selectedSession.totalQuestions ?? totalQuestions ?? '—', color: 'var(--accent2)' },
                                        { label: 'Attempted',       val: (selectedSession.correct !== undefined && selectedSession.wrong !== undefined) ? selectedSession.correct + selectedSession.wrong : '—', color: 'var(--ink)' },
                                        { label: 'Correct',         val: selectedSession.correct     ?? '—', color: '#00c271' },
                                        { label: 'Wrong',           val: selectedSession.wrong       ?? '—', color: '#e03b3b' },
                                        { label: 'Unattempted',     val: selectedSession.unattempted ?? '—', color: '#f5a623' },
                                        { label: 'Total Marks',     val: computeTotalMarks(selectedSession), color: 'var(--ink)' },
                                        { label: 'Marks Obtained',  val: selectedSession.obtainedMarks ?? selectedSession.score ?? '—', color: '#00c271' },
                                        { label: 'Negative Marks',  val: selectedSession.wrong !== undefined && negativeMarks > 0
                                            ? `-${(selectedSession.wrong * negativeMarks).toFixed(2)}` : '0', color: '#e03b3b' },
                                    ].map(stat => (
                                        <div className="rp-stat-box" key={stat.label}>
                                            <div className="rp-stat-val" style={{ color: stat.color }}>{stat.val}</div>
                                            <div className="rp-stat-lbl">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Proctoring Summary */}
                                <div className="rp-section-title">🔒 Proctoring Summary</div>
                                <div className="rp-violations-grid">
                                    {[
                                        { icon: '⚠️', label: 'Total Violations',  val: selectedSession.totalViolations     ?? 0, danger: (selectedSession.totalViolations     ?? 0) > 0  },
                                        { icon: '🔄', label: 'Tab Switches',       val: selectedSession.tabSwitchCount      ?? 0, danger: (selectedSession.tabSwitchCount      ?? 0) > 3  },
                                        { icon: '🖥',  label: 'Fullscreen Exits',  val: selectedSession.fullscreenExitCount ?? 0, danger: (selectedSession.fullscreenExitCount ?? 0) > 2  },
                                        { icon: '🛠',  label: 'DevTools Opens',    val: selectedSession.devToolsCount       ?? 0, danger: (selectedSession.devToolsCount       ?? 0) > 0  },
                                        { icon: '📋', label: 'Copy Attempts',      val: selectedSession.copyPasteCount      ?? 0, danger: (selectedSession.copyPasteCount      ?? 0) > 0  },
                                        { icon: '📸', label: 'Snapshots',          val: selectedSession.totalSnapshots      ?? 0, danger: false },
                                        { icon: '🚩', label: 'Flagged Snaps',      val: selectedSession.flaggedSnapshots    ?? 0, danger: (selectedSession.flaggedSnapshots    ?? 0) > 0  },
                                        { icon: '🎯', label: 'Risk Score',         val: `${selectedSession.riskScore ?? 0}%`,   danger: (selectedSession.riskScore           ?? 0) > 60 },
                                    ].map(v => (
                                        <div className="rp-violation-box" key={v.label}>
                                            <div className="rp-violation-icon">{v.icon}</div>
                                            <div className="rp-violation-val" style={{ color: v.danger ? '#e03b3b' : 'var(--ink)' }}>{v.val}</div>
                                            <div className="rp-violation-lbl">{v.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Badges */}
                                <div className="rp-badges-row">
                                    <div>
                                        <div className="rp-badge-label">Risk Level</div>
                                        <span className="rp-badge" style={{ color: riskColor(selectedSession.riskLevel).color, background: riskColor(selectedSession.riskLevel).bg }}>
                                            {selectedSession.riskLevel || 'N/A'}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="rp-badge-label">Review Status</div>
                                        <span className="rp-badge" style={{ color: reviewColor(selectedSession.reviewStatus).color, background: reviewColor(selectedSession.reviewStatus).bg }}>
                                            {selectedSession.reviewStatus || 'Pending'}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="rp-badge-label">Screen Recording</div>
                                        <span className="rp-badge" style={{ color: selectedSession.screenRecordingEnabled ? '#00c271' : 'var(--muted)', background: selectedSession.screenRecordingEnabled ? 'rgba(0,194,113,.1)' : 'rgba(138,138,138,.1)' }}>
                                            {selectedSession.screenRecordingEnabled ? '✓ Recorded' : '✗ Off'}
                                        </span>
                                    </div>
                                    {selectedSession.recordingUrl && (
                                        <div>
                                            <div className="rp-badge-label">Recording</div>
                                            <a href={selectedSession.recordingUrl} target="_blank" rel="noreferrer"
                                               className="rp-badge rp-badge-link" style={{ color: 'var(--accent2)', background: 'rgba(0,87,255,.1)' }}>▶ Watch</a>
                                        </div>
                                    )}
                                    {totalSnapsCount > 0 && (
                                        <div>
                                            <div className="rp-badge-label">Proctoring Images</div>
                                            <button className="rp-badge rp-snap-btn" onClick={openPhotoModal}>
                                                <span>📷</span>
                                                <span>View Photos</span>
                                                <span className="rp-snap-count" style={{
                                                    background: flaggedCount > 0 ? '#e03b3b' : 'rgba(224,123,0,.25)',
                                                    color:      flaggedCount > 0 ? '#fff'    : '#b85c00',
                                                }}>
                                                    {totalSnapsCount}{flaggedCount > 0 && <> · 🚩{flaggedCount}</>}
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Timing */}
                                <div className="rp-section-title">⏱ Timing</div>
                                <div className="rp-timing-row">
                                    <div className="rp-timing-box"><div className="rp-timing-label">Started At</div><div className="rp-timing-val">{fmtDT(selectedSession.startedAt)}</div></div>
                                    <div className="rp-timing-box">
                                        <div className="rp-timing-label">Submitted At</div>
                                        <div className="rp-timing-val">
                                            {selectedSession.endedAt ? fmtDT(selectedSession.endedAt) : <span style={{ color: '#f5a623' }}>In Progress</span>}
                                        </div>
                                    </div>
                                    <div className="rp-timing-box">
                                        <div className="rp-timing-label">Duration Taken</div>
                                        <div className="rp-timing-val">
                                            {selectedSession.startedAt && selectedSession.endedAt
                                                ? `${Math.round((new Date(selectedSession.endedAt).getTime() - new Date(selectedSession.startedAt).getTime()) / 60000)} min`
                                                : '—'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ══ PHOTO GALLERY MODAL ══ */}
            {photoModal && selectedSession && (
                <div className="rp-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPhotoModal(false); }}>
                    <div className="rp-modal rp-photo-modal">
                        <div className="rp-modal-header">
                            <div className="rp-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span>📷 Proctoring Snapshots</span>
                                {flaggedCount > 0 && <span className="rp-photo-flag-pill">🚩 {flaggedCount} Flagged</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{selectedSession.candidateEmail}</span>
                                <button className="rp-modal-close" onClick={() => setPhotoModal(false)}>✕</button>
                            </div>
                        </div>

                        <div className="rp-modal-body rp-photo-modal-body">
                            <div className="rp-photo-stats-bar">
                                <span><strong style={{ color: 'var(--ink)' }}>{totalSnapsCount}</strong><span style={{ color: 'var(--muted)', marginLeft: '4px' }}>Total Snapshots</span></span>
                                {flaggedCount > 0 && <span><strong style={{ color: '#e03b3b' }}>{flaggedCount}</strong><span style={{ color: 'var(--muted)', marginLeft: '4px' }}>Flagged</span></span>}
                                {snapItems.some(s => s.loading) && <span style={{ color: 'var(--muted)', fontSize: '11px' }}>⏳ Loading images…</span>}
                                <span style={{ color: 'var(--muted)', fontSize: '11px', marginLeft: 'auto' }}>← → keys · Esc to close</span>
                            </div>

                            {snapItems.length > 0 ? (
                                <>
                                    <div className="rp-photo-viewer">
                                        {currentSnap?.isFlagged && <div className="rp-photo-flag-badge">🚩 Flagged</div>}
                                        {currentSnap?.capturedAt && <div className="rp-photo-time-badge">🕐 {fmtDT(currentSnap.capturedAt)}</div>}
                                        <div className="rp-photo-counter-badge">{photoIndex + 1} / {snapItems.length}</div>
                                        <button className="rp-photo-nav rp-photo-nav-prev" onClick={() => goPhoto(-1)} disabled={photoIndex === 0}>‹</button>

                                        {currentSnap?.loading ? (
                                            <div className="rp-photo-loading">
                                                <div className="rp-photo-spinner" />
                                                <div style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(255,255,255,.5)' }}>Loading image…</div>
                                            </div>
                                        ) : currentSnap?.error ? (
                                            <div className="rp-photo-error">
                                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</div>
                                                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,.6)' }}>Image could not be loaded</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)', marginTop: '6px', wordBreak: 'break-all', maxWidth: '340px', textAlign: 'center' }}>{currentSnap.originalUrl}</div>
                                            </div>
                                        ) : (
                                            <img key={photoIndex} src={currentSnap?.blobUrl} alt={`Snapshot ${photoIndex + 1}`} className="rp-photo-img" />
                                        )}

                                        <button className="rp-photo-nav rp-photo-nav-next" onClick={() => goPhoto(1)} disabled={photoIndex === snapItems.length - 1}>›</button>
                                    </div>

                                    <div className="rp-photo-thumbstrip">
                                        {snapItems.map((snap, idx) => (
                                            <div key={idx} className={`rp-photo-thumb ${idx === photoIndex ? 'active' : ''} ${snap.isFlagged ? 'flagged' : ''}`} onClick={() => setPhotoIndex(idx)} title={snap.isFlagged ? `Snapshot ${idx + 1} — Flagged` : `Snapshot ${idx + 1}`}>
                                                {snap.loading ? <div className="rp-thumb-loading"><div className="rp-thumb-spinner" /></div>
                                                : snap.error  ? <div className="rp-thumb-error">✕</div>
                                                : <img src={snap.blobUrl} alt={`Thumb ${idx + 1}`} />}
                                                {snap.isFlagged && <div className="rp-thumb-flag">🚩</div>}
                                                <div className="rp-thumb-num">{idx + 1}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="rp-photo-empty">
                                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>📷</div>
                                    {totalSnapsCount > 0 ? (
                                        <><div className="rp-photo-spinner" style={{ marginBottom: '12px' }} /><div style={{ fontSize: '13px', color: 'var(--muted)' }}>Fetching snapshots…</div></>
                                    ) : (
                                        <div style={{ color: 'var(--muted)', fontSize: '14px' }}>No snapshots captured for this attempt.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Share Modal ── */}
            {shareModal && (
                <div className="rp-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShareModal(false); }}>
                    <div className="rp-modal">
                        <div className="rp-modal-header">
                            <div className="rp-modal-title">Share Report</div>
                            <button className="rp-modal-close" onClick={() => setShareModal(false)}>✕</button>
                        </div>
                        <div className="rp-modal-body">
                            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>Share {selectedSession?.candidateEmail}'s report via:</p>
                            <div className="rp-share-btns">
                                <button className="rp-share-option rp-share-wa" onClick={handleShareWA}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.528 5.855L0 24l6.326-1.508C8.02 23.459 9.972 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.907 0-3.682-.527-5.192-1.438l-.37-.22-3.753.894.939-3.652-.243-.385C2.618 15.452 2.182 13.77 2.182 12 2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
                                    WhatsApp
                                </button>
                                <button className="rp-share-option rp-share-pdf" onClick={() => { handleDownloadPDF(); setShareModal(false); }}>📄 Download PDF</button>
                                <button className="rp-share-option rp-share-email" onClick={() => {
                                    const s    = selectedSession!;
                                    const sub  = encodeURIComponent(`Exam Report — ${assessmentTitle}`);
                                    const body = encodeURIComponent(`Candidate: ${s.candidateEmail}\nScore: ${s.obtainedMarks ?? s.score ?? '—'} / ${computeTotalMarks(s)}\nStatus: ${s.status ?? '—'}\nViolations: ${s.totalViolations ?? 0}`);
                                    window.location.href = `mailto:${s.candidateEmail}?subject=${sub}&body=${body}`;
                                    setShareModal(false);
                                }}>✉️ Send Email</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ── */}
            <div className={`rp-toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'info' ? '#1a2540' : '#0d1117' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default AssessmentReport;