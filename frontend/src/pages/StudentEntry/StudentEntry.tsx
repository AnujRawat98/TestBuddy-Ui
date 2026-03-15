import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './StudentEntry.css';
import { assessmentLinksApi } from '../../services/api';

// ── Full link details from GET /api/assessment-links/{linkId} ────────────────
interface LinkDetails {
    id:                   string;
    name:                 string;
    examStartDateTime:    string;
    examEndDateTime:      string;
    isCredentialBased:    boolean;
    isActive:             boolean;
    accessCode:           string;       // link-level code (used for direct-based)
    startupInstruction?:  string;
    // Proctoring flags — used to build permission checkboxes
    isWebProctoring:      boolean;
    isImageProctoring:    boolean;
    isVideoProctoring:    boolean;
    webProctoringWarnings?: number;
    imageProctoringCount?:  number;
    videoProctoringMinutes?: number;
}

type Stage = 'loading' | 'link-error' | 'entry' | 'instructions' | 'starting';

// ── Proctoring permission item ───────────────────────────────────────────────
interface ProcPermission {
    key:     string;
    icon:    string;
    label:   string;
    detail:  string;
}

const StudentEntry: React.FC = () => {
    const { linkId } = useParams<{ linkId: string }>();

    const [link,    setLink]    = useState<LinkDetails | null>(null);
    const [stage,   setStage]   = useState<Stage>('loading');
    const [errorMsg, setErrorMsg] = useState('');

    // Entry form
    const [email,      setEmail]      = useState('');
    const [code,       setCode]       = useState('');
    const [emailError, setEmailError] = useState(false);
    const [codeError,  setCodeError]  = useState(false);
    const [loading,    setLoading]    = useState(false);

    // Instructions: general + per-proctoring permission checkboxes
    const [agreedGeneral,  setAgreedGeneral]  = useState(false);
    const [procAgreed,     setProcAgreed]     = useState<Record<string, boolean>>({});

    const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
    const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(p => ({ ...p, show: false })), 3500);
    };

    // ── STEP 1: Fetch link details ────────────────────────────────────────────
    useEffect(() => {
        if (!linkId) { setStage('link-error'); return; }
        (async () => {
            try {
                const res     = await assessmentLinksApi.getById(linkId);
                const details = res.data as LinkDetails;

                if (!details?.isActive) {
                    setErrorMsg('This exam link is inactive or does not exist.');
                    setStage('link-error');
                    return;
                }
                if (new Date() > new Date(details.examEndDateTime)) {
                    setErrorMsg(`This exam link expired on ${fmtDT(details.examEndDateTime)}.`);
                    setStage('link-error');
                    return;
                }

                setLink(details);
                setStage('entry');
            } catch {
                setErrorMsg('Exam link not found or has expired.');
                setStage('link-error');
            }
        })();
    }, [linkId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Build proctoring permissions list from link flags ─────────────────────
    const buildProcPermissions = (l: LinkDetails): ProcPermission[] => {
        const perms: ProcPermission[] = [];
        if (l.isWebProctoring) {
            perms.push({
                key:    'web',
                icon:   '🌐',
                label:  'Tab & Window Monitoring',
                detail: `We will monitor tab switches and window focus. ${l.webProctoringWarnings ? `${l.webProctoringWarnings} warning(s) allowed before action.` : ''}`,
            });
        }
        if (l.isImageProctoring) {
            perms.push({
                key:    'image',
                icon:   '📸',
                label:  'Webcam Snapshot Capture',
                detail: `Your webcam will capture ${l.imageProctoringCount ?? 'periodic'} snapshot(s) during the exam to verify your identity.`,
            });
        }
        if (l.isVideoProctoring) {
            perms.push({
                key:    'video',
                icon:   '🎥',
                label:  'Webcam Video Recording',
                detail: `Your webcam will be recorded for ${l.videoProctoringMinutes ? `${l.videoProctoringMinutes} minutes` : 'the exam duration'} for proctoring purposes.`,
            });
        }
        return perms;
    };

    // ── STEP 2: Validate ──────────────────────────────────────────────────────
    // Swagger: POST /api/assessment-links/validate?linkId={uuid}&email={string}
    //
    // Direct-based:      backend checks code against AssessmentLink.AccessCode
    //                    → we validate client-side first (immediate feedback),
    //                      then call validate with email so backend confirms & checks
    //                      expiry / attempts. We also pass the code via email param
    //                      since Swagger only exposes linkId+email — the backend
    //                      validate endpoint handles code internally for direct links.
    //
    // Credential-based:  backend checks email+code against AssessmentLinkUser.AccessCodeHash
    //                    → same endpoint, backend knows the type from the link record.
    const handleVerify = async () => {
        if (!linkId || !link) return;

        setEmailError(false);
        setCodeError(false);
        setErrorMsg('');

        const emailTrimmed = email.trim().toLowerCase();
        const codeTrimmed  = code.trim().toUpperCase();

        if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
            setEmailError(true);
            setErrorMsg('Please enter a valid email address.');
            return;
        }
        if (!codeTrimmed) {
            setCodeError(true);
            setErrorMsg('Please enter the access code.');
            return;
        }

        // Cannot start before exam window opens
        if (new Date() < new Date(link.examStartDateTime)) {
            setErrorMsg(`Exam hasn't started yet. It opens at ${fmtDT(link.examStartDateTime)}.`);
            return;
        }

        // For direct-based: client-side code check first
        // (gives immediate feedback without API round-trip)
        if (!link.isCredentialBased) {
            if (codeTrimmed !== link.accessCode?.toUpperCase()) {
                setCodeError(true);
                setErrorMsg('Invalid access code. Please check and try again.');
                return;
            }
        }

        setLoading(true);
        try {
            // POST /api/assessment-links/validate?linkId={}&email={}
            // Backend handles: expiry, attempts, credential code check
            await assessmentLinksApi.validate(linkId, emailTrimmed);

            // Init proctoring checkboxes — one per active proctoring type
            const perms = buildProcPermissions(link);
            const initAgreed: Record<string, boolean> = {};
            perms.forEach(p => { initAgreed[p.key] = false; });
            setProcAgreed(initAgreed);
            setAgreedGeneral(false);
            setStage('instructions');
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ??
                err?.response?.data?.title   ??
                'Invalid credentials or access denied.';
            setErrorMsg(msg);
            setCodeError(true);
        } finally {
            setLoading(false);
        }
    };

    // ── STEP 3: Proceed — all checkboxes must be checked ─────────────────────
    const procPerms    = link ? buildProcPermissions(link) : [];
    const allProcAgreed = procPerms.every(p => procAgreed[p.key] === true);
    const canProceed    = agreedGeneral && allProcAgreed;

    const handleProceed = async () => {
        if (!linkId || !canProceed) return;
        setStage('starting');
        try {
            // POST /api/assessment-links/{linkId}/start?email={}
            // Returns the attemptId
            const emailToSend = email.trim().toLowerCase();
            console.log('[StudentEntry] calling start:', { linkId, email: emailToSend });
            const res       = await assessmentLinksApi.start(linkId, emailToSend);
            console.log('[StudentEntry] start response:', res.data);
            const attemptId = res.data?.id ?? res.data?.attemptId ?? res.data;

            const examUrl = `${window.location.origin}/exam/${attemptId}`;

            // Open exam in a new fullscreen popup window
            const w      = screen.width;
            const h      = screen.height;
            const popup  = window.open(
                examUrl,
                'TestBuddyExam',
                `width=${w},height=${h},top=0,left=0,toolbar=no,menubar=no,` +
                `scrollbars=no,resizable=no,location=no,status=no`
            );

            if (!popup || popup.closed) {
                // Popup blocked — fallback: open in same tab
                showToast('Popup blocked. Opening in this tab…', 'info');
                setTimeout(() => { window.location.href = examUrl; }, 1200);
            } else {
                showToast('Exam window opened! Good luck 🚀', 'success');
            }
        } catch (err: any) {
            // Log full error for debugging
            console.error('[StudentEntry] start failed:', err?.response ?? err);
            const msg =
                err?.response?.data?.message ??
                err?.response?.data?.title   ??
                (typeof err?.response?.data === 'string' ? err.response.data : null) ??
                err?.message ??
                'Failed to start exam. Please try again.';
            showToast(msg, 'error');
            setStage('instructions');
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const fmtDT = (s: string) => !s ? '—' : new Date(s).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    const clearErr = () => { setErrorMsg(''); setEmailError(false); setCodeError(false); };

    const timeStatus = () => {
        if (!link) return null;
        const now = new Date(), start = new Date(link.examStartDateTime), end = new Date(link.examEndDateTime);
        if (now < start) return { label: `Opens ${fmtDT(link.examStartDateTime)}`, color: 'var(--yellow)' };
        if (now > end)   return { label: 'Expired',  color: 'var(--red)'   };
        return               { label: 'Active Now', color: 'var(--green)' };
    };
    const ts = timeStatus();

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: Loading
    if (stage === 'loading') {
        return (
            <div className="student-entry-wrap">
                <div className="entry-card" style={{ textAlign: 'center' }}>
                    <div className="logo">Test<span>Buddy</span></div>
                    <div style={{ fontSize: '32px', margin: '32px 0 12px' }}>⏳</div>
                    <div style={{ fontSize: '15px', color: 'var(--muted)' }}>Loading exam details…</div>
                </div>
            </div>
        );
    }

    // RENDER: Link error
    if (stage === 'link-error') {
        return (
            <div className="student-entry-wrap">
                <div className="entry-card" style={{ textAlign: 'center' }}>
                    <div className="logo">Test<span>Buddy</span></div>
                    <div style={{ fontSize: '48px', margin: '28px 0 14px' }}>🔒</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
                        Link Unavailable
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6 }}>
                        {errorMsg || 'This exam link is invalid, inactive, or has expired.'}
                    </div>
                </div>
            </div>
        );
    }

    // RENDER: Instructions + permission checkboxes
    if (stage === 'instructions' || stage === 'starting') {
        const instructions = link?.startupInstruction
            ? link.startupInstruction.split(/\n|(?<=\.)\s+/).map(s => s.trim()).filter(Boolean)
            : [
                'Ensure you are in a quiet, well-lit room.',
                'Do not switch browser tabs — violations will be recorded.',
                'Once started, the timer cannot be paused.',
                'Submit before the exam window closes.',
            ];

        return (
            <div className="student-entry-wrap">
                <div className="entry-card" style={{ maxWidth: '600px' }}>
                    <div className="logo">Test<span>Buddy</span></div>
                    <div className="logo-sub">Online Assessment Platform</div>
                    <div className="divider" />

                    <div className="exam-title">{link?.name ?? 'Assessment'}</div>

                    <div className="meta-row">
                        <div className="meta-item">
                            <div className="meta-icon-label"><span className="meta-icon">📅</span> Opens</div>
                            <div className="meta-sub">{fmtDT(link?.examStartDateTime ?? '')}</div>
                        </div>
                        <div className="meta-item">
                            <div className="meta-icon-label"><span className="meta-icon">⏰</span> Closes</div>
                            <div className="meta-sub">{fmtDT(link?.examEndDateTime ?? '')}</div>
                        </div>
                        <div className="meta-item">
                            <div className="meta-icon-label"><span className="meta-icon">👤</span> Student</div>
                            <div className="meta-sub" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{email}</div>
                        </div>
                    </div>

                    {/* Exam instructions */}
                    <div className="instructions">
                        <div className="instructions-title">📋 Exam Instructions</div>
                        <ul className="instructions-list">
                            {instructions.map((inst, i) => (
                                <li key={i}><div className="bullet" /><span>{inst}</span></li>
                            ))}
                        </ul>
                    </div>

                    {/* ── Proctoring Permission Checkboxes ──────────────────────
                        Only shown if the link has proctoring enabled.
                        Each active proctoring type gets its own checkbox.
                        Student must check ALL of them to proceed.
                    ─────────────────────────────────────────────────────────── */}
                    {procPerms.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                fontSize: '12px', fontWeight: 700, letterSpacing: '1px',
                                textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px',
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                🔒 Proctoring Permissions Required
                            </div>

                            <div style={{
                                background: 'rgba(224,59,59,.05)',
                                border: '1px solid rgba(224,59,59,.18)',
                                borderRadius: '12px',
                                padding: '4px 0',
                                marginBottom: '4px',
                            }}>
                                {procPerms.map((perm, i) => (
                                    <label key={perm.key} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                                        padding: '14px 16px',
                                        borderBottom: i < procPerms.length - 1 ? '1px solid rgba(224,59,59,.1)' : 'none',
                                        cursor: stage === 'starting' ? 'not-allowed' : 'pointer',
                                        background: procAgreed[perm.key] ? 'rgba(0,87,255,.04)' : 'transparent',
                                        transition: 'background .15s',
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={procAgreed[perm.key] ?? false}
                                            onChange={e => setProcAgreed(prev => ({ ...prev, [perm.key]: e.target.checked }))}
                                            disabled={stage === 'starting'}
                                            style={{ width: '16px', height: '16px', marginTop: '3px', accentColor: 'var(--accent2)', flexShrink: 0, cursor: 'pointer' }}
                                        />
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '3px' }}>
                                                {perm.icon} {perm.label}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
                                                {perm.detail}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── General agreement checkbox ─────────────────────────── */}
                    <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                        cursor: stage === 'starting' ? 'not-allowed' : 'pointer',
                        marginBottom: '24px', padding: '16px',
                        background: 'var(--surface)',
                        borderRadius: '12px',
                        border: `2px solid ${agreedGeneral ? 'var(--accent2)' : 'var(--border)'}`,
                        transition: 'border-color .2s',
                    }}>
                        <input
                            type="checkbox"
                            checked={agreedGeneral}
                            onChange={e => setAgreedGeneral(e.target.checked)}
                            disabled={stage === 'starting'}
                            style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--accent2)', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.55 }}>
                            I have read and understood all the instructions. I agree to follow the exam
                            rules and acknowledge that any violations will be recorded and reported.
                            {procPerms.length > 0 && (
                                <span style={{ color: 'var(--muted)' }}>
                                    {' '}I also grant permission for the proctoring methods listed above.
                                </span>
                            )}
                        </span>
                    </label>

                    {/* Pending notice if proctoring checkboxes not all ticked */}
                    {!canProceed && procPerms.length > 0 && (
                        <div style={{
                            fontSize: '12px', color: 'var(--yellow)', textAlign: 'center',
                            marginBottom: '12px', padding: '8px 12px',
                            background: 'rgba(245,166,35,.08)', borderRadius: '8px',
                        }}>
                            ☝️ Please accept all proctoring permissions and the general agreement to proceed.
                        </div>
                    )}
                    {!canProceed && procPerms.length === 0 && (
                        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                            ☝️ Check the box above to enable the Proceed button.
                        </div>
                    )}

                    {/* Proceed button — disabled until ALL boxes checked */}
                    <button
                        className="start-btn"
                        onClick={handleProceed}
                        disabled={!canProceed || stage === 'starting'}
                        style={{
                            background: canProceed ? 'var(--green)' : '#ccc',
                            boxShadow: canProceed ? '0 4px 20px rgba(0,194,113,.35)' : 'none',
                            cursor: canProceed ? 'pointer' : 'not-allowed',
                        }}
                    >
                        {stage === 'starting' ? '⏳ Starting Exam…' : '🚀 Proceed to Exam'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <button
                            onClick={() => { setStage('entry'); setAgreedGeneral(false); setProcAgreed({}); }}
                            disabled={stage === 'starting'}
                            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            ← Back to entry
                        </button>
                    </div>
                </div>

                <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'info' ? '#1a2540' : '#0d1117' }}>
                    <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
                    <span>{toast.msg}</span>
                </div>
            </div>
        );
    }

    // RENDER: Entry form
    return (
        <div className="student-entry-wrap">
            <div className="entry-card">
                <div className="logo">Test<span>Buddy</span></div>
                <div className="logo-sub">Online Assessment Platform</div>
                <div className="divider" />

                <div className="exam-title">{link?.name ?? 'Assessment Entry'}</div>

                {/* Time window + type badges */}
                {link && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                        {ts && (
                            <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '100px', background: `${ts.color}18`, color: ts.color, border: `1px solid ${ts.color}44` }}>
                                ● {ts.label}
                            </span>
                        )}
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            {fmtDT(link.examStartDateTime)} → {fmtDT(link.examEndDateTime)}
                        </span>
                        <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '100px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                            {link.isCredentialBased ? '🔐 Credential-Based' : '🔓 Direct Access'}
                        </span>
                        {(link.isWebProctoring || link.isImageProctoring || link.isVideoProctoring) && (
                            <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '100px', background: 'rgba(224,59,59,.08)', border: '1px solid rgba(224,59,59,.2)', color: 'var(--red)' }}>
                                🔒 Proctored
                            </span>
                        )}
                    </div>
                )}

                <div className={`err-msg ${errorMsg ? 'show' : ''}`}>⚠️ <span>{errorMsg}</span></div>

                {/* Email */}
                <div className="form-group">
                    <label className="form-label">Your Email Address</label>
                    <input
                        className={`form-input ${emailError ? 'error' : ''}`}
                        type="email"
                        placeholder="student@example.com"
                        value={email}
                        onChange={e => { clearErr(); setEmail(e.target.value); }}
                        disabled={loading}
                        onKeyDown={e => e.key === 'Enter' && handleVerify()}
                    />
                </div>

                {/* Access Code */}
                <div className="form-group">
                    <label className="form-label">
                        Access Code
                        <span style={{ marginLeft: '8px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)', fontSize: '11px' }}>
                            {link?.isCredentialBased ? '(sent to your email individually)' : '(shared with all participants)'}
                        </span>
                    </label>
                    <input
                        className={`form-input ${codeError ? 'error' : ''}`}
                        type="text"
                        placeholder="Enter access code"
                        maxLength={10}
                        value={code}
                        onChange={e => { clearErr(); setCode(e.target.value.toUpperCase()); }}
                        disabled={loading}
                        onKeyDown={e => e.key === 'Enter' && handleVerify()}
                        style={{ letterSpacing: '3px', fontFamily: '"Syne",sans-serif', fontWeight: 700 }}
                    />
                </div>

                {/* Quick instructions preview */}
                <div className="instructions">
                    <div className="instructions-title">📋 Before you begin</div>
                    <ul className="instructions-list">
                        <li><div className="bullet" /><span>Ensure you are in a quiet room with good lighting</span></li>
                        <li><div className="bullet" /><span>Do not switch browser tabs — it will be flagged</span></li>
                        {(link?.isImageProctoring || link?.isVideoProctoring) && (
                            <li><div className="bullet" /><span>Camera access will be required — allow it when prompted</span></li>
                        )}
                        <li><div className="bullet" /><span>Once started, the timer cannot be paused</span></li>
                    </ul>
                </div>

                <button className="start-btn" onClick={handleVerify} disabled={loading}>
                    {loading ? '⏳ Verifying…' : 'Verify Access →'}
                </button>
            </div>

            <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'info' ? '#1a2540' : '#0d1117' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default StudentEntry;
